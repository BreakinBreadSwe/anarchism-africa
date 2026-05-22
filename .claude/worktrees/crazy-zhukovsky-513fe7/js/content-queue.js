/* ANARCHISM.AFRICA — Content Queue
 *
 * Publisher / Editor review UI for the auto-scraper output. The cron job at
 * /api/cron/scan-content runs every 6 hours, fetches a curated list of
 * afro-anarchist / decolonial / pan-African feeds, and pushes new items into
 * /api/content/queue with status=pending.
 *
 * In this view the publisher (or editor) sees the queue, can edit fields,
 * approve into the public catalogue, or reject. Approve writes the item into
 * Vercel Blob at content/<kind>.json; the public site merges those overlays
 * with data/seed.json on load.
 *
 * Mounts into any container with id "view-content-queue" — used by
 * publisher.html, editor.html, and admin.html.
 */
(function () {
  const KIND_LABELS = {
    article: 'Article',  film: 'Film',     event: 'Event',
    song:    'Song',     book: 'Book',     merch: 'Merch',
    grant:   'Grant'
  };
  const KIND_ORDER = ['article','film','event','song','book','merch','grant'];

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  let state = { items: [], filter: 'all', loading: false, role: 'publisher' };

  function template () {
    return `
      <div class="panel" style="margin-bottom:14px">
        <h2 style="margin:0 0 6px">Pending content</h2>
        <p style="color:var(--fg-dim);max-width:65ch;margin:0 0 10px">
          The auto-scanner pulls in new items from a curated list of afro-anarchist /
          decolonial / pan-African feeds every six hours. Review, edit, and approve
          before anything goes public. Anything you reject simply drops from the queue.
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn primary" id="cq-refresh">Refresh queue</button>
          <button class="btn ghost"   id="cq-trigger" title="Run the scraper now (admin only — needs CRON_SECRET)">Run scan now</button>
          <span id="cq-status" class="mono" style="font-size:.75rem;color:var(--muted);margin-left:8px"></span>
        </div>
        <div id="cq-filters" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
          <button class="cq-filter active" data-kind="all">All</button>
          ${KIND_ORDER.map(k => `<button class="cq-filter" data-kind="${k}">${KIND_LABELS[k]}s</button>`).join('')}
        </div>
      </div>
      <div id="cq-items" style="display:flex;flex-direction:column;gap:10px"></div>
    `;
  }

  function paint (role) {
    state.role = role || 'publisher';
    const root = $('#view-content-queue');
    if (!root) return;
    if (!root.dataset.painted) {
      root.innerHTML = template();
      root.dataset.painted = '1';
      bind(root);
    }
    refresh();
  }

  function bind (root) {
    root.querySelector('#cq-refresh').addEventListener('click', refresh);
    root.querySelector('#cq-trigger').addEventListener('click', triggerScan);
    root.querySelector('#cq-filters').addEventListener('click', e => {
      const b = e.target.closest('.cq-filter'); if (!b) return;
      $$('.cq-filter').forEach(x => x.classList.toggle('active', x === b));
      state.filter = b.dataset.kind;
      renderItems();
    });
    root.addEventListener('click', e => {
      const card = e.target.closest('[data-cq-id]'); if (!card) return;
      const id = card.dataset.cqId;
      if (e.target.closest('[data-act="approve"]')) approve(id);
      if (e.target.closest('[data-act="reject"]'))  reject(id);
      if (e.target.closest('[data-act="edit"]'))    toggleEdit(card);
      if (e.target.closest('[data-act="save"]'))    saveEdits(card, id);
      if (e.target.closest('[data-act="open"]')) {
        const a = card.querySelector('a[data-link]');
        if (a) window.open(a.dataset.link, '_blank', 'noopener');
      }
    });
  }

  function status (msg, kind = 'idle') {
    const el = $('#cq-status'); if (!el) return;
    el.textContent = msg || '';
    el.style.color = kind === 'error' ? 'var(--red)' : kind === 'ok' ? 'var(--green)' : 'var(--muted)';
  }

  async function refresh () {
    if (state.loading) return;
    state.loading = true; status('Loading…');
    try {
      const r = await fetch('/api/content/queue', { cache: 'no-store' });
      const data = await r.json();
      state.items = Array.isArray(data.items) ? data.items : [];
      status(`${state.items.length} pending`, 'ok');
      renderItems();
    } catch (e) {
      status('Error: ' + e.message, 'error');
    } finally { state.loading = false; }
  }

  async function triggerScan () {
    status('Running scan…');
    try {
      const r = await fetch('/api/cron/scan-content', { method: 'GET' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      status(`Scanned ${data.scanned}, queued ${data.queued}, deduped ${data.deduped}`, 'ok');
      setTimeout(refresh, 600);
    } catch (e) {
      status('Scan failed (likely CRON_SECRET) — Vercel cron runs on schedule regardless.', 'error');
    }
  }

  function renderItems () {
    const host = $('#cq-items'); if (!host) return;
    const list = state.filter === 'all'
      ? state.items
      : state.items.filter(x => x.kind === state.filter);
    if (!list.length) {
      host.innerHTML = '<div class="panel"><p style="color:var(--muted);margin:0">Queue is empty for this filter. Cron runs at 06:00 UTC daily.</p></div>';
      return;
    }
    host.innerHTML = list.map(item => itemHTML(item)).join('');
  }

  function itemHTML (it) {
    const kind = KIND_LABELS[it.kind] || it.kind;
    const date = it.published_at ? new Date(it.published_at).toLocaleDateString() : '';
    return `
      <div class="panel cq-card" data-cq-id="${it.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div class="mono" style="font-size:.65rem;color:var(--muted);letter-spacing:.14em">
              ${kind.toUpperCase()} · ${escapeHTML(it.source || '—')} ${date ? '· ' + date : ''}
            </div>
            <h3 style="margin:6px 0 4px;font-family:'Space Grotesk',sans-serif;text-transform:none;letter-spacing:0;font-size:1.05rem">
              <span class="cq-view">${escapeHTML(it.title || '(untitled)')}</span>
              <input class="cq-edit" type="text" value="${escapeHTML(it.title || '')}" data-field="title" style="display:none;width:100%;padding:8px 10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit"/>
            </h3>
            <p class="cq-view" style="margin:6px 0;color:var(--fg-dim);font-size:.9rem;line-height:1.45">${escapeHTML((it.summary || '').slice(0, 400))}${(it.summary || '').length > 400 ? '…' : ''}</p>
            <textarea class="cq-edit" data-field="summary" style="display:none;width:100%;padding:8px 10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit;min-height:80px;margin:6px 0">${escapeHTML(it.summary || '')}</textarea>
            ${it.url ? `<a data-link="${escapeHTML(it.url)}" style="font-size:.78rem;color:var(--accent);cursor:pointer;text-decoration:underline">${escapeHTML(it.url)}</a>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex:0 0 auto">
            <button class="btn primary" data-act="approve">Approve</button>
            <button class="btn ghost"   data-act="edit">Edit</button>
            <button class="btn ghost"   data-act="save"  style="display:none">Save edits</button>
            <button class="btn ghost"   data-act="open">Open source ↗</button>
            <button class="btn ghost"   data-act="reject" style="border-color:var(--red);color:var(--red)">Reject</button>
          </div>
        </div>
      </div>`;
  }

  function toggleEdit (card) {
    const editing = card.dataset.editing === '1';
    card.dataset.editing = editing ? '' : '1';
    card.querySelectorAll('.cq-view').forEach(el => el.style.display = editing ? '' : 'none');
    card.querySelectorAll('.cq-edit').forEach(el => el.style.display = editing ? 'none' : '');
    card.querySelector('[data-act="save"]').style.display = editing ? 'none' : '';
    card.querySelector('[data-act="edit"]').textContent = editing ? 'Edit' : 'Cancel';
  }

  async function saveEdits (card, id) {
    const patch = {};
    card.querySelectorAll('.cq-edit').forEach(el => { patch[el.dataset.field] = el.value; });
    status('Saving…');
    try {
      const r = await fetch('/api/content/queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', id, patch })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'save failed');
      status('Saved', 'ok');
      refresh();
    } catch (e) { status('Error: ' + e.message, 'error'); }
  }

  async function approve (id) {
    if (!confirm('Approve and publish this item to the public site?')) return;
    status('Publishing…');
    try {
      const r = await fetch('/api/content/queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'approve failed');
      status('Published ✓', 'ok');
      refresh();
    } catch (e) { status('Error: ' + e.message, 'error'); }
  }

  async function reject (id) {
    if (!confirm('Drop this item from the queue?')) return;
    try {
      const r = await fetch('/api/content/queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', id })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'reject failed');
      status('Rejected', 'ok');
      refresh();
    } catch (e) { status('Error: ' + e.message, 'error'); }
  }

  function escapeHTML (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  window.ContentQueue = { render: paint };
})();
