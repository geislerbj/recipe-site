const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

async function init() {
  await loadQueue();
  bindUI();
}

async function loadQueue() {
  const { data } = await sb.from('recipe_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const list = document.getElementById('queue-list');
  if (!data || !data.length) {
    list.innerHTML = '<div class="empty">No URLs in queue.</div>';
    return;
  }

  list.innerHTML = data.map(row => `
    <div class="card" style="margin-bottom:0.75rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
      <span style="flex:1;font-size:0.85rem;color:var(--text-muted);word-break:break-all;">${esc(row.url)}</span>
      <span style="font-size:0.75rem;color:var(--neon-secondary);">${timeAgo(row.created_at)}</span>
      <button class="btn btn-ghost btn-sm remove-btn" data-id="${row.id}">Remove</button>
    </div>
  `).join('');

  list.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromQueue(btn.dataset.id));
  });
}

async function addToQueue() {
  const input = document.getElementById('url-input');
  const msg   = document.getElementById('submit-msg');
  const url   = input.value.trim();

  if (!url) return;

  try { new URL(url); } catch {
    msg.style.color = 'var(--neon-accent)';
    msg.textContent = 'Please enter a valid URL.';
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Adding…';

  const { error } = await sb.from('recipe_queue').insert({ url, status: 'pending' });

  btn.disabled = false;
  btn.textContent = 'Add to Queue';

  if (error) {
    msg.style.color = 'var(--neon-accent)';
    msg.textContent = 'Error: ' + error.message;
    return;
  }

  msg.style.color = 'var(--neon-primary)';
  msg.textContent = 'Added! Will be processed next time you sync on desktop.';
  input.value = '';
  await loadQueue();
}

async function removeFromQueue(id) {
  await sb.from('recipe_queue').delete().eq('id', id);
  await loadQueue();
}

function bindUI() {
  document.getElementById('submit-btn').addEventListener('click', addToQueue);
  document.getElementById('url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addToQueue();
  });
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
