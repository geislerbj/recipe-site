const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

async function init() {
  const today = localDateStr(new Date());
  const next6 = localDateStr(new Date(Date.now() + 6 * 86400000));
  document.getElementById('start-date').value = today;
  document.getElementById('end-date').value = next6;
  bindUI();
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function generateList() {
  const start = document.getElementById('start-date').value;
  const end   = document.getElementById('end-date').value;
  if (!start || !end || start > end) { alert('Select a valid date range.'); return; }

  // Load meal plan for range
  const { data: planRows } = await sb.from('meal_plan')
    .select('date, recipe_id')
    .gte('date', start).lte('date', end)
    .not('recipe_id', 'is', null);

  if (!planRows || !planRows.length) {
    document.getElementById('shopping-output').innerHTML = '<div class="empty">No meals planned for this range.</div>';
    document.getElementById('meal-summary').textContent = '';
    return;
  }

  const recipeIds = [...new Set(planRows.map(r => r.recipe_id))];

  const { data: recipes } = await sb.from('recipes')
    .select('id, name, ingredients')
    .in('id', recipeIds);

  const recipeMap = Object.fromEntries((recipes || []).map(r => [r.id, r]));

  // Build meal summary
  const mealLines = planRows
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => {
      const r = recipeMap[row.recipe_id];
      return r ? `${friendlyDate(row.date)}: ${r.name}` : null;
    }).filter(Boolean);

  document.getElementById('meal-summary').textContent = mealLines.join(' · ');

  // Aggregate ingredients by category
  const byCategory = {};
  planRows.forEach(row => {
    const recipe = recipeMap[row.recipe_id];
    if (!recipe) return;
    (recipe.ingredients || []).forEach(ing => {
      const cat = ing.category?.trim() || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      // Merge duplicates by name
      const existing = byCategory[cat].find(i => i.name.toLowerCase() === ing.name.toLowerCase());
      if (existing) {
        existing.entries.push({ amount: ing.amount, unit: ing.unit, recipe: recipe.name });
      } else {
        byCategory[cat].push({ name: ing.name, entries: [{ amount: ing.amount, unit: ing.unit, recipe: recipe.name }] });
      }
    });
  });

  // Sort categories, "Other" last
  const cats = Object.keys(byCategory).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  const output = document.getElementById('shopping-output');
  output.innerHTML = cats.map(cat => `
    <div class="shopping-section">
      <h3>${esc(cat)}</h3>
      ${byCategory[cat].map(item => `
        <div class="shopping-item" data-name="${esc(item.name)}">
          <input type="checkbox" />
          <span>${formatIngredient(item)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');

  output.querySelectorAll('.shopping-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', e => {
      e.target.closest('.shopping-item').classList.toggle('checked', e.target.checked);
    });
  });
}

function formatIngredient(item) {
  // Combine amounts if same unit, otherwise list separately
  const grouped = {};
  item.entries.forEach(e => {
    const key = e.unit || '';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e.amount);
  });

  const parts = Object.entries(grouped).map(([unit, amounts]) => {
    const combined = amounts.filter(Boolean).join(' + ');
    return combined ? `${combined}${unit ? ' ' + unit : ''}` : null;
  }).filter(Boolean);

  const qty = parts.length ? parts.join(', ') : '';
  return `${qty ? qty + ' ' : ''}${esc(item.name)}`;
}

function friendlyDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function copyToClipboard() {
  const sections = document.querySelectorAll('.shopping-section');
  if (!sections.length) return;

  const lines = [];
  sections.forEach(sec => {
    lines.push('\n' + sec.querySelector('h3').textContent.toUpperCase());
    sec.querySelectorAll('.shopping-item span').forEach(span => {
      lines.push('  • ' + span.textContent);
    });
  });

  navigator.clipboard.writeText(lines.join('\n').trim()).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = 'Copy to Clipboard'; }, 2000);
  });
}

function uncheckAll() {
  document.querySelectorAll('.shopping-item').forEach(item => {
    item.classList.remove('checked');
    item.querySelector('input[type="checkbox"]').checked = false;
  });
}

function bindUI() {
  document.getElementById('load-btn').addEventListener('click', generateList);
  document.getElementById('copy-btn').addEventListener('click', copyToClipboard);
  document.getElementById('uncheck-btn').addEventListener('click', uncheckAll);
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
