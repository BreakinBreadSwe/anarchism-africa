/* ANARCHISM.AFRICA — Mark Lab
 *
 * Admin-only workbench for generating brand-mark variations via Gemini, saving
 * favourites to Vercel Blob, and previewing them on a t-shirt mockup. The
 * canonical mark is the anarchist circle-A overlaid on the African continent;
 * the lab produces stylistic variations — kente, glitch, brutalist, risograph,
 * gold leaf, screenprint, graffiti, woodcut, photoreal — for use across POD
 * (t-shirts, hoodies, totes, posters, mugs, stickers, books, magazines).
 *
 * Endpoints used:
 *   POST /api/ai/generate-mark   — Gemini image generation (returns base64)
 *   POST /api/blob/put-image     — saves a chosen mark + updates manifest
 *
 * Local cache:
 *   localStorage['aa.marks.recent']      — last 50 generated (not yet saved)
 *   localStorage['aa.marks.favorites']   — saved-favorite manifest mirror
 */
(function () {
  const STYLES = [
    ['random',      'Random'],
    ['classic',     'Classic two-tone'],
    ['kente',       'Kente woven'],
    ['glitch',      'Glitch / cyberpunk'],
    ['brutalist',   'Brutalist 1-bit'],
    ['risograph',   'Risograph print'],
    ['goldleaf',    'Gold leaf'],
    ['screenprint', 'Screenprint poster'],
    ['graffiti',    'Spraypaint stencil'],
    ['woodcut',     'Woodcut / linocut'],
    ['photoreal',   'Photoreal medallion']
  ];

  const RECENT_KEY = 'aa.marks.recent';
  const FAVS_KEY   = 'aa.marks.favorites';

  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  function template () {
    return `
      <div class="panel" style="margin-bottom:14px">
        <h2 style="margin:0 0 6px">Mark Lab</h2>
        <p style="color:var(--fg-dim);max-width:65ch;margin:0 0 12px">
          Generate variations of the AA mark — anarchist circle-A over the African
          continent — for t-shirts, posters, books and the rest of the merch line.
          Save the ones you like; favorites become the source of truth for POD.
          <br><span class="mono" style="color:var(--muted);font-size:.7rem">
          Requires <code>GEMINI_API_KEY</code> in Vercel env. Uses
          <code>gemini-2.5-flash-image-preview</code> by default.
          </span>
        </p>
        <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr;align-items:end">
          <label style="display:grid;gap:4px">
            <span class="mono" style="font-size:.7rem;color:var(--muted)">Style</span>
            <select id="ml-style" style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit">
              ${STYLES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </label>
          <label style="display:grid;gap:4px">
            <span class="mono" style="font-size:.7rem;color:var(--muted)">How many</span>
            <select id="ml-count" style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit">
              <option value="1">1 variant</option>
              <option value="2">2 variants</option>
              <option value="3">3 variants</option>
              <option value="4" selected>4 variants</option>
            </select>
          </label>
          <label style="display:grid;gap:4px;grid-column:1/-1">
            <span class="mono" style="font-size:.7rem;color:var(--muted)">Custom prompt (optional — overrides style)</span>
            <textarea id="ml-prompt" placeholder="e.g. circle-A over Africa with Sahel sun rays, monochrome black on cream, woodcut texture, no text"
              style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:14px;font:inherit;min-height:64px;resize:vertical"></textarea>
          </label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn primary" id="ml-go">Generate</button>
          <button class="btn ghost"   id="ml-clear-recent">Clear recent</button>
          <span id="ml-status" class="mono" style="font-size:.75rem;color:var(--muted);align-self:center"></span>
        </div>
      </div>

      <div class="panel" style="margin-bottom:14px">
        <h3 style="margin:0 0 10px">Recent generations</h3>
        <div id="ml-recent" class="ml-grid">
          <div style="color:var(--muted)">Nothing yet — hit Generate.</div>
        </div>
      </div>

      <div class="panel">
        <h3 style="margin:0 0 10px">Saved favorites <span class="mono" style="font-size:.7rem;color:var(--muted)" id="ml-fav-count"></span></h3>
        <div id="ml-favs" class="ml-grid">
          <div style="color:var(--muted)">No favorites yet. Generate a mark and tap ♥ to save it.</div>
        </div>
      </div>
    `;
  }

  function paint () {
    const root = document.getElementById('view-marklab');
    if (!root) return;
    if (!root.dataset.painted) {
      root.innerHTML = template();
      root.dataset.painted = '1';
      bind(root);
    }
    renderRecent();
    renderFavs();
  }

  function bind (root) {
    root.querySelector('#ml-go').addEventListener('click', generate);
    root.querySelector('#ml-clear-recent').addEventListener('click', () => {
      writeJSON(RECENT_KEY, []); renderRecent();
    });
    root.addEventListener('click', e => {
      const card = e.target.closest('[data-mark-idx]');
      if (!card) return;
      const idx = parseInt(card.dataset.markIdx, 10);
      const where = card.dataset.markWhere || 'recent';
      if (e.target.closest('[data-act="save"]'))     return saveFavorite(where, idx);
      if (e.target.closest('[data-act="download"]')) return download(where, idx);
      if (e.target.closest('[data-act="copy"]'))     return copyDataUrl(where, idx);
      if (e.target.closest('[data-act="remove"]'))   return removeItem(where, idx);
    });
  }

  function status (msg, kind = 'idle') {
    const el = document.querySelector('#ml-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = kind === 'error' ? 'var(--red)' : kind === 'ok' ? 'var(--green)' : 'var(--muted)';
  }

  async function generate () {
    const style  = document.querySelector('#ml-style').value;
    const count  = parseInt(document.querySelector('#ml-count').value, 10) || 1;
    const prompt = document.querySelector('#ml-prompt').value.trim();
    status('Generating ' + count + '× via Gemini…');
    try {
      const r = await fetch('/api/ai/generate-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, count, prompt: prompt || undefined })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      const list  = readJSON(RECENT_KEY, []);
      const stamp = Date.now();
      data.items.forEach((it, i) => list.unshift({ ...it, ts: stamp + i }));
      writeJSON(RECENT_KEY, list.slice(0, 50));
      status(`Generated ${data.items.length} variant${data.items.length === 1 ? '' : 's'}`, 'ok');
      renderRecent();
    } catch (e) {
      status('Error: ' + e.message, 'error');
    }
  }

  function renderRecent () {
    const list = readJSON(RECENT_KEY, []);
    const host = document.querySelector('#ml-recent');
    if (!host) return;
    if (!list.length) { host.innerHTML = '<div style="color:var(--muted)">Nothing yet — hit Generate.</div>'; return; }
    host.innerHTML = list.map((it, i) => cardHTML(it, i, 'recent')).join('');
  }

  function renderFavs () {
    const list  = readJSON(FAVS_KEY, []);
    const host  = document.querySelector('#ml-favs');
    const count = document.querySelector('#ml-fav-count');
    if (!host) return;
    if (count) count.textContent = list.length ? `· ${list.length}` : '';
    if (!list.length) { host.innerHTML = '<div style="color:var(--muted)">No favorites yet. Generate a mark and tap ♥ to save it.</div>'; return; }
    host.innerHTML = list.map((it, i) => cardHTML(it, i, 'favs')).join('');
  }

  function cardHTML (it, idx, where) {
    const src = it.url
      ? it.url
      : `data:${it.mimeType || 'image/png'};base64,${it.b64}`;
    const styleLabel = (STYLES.find(s => s[0] === it.style) || ['', it.style || 'custom'])[1];
    const dateLabel  = new Date(it.ts || it.savedAt || Date.now()).toLocaleDateString();
    const isSaved    = where === 'favs';
    return `
      <div class="ml-card" data-mark-idx="${idx}" data-mark-where="${where}">
        <div class="ml-thumb" style="background-image:url('${src}')"></div>
        <div class="ml-body">
          <div class="ml-meta"><b>${styleLabel}</b> · ${dateLabel}</div>
          <div class="ml-actions">
            ${isSaved
              ? `<button class="btn ghost" data-act="download" title="Download high-res PNG">Download</button>
                 <button class="btn ghost" data-act="copy"     title="Copy as data URL for paste-into-design tools">Copy</button>
                 <button class="btn ghost" data-act="remove"   title="Remove from favorites">Remove</button>`
              : `<button class="btn primary" data-act="save"     title="Save as favorite (uploads to Blob)">♥ Save</button>
                 <button class="btn ghost"   data-act="download" title="Download high-res PNG">Download</button>
                 <button class="btn ghost"   data-act="remove"   title="Remove from recent">Discard</button>`}
          </div>
        </div>
      </div>`;
  }

  function getItem (where, idx) {
    const list = readJSON(where === 'favs' ? FAVS_KEY : RECENT_KEY, []);
    return { list, item: list[idx] };
  }

  async function saveFavorite (where, idx) {
    const { item } = getItem(where, idx);
    if (!item || !item.b64) { status('Cannot save — no image data', 'error'); return; }
    status('Saving to Blob…');
    const key = `content/marks/${item.style || 'custom'}-${item.ts || Date.now()}.png`;
    try {
      const r = await fetch('/api/blob/put-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          b64:      item.b64,
          mimeType: item.mimeType || 'image/png',
          meta:     { style: item.style, prompt: item.prompt }
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      const favs = readJSON(FAVS_KEY, []);
      favs.unshift({ ...item, key, url: data.url, savedAt: Date.now() });
      writeJSON(FAVS_KEY, favs.slice(0, 200));
      status('Saved ✓', 'ok');
      renderFavs();
    } catch (e) {
      status('Save failed: ' + e.message, 'error');
    }
  }

  function download (where, idx) {
    const { item } = getItem(where, idx);
    if (!item) return;
    const src = item.url || `data:${item.mimeType || 'image/png'};base64,${item.b64}`;
    const a = document.createElement('a');
    a.href = src;
    a.download = `aa-mark-${item.style || 'custom'}-${item.ts || Date.now()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function copyDataUrl (where, idx) {
    const { item } = getItem(where, idx);
    if (!item) return;
    const src = item.url || `data:${item.mimeType || 'image/png'};base64,${item.b64}`;
    try { await navigator.clipboard.writeText(src); status('Copied URL', 'ok'); }
    catch { status('Copy failed', 'error'); }
  }

  function removeItem (where, idx) {
    const key = where === 'favs' ? FAVS_KEY : RECENT_KEY;
    const list = readJSON(key, []);
    list.splice(idx, 1);
    writeJSON(key, list);
    where === 'favs' ? renderFavs() : renderRecent();
  }

  // expose
  window.MarkLab = { render: paint };
})();
