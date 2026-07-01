const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let allRecipes = [];

// ── INIT ────────────────────────────────────────────────────────────────────

async function init() {
  await loadRecipes();
  bindUI();
}

async function loadRecipes() {
  const { data, error } = await sb.from('recipes').select('*').order('name');
  if (error) { console.error(error); return; }
  allRecipes = data || [];
  renderGrid(allRecipes);
  populateTagFilter();
}

// ── RENDER ───────────────────────────────────────────────────────────────────

function renderGrid(recipes) {
  const grid = document.getElementById('recipe-grid');
  const empty = document.getElementById('empty-state');

  if (!recipes.length) {
    grid.innerHTML = '';
    grid.appendChild(empty);
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = recipes.map(r => `
    <div class="recipe-card" data-id="${r.id}">
      <h3>${esc(r.name)}</h3>
      <div class="meta">${r.servings ? r.servings + ' servings' : ''} ${r.description ? '· ' + esc(r.description).slice(0, 60) + (r.description.length > 60 ? '…' : '') : ''}</div>
      <div>${(r.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', () => openCookView(card.dataset.id));
  });
}

function populateTagFilter() {
  const all = [...new Set(allRecipes.flatMap(r => r.tags || []))].sort();
  const sel = document.getElementById('tag-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All tags</option>' +
    all.map(t => `<option value="${esc(t)}" ${t === cur ? 'selected' : ''}>${esc(t)}</option>`).join('');
}

function filterRecipes() {
  const q = document.getElementById('search').value.toLowerCase();
  const tag = document.getElementById('tag-filter').value;
  const filtered = allRecipes.filter(r => {
    const matchQ = !q || r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
    const matchTag = !tag || (r.tags || []).includes(tag);
    return matchQ && matchTag;
  });
  renderGrid(filtered);
}

// ── COOKING VIEW ─────────────────────────────────────────────────────────────

function openCookView(id) {
  const r = allRecipes.find(x => x.id === id);
  if (!r) return;

  document.getElementById('cook-name').textContent = r.name;
  document.getElementById('cook-meta').textContent = [
    r.servings ? `${r.servings} servings` : '',
    r.description || ''
  ].filter(Boolean).join(' · ');

  document.getElementById('cook-tags').innerHTML =
    (r.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');

  // Ingredients grouped by category
  const byCategory = {};
  (r.ingredients || []).forEach(ing => {
    const cat = ing.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(ing);
  });

  const ingEl = document.getElementById('cook-ingredients');
  ingEl.innerHTML = Object.entries(byCategory).map(([cat, items]) => `
    <div style="margin-bottom:0.8rem;">
      <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--neon-secondary);margin-bottom:0.3rem;">${esc(cat)}</div>
      ${items.map(i => `
        <div class="cook-ing-item">
          <span class="cook-ing-qty">${esc([i.amount, i.unit].filter(Boolean).join(' '))}</span>
          <span>${esc(i.name)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');

  // Steps — tap to cross off
  const stepsEl = document.getElementById('cook-steps');
  stepsEl.innerHTML = (r.steps || []).map((s, i) =>
    `<li data-idx="${i}">${esc(s)}</li>`
  ).join('');

  stepsEl.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => li.classList.toggle('done'));
  });

  // Wire edit button
  document.getElementById('cook-edit-btn').onclick = () => {
    closeCookModal();
    openEdit(id);
  };

  // Wire share button
  document.getElementById('cook-share-btn').onclick = () => shareRecipe(r);

  document.getElementById('cook-modal').classList.add('open');
}

function closeCookModal() {
  document.getElementById('cook-modal').classList.remove('open');
}

function shareRecipe(r) {
  const lines = [];
  lines.push(`🍴 ${r.name}`);
  if (r.description) lines.push(`\n${r.description}`);
  if (r.servings) lines.push(`Serves: ${r.servings}`);

  lines.push('\nINGREDIENTS');
  const byCategory = {};
  (r.ingredients || []).forEach(i => {
    const cat = i.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(i);
  });
  Object.entries(byCategory).forEach(([cat, items]) => {
    lines.push(`\n${cat}`);
    items.forEach(i => {
      const qty = [i.amount, i.unit].filter(Boolean).join(' ');
      lines.push(`  • ${qty ? qty + ' ' : ''}${i.name}`);
    });
  });

  lines.push('\nSTEPS');
  (r.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  const text = lines.join('\n');

  if (navigator.share) {
    navigator.share({ title: r.name, text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('cook-share-btn');
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = 'Share'; }, 2000);
    });
  }
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────

function openAdd() {
  document.getElementById('modal-title').textContent = 'Add Recipe';
  document.getElementById('recipe-form').reset();
  document.getElementById('recipe-id').value = '';
  document.getElementById('delete-btn').style.display = 'none';
  renderIngredients([]);
  renderSteps([]);
  openModal();
}

function openEdit(id) {
  const r = allRecipes.find(x => x.id === id);
  if (!r) return;
  document.getElementById('modal-title').textContent = 'Edit Recipe';
  document.getElementById('recipe-id').value = r.id;
  document.getElementById('name').value = r.name;
  document.getElementById('description').value = r.description || '';
  document.getElementById('servings').value = r.servings || 4;
  document.getElementById('tags').value = (r.tags || []).join(', ');
  document.getElementById('delete-btn').style.display = '';
  renderIngredients(r.ingredients || []);
  renderSteps(r.steps || []);
  openModal();
}

function openModal() { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

// ── INGREDIENTS ───────────────────────────────────────────────────────────────

function renderIngredients(ingredients) {
  const list = document.getElementById('ingredients-list');
  list.innerHTML = '';
  ingredients.forEach(ing => addIngredientRow(ing));
  if (!ingredients.length) addIngredientRow();
}

function addIngredientRow(ing = {}) {
  const list = document.getElementById('ingredients-list');
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.innerHTML = `
    <input class="amount" type="text" placeholder="Qty" value="${esc(ing.amount || '')}" />
    <input class="unit"   type="text" placeholder="Unit" value="${esc(ing.unit || '')}" />
    <input class="ing-name" type="text" placeholder="Ingredient" value="${esc(ing.name || '')}" />
    <input class="category" type="text" placeholder="Category" value="${esc(ing.category || '')}" />
    <button type="button" class="remove-btn" title="Remove">&times;</button>
  `;
  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function collectIngredients() {
  return [...document.querySelectorAll('#ingredients-list .ingredient-row')]
    .map(row => ({
      amount: row.querySelector('.amount').value.trim(),
      unit: row.querySelector('.unit').value.trim(),
      name: row.querySelector('.ing-name').value.trim(),
      category: row.querySelector('.category').value.trim(),
    }))
    .filter(i => i.name);
}

// ── STEPS ─────────────────────────────────────────────────────────────────────

function renderSteps(steps) {
  const list = document.getElementById('steps-list');
  list.innerHTML = '';
  steps.forEach(s => addStepRow(s));
  if (!steps.length) addStepRow();
}

function addStepRow(text = '') {
  const list = document.getElementById('steps-list');
  const idx = list.children.length + 1;
  const row = document.createElement('div');
  row.className = 'step-row';
  row.innerHTML = `
    <span class="step-num">${idx}.</span>
    <textarea placeholder="Step ${idx}…">${esc(text)}</textarea>
    <button type="button" class="remove-btn" title="Remove">&times;</button>
  `;
  row.querySelector('.remove-btn').addEventListener('click', () => {
    row.remove();
    renumberSteps();
  });
  list.appendChild(row);
}

function renumberSteps() {
  document.querySelectorAll('#steps-list .step-row').forEach((row, i) => {
    row.querySelector('.step-num').textContent = (i + 1) + '.';
  });
}

function collectSteps() {
  return [...document.querySelectorAll('#steps-list .step-row textarea')]
    .map(t => t.value.trim())
    .filter(Boolean);
}

// ── SAVE / DELETE ─────────────────────────────────────────────────────────────

async function saveRecipe(e) {
  e.preventDefault();
  const id = document.getElementById('recipe-id').value;
  const payload = {
    name: document.getElementById('name').value.trim(),
    description: document.getElementById('description').value.trim(),
    servings: parseInt(document.getElementById('servings').value) || null,
    tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean),
    ingredients: collectIngredients(),
    steps: collectSteps(),
  };

  let error;
  if (id) {
    ({ error } = await sb.from('recipes').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('recipes').insert(payload));
  }

  if (error) { alert('Error saving: ' + error.message); return; }
  closeModal();
  await loadRecipes();
}

async function deleteRecipe() {
  const id = document.getElementById('recipe-id').value;
  if (!id || !confirm('Delete this recipe?')) return;
  const { error } = await sb.from('recipes').delete().eq('id', id);
  if (error) { alert('Error deleting: ' + error.message); return; }
  closeModal();
  await loadRecipes();
}

// ── BIND UI ───────────────────────────────────────────────────────────────────

function bindUI() {
  document.getElementById('add-btn').addEventListener('click', openAdd);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.getElementById('cook-close').addEventListener('click', closeCookModal);
  document.getElementById('cook-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeCookModal(); });
  document.getElementById('recipe-form').addEventListener('submit', saveRecipe);
  document.getElementById('delete-btn').addEventListener('click', deleteRecipe);
  document.getElementById('add-ingredient').addEventListener('click', () => addIngredientRow());
  document.getElementById('add-step').addEventListener('click', () => addStepRow());
  document.getElementById('search').addEventListener('input', filterRecipes);
  document.getElementById('tag-filter').addEventListener('change', filterRecipes);
}

// ── UTIL ──────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
