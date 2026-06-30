const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let allRecipes = [];
let currentDays = []; // array of date strings 'YYYY-MM-DD'
let planMap = {};     // { 'YYYY-MM-DD': recipe_id | null }

// ── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  // Default range: today → +6 days
  const today = localDateStr(new Date());
  const next6 = localDateStr(new Date(Date.now() + 6 * 86400000));
  document.getElementById('start-date').value = today;
  document.getElementById('end-date').value = next6;

  const { data } = await sb.from('recipes').select('id, name').order('name');
  allRecipes = data || [];

  bindUI();
  await loadPlan();
}

// ── DATE HELPERS ──────────────────────────────────────────────────────────────

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function datesInRange(start, end) {
  const days = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    days.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function friendlyDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── LOAD / RENDER ─────────────────────────────────────────────────────────────

async function loadPlan() {
  const start = document.getElementById('start-date').value;
  const end   = document.getElementById('end-date').value;
  if (!start || !end || start > end) {
    alert('Please select a valid date range.');
    return;
  }

  currentDays = datesInRange(start, end);

  const { data } = await sb.from('meal_plan')
    .select('date, recipe_id')
    .gte('date', start)
    .lte('date', end);

  planMap = {};
  (data || []).forEach(row => { planMap[row.date] = row.recipe_id; });

  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = currentDays.map(date => {
    const recipeId = planMap[date] || '';
    const hasRecipe = !!recipeId;
    return `
      <div class="day-card ${hasRecipe ? 'has-recipe' : ''}" data-date="${date}">
        <div class="day-label">${friendlyDate(date).split(',')[0]}</div>
        <div class="day-date">${friendlyDate(date).split(',').slice(1).join(',').trim()}</div>
        <select class="recipe-select" data-date="${date}">
          <option value="">— no meal —</option>
          ${allRecipes.map(r =>
            `<option value="${r.id}" ${r.id === recipeId ? 'selected' : ''}>${esc(r.name)}</option>`
          ).join('')}
        </select>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.recipe-select').forEach(sel => {
    sel.addEventListener('change', e => {
      const date = e.target.dataset.date;
      planMap[date] = e.target.value || null;
      e.target.closest('.day-card').classList.toggle('has-recipe', !!e.target.value);
    });
  });
}

// ── RANDOM FILL ───────────────────────────────────────────────────────────────

function randomFill() {
  if (!allRecipes.length) { alert('Add some recipes first!'); return; }

  currentDays.forEach(date => {
    if (planMap[date]) return; // already assigned — don't overwrite

    const pick = allRecipes[Math.floor(Math.random() * allRecipes.length)];
    planMap[date] = pick.id;
  });

  renderCalendar();
}

// ── SAVE ──────────────────────────────────────────────────────────────────────

async function savePlan() {
  if (!currentDays.length) return;

  const rows = currentDays.map(date => ({
    date,
    recipe_id: planMap[date] || null,
  }));

  const { error } = await sb.from('meal_plan')
    .upsert(rows, { onConflict: 'date' });

  if (error) { alert('Error saving: ' + error.message); return; }

  // Visual confirmation
  const btn = document.getElementById('save-btn');
  btn.textContent = 'Saved ✓';
  setTimeout(() => { btn.textContent = 'Save Plan'; }, 2000);
}

// ── CLEAR ─────────────────────────────────────────────────────────────────────

async function clearAll() {
  if (!currentDays.length) return;
  if (!confirm('Clear all meals for this date range?')) return;

  currentDays.forEach(d => { planMap[d] = null; });
  renderCalendar();

  const rows = currentDays.map(date => ({ date, recipe_id: null }));
  await sb.from('meal_plan').upsert(rows, { onConflict: 'date' });
}

// ── BIND UI ───────────────────────────────────────────────────────────────────

function bindUI() {
  document.getElementById('load-btn').addEventListener('click', loadPlan);
  document.getElementById('random-btn').addEventListener('click', randomFill);
  document.getElementById('save-btn').addEventListener('click', savePlan);
  document.getElementById('clear-btn').addEventListener('click', clearAll);
}

// ── UTIL ──────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
