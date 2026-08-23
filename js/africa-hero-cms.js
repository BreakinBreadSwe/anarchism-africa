/* ANARCHISM.AFRICA — CMS for the fullscreen Africa-shaped loading
 * screen AND the little app-logo variant in the topbar.
 *
 * Backed by /api/africa-slides for the JSON manifest + /api/africa-
 * slides/upload for user-uploaded images/videos. All persisted to
 * Vercel Blob — no filesystem writes, no committing to /media/.
 *
 * Public API: window.AfricaHeroCMS.render(container).
 */
(function () {
  'use strict';

  const ENDPOINT       = '/api/africa-slides';
  const UPLOAD_ENDPOINT= '/api/africa-slides/upload';
  const PREVIEW_URL    = '/?hero=1';

  let slides = [];
  let background = null;
  let css = defaultCss();
  let appLogo = defaultAppLogo();

  function defaultCss ()      { return { heroSize: 88, outlineWidth: 35, crossfadeMs: 4000, advanceMs: 2000, aFrequency: 6 }; }
  function defaultAppLogo ()  { return { showOutline: true, rotateMs: 4500, slides: [] }; }
  function esc (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function load () {
    try {
      const r = await fetch(ENDPOINT, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        slides     = Array.isArray(d.slides) ? d.slides : [];
        background = d.background || null;
        css        = { ...defaultCss(),     ...(d.css     || {}) };
        appLogo    = { ...defaultAppLogo(), ...(d.appLogo || {}) };
      }
    } catch {}
  }

  async function save () {
    const r = await fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slides, background, css, appLogo })
    });
    return r.ok ? { ok: true } : { ok: false, error: (await r.text()).slice(0, 200) };
  }

  // Uses @vercel/blob/client's `upload()` to stream the file DIRECTLY
  // from the browser to Vercel Blob storage. Our /api/africa-slides/
  // upload endpoint only issues a short-lived signed token — the bytes
  // never traverse the serverless function, sidestepping the 4.5 MB
  // FUNCTION_PAYLOAD_TOO_LARGE cap that blocked GIF/large-image uploads.
  //
  // Loaded lazily via ESM CDN (esm.sh) so we don't need a bundler.
  let _blobClient = null;
  async function loadBlobClient () {
    if (_blobClient) return _blobClient;
    _blobClient = await import('https://esm.sh/@vercel/blob@0.27.0/client');
    return _blobClient;
  }

  async function uploadFile (file) {
    if (!file) return { ok: false, error: 'no file' };
    try {
      const { upload } = await loadBlobClient();
      const safe = (file.name || 'upload.bin').replace(/[^\w.\-]+/g, '_').slice(0, 120);
      const key  = `africa-hero/uploads/${Date.now()}-${safe}`;
      const blob = await upload(key, file, {
        access:           'public',
        handleUploadUrl:  UPLOAD_ENDPOINT,
        contentType:      file.type || undefined
      });
      return { ok: true, url: blob.url, pathname: blob.pathname };
    } catch (e) {
      return { ok: false, error: String(e.message || e).slice(0, 200) };
    }
  }

  async function render (container) {
    if (!container) return;
    await load();
    container.innerHTML = tpl();
    wire(container);
    paintSlides(container);
    paintBg(container);
    paintCss(container);
    paintPreview(container);
    paintMediaLibrary(container);
    paintAppLogoSlides(container);
  }

  // ---- App logo slides (independent list) -----------------------------
  function paintAppLogoSlides (root) {
    const list  = root.querySelector('[data-hero-al-list]');
    const count = root.querySelector('[data-hero-al-count]');
    if (!list) return;
    const items = Array.isArray(appLogo.slides) ? appLogo.slides : [];
    count.textContent = '(' + items.length + (items.length ? ')' : ' — falling back to hero slides)');
    if (!items.length) {
      list.innerHTML = '<div style="color:var(--muted)">No app-logo slides yet — the header will use the hero list.</div>';
      return;
    }
    list.innerHTML = items.map((s, i) => `
      <div class="slide-card" data-al-idx="${i}">
        <div class="slide-preview"><img src="${esc(s.src)}" alt=""></div>
        <div class="slide-meta"><span>${esc(s.type)}</span><span>${s.duration}ms</span></div>
        <div class="slide-actions">
          <button data-hero-al-up>↑</button>
          <button data-hero-al-down>↓</button>
          <button class="danger" data-hero-al-del>Delete</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('.slide-card').forEach(card => {
      const i = Number(card.dataset.alIdx);
      card.querySelector('[data-hero-al-del]')?.addEventListener('click', async () => {
        if (!confirm('Remove this slide from the app logo?')) return;
        appLogo.slides.splice(i, 1);
        await save(); paintAppLogoSlides(root);
      });
      card.querySelector('[data-hero-al-up]')?.addEventListener('click', async () => {
        if (i <= 0) return;
        [appLogo.slides[i-1], appLogo.slides[i]] = [appLogo.slides[i], appLogo.slides[i-1]];
        await save(); paintAppLogoSlides(root);
      });
      card.querySelector('[data-hero-al-down]')?.addEventListener('click', async () => {
        if (i >= appLogo.slides.length - 1) return;
        [appLogo.slides[i], appLogo.slides[i+1]] = [appLogo.slides[i+1], appLogo.slides[i]];
        await save(); paintAppLogoSlides(root);
      });
    });
  }

  // ---- Media library ---------------------------------------------------
  async function loadMediaLibrary () {
    try {
      const r = await fetch('/api/africa-slides/media', { cache: 'no-store' });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d.items) ? d.items : [];
    } catch { return []; }
  }
  async function deleteBlobUrl (url) {
    const r = await fetch('/api/africa-slides/media?url=' + encodeURIComponent(url), { method: 'DELETE' });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200));
  }
  // Module-scoped multi-select + sort/filter state. Preserved across
  // re-renders within a session so the admin can drag through without
  // losing their view.
  const mediaSelected = new Set();
  let mediaSort   = 'newest';   // newest | oldest | az | za | size-desc | size-asc
  let mediaFilter = 'all';      // all | used | unused | dup | blob | repo | image | video

  async function paintMediaLibrary (root) {
    const grid  = root.querySelector('[data-hero-media-grid]');
    const count = root.querySelector('[data-hero-media-count]');
    if (!grid) return;
    let items = await loadMediaLibrary();
    count.textContent = '(' + items.length + ')';
    if (!items.length) { grid.innerHTML = '<div style="color:var(--muted)">No media yet — upload above.</div>'; return; }

    // Set of URLs already used as a slide src — used to grey those out
    // so admin can see at a glance what's already in the rotation.
    const usedUrls = new Set((slides || []).map(s => s?.src).filter(Boolean));

    // Group by (name+size) to detect duplicates. Same name AND same
    // byte size = same file uploaded twice. Groups of size > 1 get
    // .is-dup on every card in the group.
    const dupGroups = new Map();
    items.forEach((m) => {
      const key = ((m.name || '').toLowerCase()) + '·' + (m.size || 0);
      if (!dupGroups.has(key)) dupGroups.set(key, []);
      dupGroups.get(key).push(m);
    });
    const dupUrls = new Set();
    dupGroups.forEach(group => { if (group.length > 1) group.forEach(m => dupUrls.add(m.url)); });
    const dupCount = [...dupGroups.values()].filter(g => g.length > 1).reduce((n, g) => n + (g.length - 1), 0);

    // Parse a Unix ms timestamp out of the blob key (africa-hero/uploads/
    // <ts>-<name>). Repo /media/ files have no timestamp — fall back to 0
    // so they sort at the end of newest-first.
    const uploadTs = (m) => {
      const m2 = (m.url || '').match(/africa-hero\/uploads\/(\d{10,15})-/);
      return m2 ? Number(m2[1]) : 0;
    };
    const kindOf = (m) => (m.type === 'video') ? 'video' : (m.type === 'gif' ? 'image' : 'image');

    // Apply filter to a fresh copy so 'all' still shows everything.
    const filtered = items.filter(m => {
      switch (mediaFilter) {
        case 'used':   return usedUrls.has(m.url);
        case 'unused': return !usedUrls.has(m.url);
        case 'dup':    return dupUrls.has(m.url);
        case 'blob':   return m.source === 'blob';
        case 'repo':   return m.source === 'repo';
        case 'image':  return kindOf(m) === 'image';
        case 'video':  return kindOf(m) === 'video';
        default:       return true;
      }
    });

    // Sort in place.
    const nameSort = (a, b) => (a.name || '').localeCompare(b.name || '');
    filtered.sort((a, b) => {
      switch (mediaSort) {
        case 'oldest':    return uploadTs(a) - uploadTs(b);
        case 'az':        return nameSort(a, b);
        case 'za':        return nameSort(b, a);
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        case 'size-asc':  return (a.size || 0) - (b.size || 0);
        case 'newest':
        default:          return uploadTs(b) - uploadTs(a);
      }
    });

    // The rest of the render (cards, bindings) operates on the filtered
    // + sorted list. `items` still points at the full raw dataset.
    const displayItems = filtered;

    // Toolbar — sort / filter / bulk actions on the tick-selected items
    // + dedup button. Filter chips reflect current mediaFilter state.
    const fchips = (opts) => opts.map(([k, label]) =>
      `<button type="button" class="aa-ml-chip${mediaFilter === k ? ' is-on' : ''}" data-ml-filter="${k}">${label}</button>`
    ).join('');
    const toolbar = `
      <div class="aa-ml-toolbar">
        <div class="aa-ml-toolbar-row">
          <label class="aa-ml-selall"><input type="checkbox" data-ml-selall><span>Select all (visible)</span></label>
          <span class="aa-ml-sel-count" data-ml-sel-count>0 selected</span>
          <span style="flex:1"></span>
          <button type="button" class="btn" data-ml-bulk-add title="Add every selected item as a new slide">+ Add ${mediaSelected.size ? '(' + mediaSelected.size + ')' : ''} to slides</button>
          <button type="button" class="btn" data-ml-bulk-remove title="Remove every selected item from the slideshow">− Remove from slides</button>
          <button type="button" class="btn" data-ml-bulk-download title="Download every selected file">↓ Download</button>
          <button type="button" class="btn ghost" data-ml-dedup title="Find and remove duplicate uploads (same filename + size)">Find doubles${dupCount ? ' (' + dupCount + ')' : ''}</button>
          <button type="button" class="btn danger" data-ml-bulk-del title="Delete every selected item permanently (blob) or hide (repo)">Delete selected</button>
        </div>
        <div class="aa-ml-toolbar-row aa-ml-toolbar-sf">
          <span class="aa-ml-toolbar-label">Filter</span>
          ${fchips([
            ['all',    `All (${items.length})`],
            ['used',   `In slideshow`],
            ['unused', `Not in slideshow`],
            ['dup',    `Duplicates${dupCount ? ' (' + dupCount + ')' : ''}`],
            ['image',  `Images`],
            ['video',  `Videos`],
            ['blob',   `Uploaded`],
            ['repo',   `Repo /media/`]
          ])}
          <span style="flex:1"></span>
          <label class="aa-ml-sortbox">Sort
            <select data-ml-sort>
              <option value="newest"    ${mediaSort==='newest'?'selected':''}>Newest first</option>
              <option value="oldest"    ${mediaSort==='oldest'?'selected':''}>Oldest first</option>
              <option value="az"        ${mediaSort==='az'?'selected':''}>Name A → Z</option>
              <option value="za"        ${mediaSort==='za'?'selected':''}>Name Z → A</option>
              <option value="size-desc" ${mediaSort==='size-desc'?'selected':''}>Largest first</option>
              <option value="size-asc"  ${mediaSort==='size-asc'?'selected':''}>Smallest first</option>
            </select>
          </label>
        </div>
      </div>`;

    if (!displayItems.length) {
      grid.innerHTML = toolbar + `<div style="grid-column:1/-1;color:var(--muted);padding:24px;text-align:center">No media matches the current filter.</div>`;
      wireToolbar();
      return;
    }
    grid.innerHTML = toolbar + displayItems.map((m, i) => {
      const used = usedUrls.has(m.url);
      const dup  = dupUrls.has(m.url);
      const sel  = mediaSelected.has(m.url);
      const cls  = ['slide-card', used ? 'is-used' : '', dup ? 'is-dup' : '', sel ? 'is-sel' : ''].filter(Boolean).join(' ');
      return `
      <div class="${cls}" data-media-idx="${i}" data-media-url="${esc(m.url)}" data-media-source="${esc(m.source)}">
        <label class="aa-ml-pick"><input type="checkbox" data-media-pick ${sel ? 'checked' : ''}></label>
        ${used ? '<span class="aa-ml-badge used" title="Already in the slideshow">In use</span>' : ''}
        ${dup  ? '<span class="aa-ml-badge dup"  title="Same name+size as another upload">Double</span>' : ''}
        <div class="slide-preview">${
          m.type === 'video'
            ? `<video src="${esc(m.url)}" muted loop autoplay playsinline></video>`
            : `<img src="${esc(m.url)}" alt="">`
        }</div>
        <div class="slide-meta">
          <span title="${esc(m.name)}">${esc(m.name.length > 22 ? m.name.slice(0,20)+'…' : m.name)}</span>
          <span>${m.source}${m.size ? ' · ' + fmtSize(m.size) : ''}</span>
        </div>
        <div class="slide-actions">
          <button data-media-add ${used ? 'title="Already in slideshow — click to add another copy"' : ''}>+ Slide</button>
          <button data-media-dl title="Download this file">↓</button>
          <button class="danger" data-media-del title="${m.source === 'blob' ? 'Delete this blob upload permanently' : 'Hide this /media/ file from the library (file stays in the repo — commit a git remove to delete for real)'}">${m.source === 'blob' ? 'Del' : 'Hide'}</button>
        </div>
      </div>`;
    }).join('');

    const paintSelCount = () => {
      const el = grid.querySelector('[data-ml-sel-count]');
      if (el) el.textContent = `${mediaSelected.size} selected`;
      const addBtn = grid.querySelector('[data-ml-bulk-add]');
      if (addBtn) addBtn.textContent = `+ Add${mediaSelected.size ? ' (' + mediaSelected.size + ')' : ''} to slides`;
    };
    paintSelCount();

    // Filter chips + sort — bind once (also used by the empty-state branch).
    function wireToolbar () {
      grid.querySelectorAll('[data-ml-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          mediaFilter = btn.dataset.mlFilter;
          paintMediaLibrary(root);
        });
      });
      const sortSel = grid.querySelector('[data-ml-sort]');
      sortSel?.addEventListener('change', () => {
        mediaSort = sortSel.value;
        paintMediaLibrary(root);
      });
    }
    wireToolbar();

    // Toolbar actions ----
    grid.querySelector('[data-ml-selall]')?.addEventListener('change', (e) => {
      const on = e.target.checked;
      // 'Select all' operates on VISIBLE items only (respects filter).
      grid.querySelectorAll('[data-media-pick]').forEach(cb => {
        cb.checked = on;
        const url = cb.closest('.slide-card').dataset.mediaUrl;
        if (on) mediaSelected.add(url); else mediaSelected.delete(url);
        cb.closest('.slide-card').classList.toggle('is-sel', on);
      });
      paintSelCount();
    });
    grid.querySelector('[data-ml-bulk-add]')?.addEventListener('click', async () => {
      const picked = items.filter(m => mediaSelected.has(m.url));
      if (!picked.length) { alert('No items selected.'); return; }
      picked.forEach(m => slides.push({ type: m.type, src: m.url, duration: css.advanceMs || 2000 }));
      const r = await save();
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      mediaSelected.clear();
      paintSlides(root);
      paintPreview(root);
      await paintMediaLibrary(root);
    });
    grid.querySelector('[data-ml-bulk-remove]')?.addEventListener('click', async () => {
      const picked = new Set([...mediaSelected]);
      if (!picked.size) { alert('No items selected.'); return; }
      const before = slides.length;
      slides = slides.filter(s => !picked.has(s.src));
      if (slides.length === before) { alert('Selected items are not in the slideshow.'); return; }
      const r = await save();
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      paintSlides(root);
      paintPreview(root);
      await paintMediaLibrary(root);
    });
    grid.querySelector('[data-ml-bulk-download]')?.addEventListener('click', () => {
      const picked = items.filter(m => mediaSelected.has(m.url));
      if (!picked.length) { alert('No items selected.'); return; }
      picked.forEach(m => triggerDownload(m.url, m.name));
    });
    grid.querySelector('[data-ml-bulk-del]')?.addEventListener('click', async () => {
      const picked = items.filter(m => mediaSelected.has(m.url));
      if (!picked.length) { alert('No items selected.'); return; }
      if (!confirm(`Delete/hide ${picked.length} item${picked.length !== 1 ? 's' : ''}? Blob uploads are permanent; /media/ files are soft-hidden (git remove to fully delete).`)) return;
      for (const m of picked) {
        try { await deleteBlobUrl(m.url); } catch (e) { console.warn('del failed', m.url, e); }
      }
      mediaSelected.clear();
      await paintMediaLibrary(root);
    });
    grid.querySelector('[data-ml-dedup]')?.addEventListener('click', async () => {
      // For every group with >1 items, keep the OLDEST (first-encountered)
      // and delete the rest. Only touches blob uploads — repo files
      // (git-tracked) stay put.
      const toDelete = [];
      dupGroups.forEach(group => {
        if (group.length <= 1) return;
        // Sort by name so timestamped uploads stay in a stable order,
        // then keep [0], delete [1..].
        group.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        for (let i = 1; i < group.length; i++) if (group[i].source === 'blob') toDelete.push(group[i]);
      });
      if (!toDelete.length) { alert(dupCount ? 'Duplicates are all /media/ repo files — remove those with a git commit.' : 'No duplicates found.'); return; }
      if (!confirm(`Found ${toDelete.length} duplicate blob upload${toDelete.length !== 1 ? 's' : ''}. Delete the extras? (Keeps the alphabetically-first copy of each group.)`)) return;
      for (const m of toDelete) {
        try { await deleteBlobUrl(m.url); } catch (e) { console.warn('del failed', m.url, e); }
      }
      await paintMediaLibrary(root);
    });

    // Row bindings ----
    grid.querySelectorAll('.slide-card').forEach(card => {
      const url = card.dataset.mediaUrl;
      card.querySelector('[data-media-pick]')?.addEventListener('change', (e) => {
        if (e.target.checked) mediaSelected.add(url); else mediaSelected.delete(url);
        card.classList.toggle('is-sel', e.target.checked);
        paintSelCount();
      });
      card.querySelector('[data-media-add]')?.addEventListener('click', async () => {
        const item = items.find(x => x.url === url); if (!item) return;
        slides.push({ type: item.type, src: url, duration: css.advanceMs || 2000 });
        const r = await save();
        if (!r.ok) { alert('Save failed: ' + r.error); return; }
        paintSlides(root);
        paintPreview(root);
        await paintMediaLibrary(root);
      });
      card.querySelector('[data-media-dl]')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const item = items.find(x => x.url === url); if (!item) return;
        triggerDownload(item.url, item.name);
      });
      card.querySelector('[data-media-del]')?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const src = card.dataset.mediaSource;
        const prompt = src === 'blob'
          ? 'Delete this blob upload permanently? (Irreversible)'
          : 'Hide this /media/ file from the library?\n\nFile stays in the git repo — this only removes it from the CMS and hero rotation. To delete for real, commit a git remove.';
        if (!confirm(prompt)) return;
        try {
          await deleteBlobUrl(url);
          mediaSelected.delete(url);
          await paintMediaLibrary(root);
        } catch (e) { alert('Delete failed: ' + e.message); }
      });
      card.querySelector('.slide-preview')?.addEventListener('click', () => {
        const idx = items.findIndex(x => x.url === url);
        if (idx >= 0) openLightbox(items, idx, root);
      });
    });
  }

  // Kick off a browser download for a URL. Uses <a download> hint — for
  // cross-origin blob URLs the browser may still open in a new tab
  // depending on the response headers, but that's fine for our case.
  function triggerDownload (url, filename) {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || (url.split('/').pop() || 'download');
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { window.open(url, '_blank'); }
  }

  // ---- Fullscreen lightbox --------------------------------------------
  // Opens over everything, keyboard (← → Esc Del) + swipe navigation,
  // per-media delete button that hits /api/africa-slides/media and
  // refreshes the surrounding grid.
  function openLightbox (items, startIdx, root) {
    if (!items?.length) return;
    let idx = Math.max(0, Math.min(startIdx, items.length - 1));
    // Kill any prior instance
    document.getElementById('aa-lightbox')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'aa-lightbox';
    overlay.className = 'aa-lightbox';
    overlay.innerHTML = `
      <button class="aa-lb-close"  aria-label="Close">×</button>
      <button class="aa-lb-prev"   aria-label="Previous">‹</button>
      <button class="aa-lb-next"   aria-label="Next">›</button>
      <div    class="aa-lb-stage"></div>
      <div    class="aa-lb-meta"></div>
      <button class="aa-lb-del"    aria-label="Delete or hide this media"></button>
    `;
    document.body.appendChild(overlay);
    const stage = overlay.querySelector('.aa-lb-stage');
    const meta  = overlay.querySelector('.aa-lb-meta');
    const delBtn= overlay.querySelector('.aa-lb-del');

    function paint () {
      const m = items[idx];
      stage.innerHTML = m.type === 'video'
        ? `<video src="${esc(m.url)}" controls autoplay muted loop playsinline></video>`
        : `<img    src="${esc(m.url)}" alt="${esc(m.name)}">`;
      meta.textContent  = `${idx + 1} / ${items.length}  ·  ${m.name}  ·  ${m.source}${m.size ? ' · ' + fmtSize(m.size) : ''}`;
      delBtn.disabled   = false;
      delBtn.textContent = m.source === 'blob' ? 'Delete permanently' : 'Hide from library';
      delBtn.title       = m.source === 'blob'
        ? 'Delete this blob upload permanently'
        : 'Hide from library. File stays in /media/ — commit a git remove to delete for real.';
      delBtn.style.opacity = '1';
    }
    function step (dir) {
      idx = (idx + dir + items.length) % items.length;
      paint();
    }
    function close () {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey (e) {
      if (e.key === 'ArrowRight')     { e.preventDefault(); step(+1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'Escape')    { e.preventDefault(); close(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delBtn.click(); }
    }
    overlay.querySelector('.aa-lb-prev' ).addEventListener('click', () => step(-1));
    overlay.querySelector('.aa-lb-next' ).addEventListener('click', () => step(+1));
    overlay.querySelector('.aa-lb-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    // Touch swipe
    let sx = 0, sy = 0;
    stage.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? +1 : -1);
    });
    // Delete or hide — server routes /media/ to soft-hide, blobs to real delete
    delBtn.addEventListener('click', async () => {
      const m = items[idx];
      const prompt = m.source === 'blob'
        ? `Delete ${m.name} permanently? (Irreversible)`
        : `Hide ${m.name} from the library?\n\nFile stays in the git repo — this only removes it from the CMS and hero rotation.`;
      if (!confirm(prompt)) return;
      try {
        await deleteBlobUrl(m.url);
        items.splice(idx, 1);
        if (!items.length) { close(); await paintMediaLibrary(root); return; }
        if (idx >= items.length) idx = items.length - 1;
        paint();
        await paintMediaLibrary(root);
      } catch (e) { alert('Delete failed: ' + e.message); }
    });
    paint();
  }
  function fmtSize (bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  // ---- template ---------------------------------------------------------
  function tpl () {
    return `
      <div class="panel">
        <h2 style="margin:0 0 4px">Logo &amp; Hero · CMS + CSS</h2>
        <p style="color:var(--fg-dim);max-width:75ch;margin:0 0 10px;font-size:.86rem">
          Two africa surfaces share this admin page — <b>each has its own
          slide list and its own settings</b>, so changing one never
          touches the other:
        </p>
        <ul style="color:var(--fg-dim);max-width:75ch;margin:0 0 12px 18px;font-size:.82rem;line-height:1.55">
          <li><b>Fullscreen hero</b> — the big africa on the home page.
              Uses the detailed outline (with the interior lakes visible).</li>
          <li><b>Top-left app logo</b> — the tiny 40px africa in every
              page's header. Uses a bolder, cleaner outline with the
              interior lakes removed for legibility at small size.</li>
        </ul>
        <p style="color:var(--fg-dim);max-width:75ch;margin:0 0 14px;font-size:.82rem">
          All content stored in Vercel Blob. Uploads stream direct from
          your machine (up to 500 MB/file). Autosave: sliders and text
          fields save 700 ms after the last edit — watch the status pill
          next to each Save button. Live preview iframe below.
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-hero-preview>Open fullscreen preview</button>
          <button class="btn ghost" data-hero-reload>Reload from server</button>
        </div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 4px">Fullscreen hero — appearance &amp; timing</h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 12px;font-size:.78rem">
          Controls the BIG africa on the home page: its size relative to
          the viewport, coast-stroke thickness, and how the slideshow
          cross-fades and advances between images.
        </p>
        <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
          <label class="cms-slider">
            <span class="cms-slider-head">Africa size
              <input type="number" min="40" max="100" step="1" class="cms-num" data-hero-css-num="heroSize" />
              <span class="cms-slider-unit">%</span>
            </span>
            <input type="range" min="40" max="100" step="1" data-hero-css="heroSize" />
          </label>
          <label class="cms-slider">
            <span class="cms-slider-head">Outline stroke
              <input type="number" min="1" max="80" step="1" class="cms-num" data-hero-css-num="outlineWidth" />
            </span>
            <input type="range" min="1" max="80" step="1" data-hero-css="outlineWidth" />
          </label>
          <label class="cms-slider">
            <span class="cms-slider-head">Crossfade
              <input type="number" min="200" max="10000" step="100" class="cms-num" data-hero-css-num="crossfadeMs" />
              <span class="cms-slider-unit">ms</span>
            </span>
            <input type="range" min="200" max="10000" step="100" data-hero-css="crossfadeMs" />
          </label>
          <label class="cms-slider">
            <span class="cms-slider-head">Big-A every N slides
              <input type="number" min="1" max="50" step="1" class="cms-num" data-hero-css-num="aFrequency" />
            </span>
            <input type="range" min="1" max="50" step="1" data-hero-css="aFrequency" />
          </label>
          <label class="cms-slider">
            <span class="cms-slider-head">Advance
              <input type="number" min="500" max="30000" step="100" class="cms-num" data-hero-css-num="advanceMs" />
              <span class="cms-slider-unit">ms</span>
            </span>
            <input type="range" min="500" max="30000" step="100" data-hero-css="advanceMs" />
          </label>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" data-hero-css-save title="Save immediately (also auto-saves 700ms after your last edit)">Save now</button>
          <button class="btn ghost" data-hero-css-reset>Reset defaults</button>
          <span class="aa-cms-status" data-hero-cms-status></span>
        </div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 4px">Top-left app logo — appearance &amp; timing</h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 12px;font-size:.78rem">
          Controls the tiny 40px africa in the header of every page.
          Uses the bolder outline variant (interior lakes removed for
          legibility at small size). Set the mini-slideshow's rotation
          rate here; the images themselves go in the panel just below.
        </p>
        <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
          <label class="cms-slider">
            <span class="cms-slider-head">Slideshow rotation
              <input type="number" min="1000" max="60000" step="500" class="cms-num" data-hero-al-num="rotateMs" />
              <span class="cms-slider-unit">ms</span>
            </span>
            <input type="range" min="1000" max="60000" step="500" data-hero-al="rotateMs" />
          </label>
          <label style="display:flex;gap:8px;align-items:center">
            <input type="checkbox" data-hero-al="showOutline" />
            Show africa outline stroke
          </label>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
          <button class="btn" data-hero-al-save title="Save immediately (also auto-saves 700ms after your last edit)">Save now</button>
          <span style="color:var(--fg-dim);font-size:.72rem">Auto-saves as you edit — status pill above</span>
        </div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 4px">Top-left app logo — slideshow <span style="color:var(--fg-dim);font-weight:400" data-hero-al-count></span></h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 12px;font-size:.78rem">
          Independent slide list that cycles INSIDE the tiny header
          africa. Images and GIFs only — mp4/video can't render at 40px.
          <br>Empty list → the header falls back to the fullscreen hero's
          rotation (below), so you're never stuck with a blank icon.
        </p>
        <form class="aa-slide-form" data-hero-al-add>
          <label>Type
            <select name="type">
              <option value="image">image</option>
              <option value="gif">gif</option>
            </select>
          </label>
          <label class="wide">URL
            <input name="value" placeholder="https://…/img.jpg or upload →" />
          </label>
          <label>Upload<input type="file" data-hero-al-file accept="image/*" /></label>
          <button type="submit">Add</button>
        </form>
        <div class="aa-slides-cms" data-hero-al-list style="margin-top:10px"><div style="color:var(--muted)">Loading…</div></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 4px">Fullscreen hero — outside-africa background</h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 12px;font-size:.78rem">
          The layer BEHIND the big africa on the home page — everything
          around the continent. Solid colour, image, GIF, video, or an
          embedded iframe. Solid black by default.
        </p>
        <form class="aa-slide-form" data-hero-bg>
          <label>Type
            <select name="type">
              <option value="color">colour</option>
              <option value="image">image</option>
              <option value="gif">gif</option>
              <option value="video">video / mp4</option>
              <option value="iframe">iframe</option>
            </select>
          </label>
          <label class="wide">Value
            <input name="value" placeholder="#000000, https://…/img.jpg, https://youtube.com/embed/…" />
          </label>
          <label>&nbsp;<input type="file" data-hero-bg-file accept="image/*,video/*" /></label>
          <button type="submit">Save background</button>
        </form>
        <div data-hero-bg-current style="margin-top:8px;font-size:.75rem;color:var(--fg-dim)"></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 4px">Fullscreen hero — add slide</h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 12px;font-size:.78rem">
          Push a new slide onto the BIG hero's rotation. Text, image, GIF,
          video, or iframe. Duration is per-slide (ms). For the app-logo
          slideshow, use the top panel instead.
        </p>
        <form class="aa-slide-form" data-hero-add>
          <label>Type
            <select name="type">
              <option value="text">text</option>
              <option value="image">image</option>
              <option value="gif">gif</option>
              <option value="video">video / mp4</option>
              <option value="iframe">iframe</option>
            </select>
          </label>
          <label class="wide">Text / URL
            <input name="value" placeholder="Slogan for text, https://… for media, or upload →" />
          </label>
          <label>Upload<input type="file" data-hero-slide-file accept="image/*,video/*" /></label>
          <label>Duration (ms)<input name="duration" type="number" min="500" step="100" value="3500" /></label>
          <button type="submit">Add</button>
        </form>
        <div data-hero-add-status style="margin-top:6px;font-size:.72rem;color:var(--fg-dim)"></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 4px">Fullscreen hero — current slides <span style="color:var(--fg-dim);font-weight:400" data-hero-count></span></h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 12px;font-size:.78rem">
          Everything the big home-page hero cycles through, in load order
          (the site itself shuffles them on every visit). Reorder, remove,
          or open the fullscreen editor per slide.
        </p>
        <div class="aa-slides-cms" data-hero-list><div style="color:var(--muted)">Loading…</div></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 4px">Media library <span style="color:var(--fg-dim);font-weight:400" data-hero-media-count></span></h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 12px;font-size:.78rem">
          Every image / GIF / video available to the site — anything you
          upload here, plus the files committed under <code>/media/</code>
          in the repo. Filter, sort, multi-select, bulk-add to the hero,
          find duplicates, download, delete.
          <br><b>Uploaded</b> files can be deleted permanently. <b>Repo</b>
          files are read-only — a git commit is the only way to remove them.
        </p>
        <div style="display:flex;gap:8px;align-items:center;margin:0 0 10px;flex-wrap:wrap">
          <label class="btn" style="cursor:pointer;margin:0">
            + Upload files (multi-select)
            <input type="file" data-hero-media-multi multiple accept="image/*,video/*" style="display:none" />
          </label>
          <span data-hero-media-upload-status style="font-size:.78rem;color:var(--fg-dim)"></span>
        </div>
        <div class="aa-slides-cms" data-hero-media-grid><div style="color:var(--muted)">Loading…</div></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 4px">Live preview</h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 10px;font-size:.78rem">
          The home page rendered live below. Refreshes on save (autosave
          fires 700 ms after your last edit).
        </p>
        <iframe data-hero-preview-iframe src="${PREVIEW_URL}"
                style="width:100%;height:88vh;border:1px solid var(--line);border-radius:10px;background:#000"
                title="Africa hero live preview"></iframe>
      </div>
    `;
  }

  // ---- wire event handlers ---------------------------------------------
  function wire (root) {
    // Fullscreen preview button — opens hero in a new tab.
    root.querySelector('[data-hero-preview]').addEventListener('click', () => {
      if (window.AA?.hero) window.AA.hero.reload();
      else window.open(PREVIEW_URL, '_blank');
    });
    root.querySelector('[data-hero-reload]').addEventListener('click', () => render(root));

    // Autosave: any change to css/appLogo state schedules a save 700ms
    // after the last edit. A small status pill next to the Save button
    // shows 'Saving…' / 'Saved ✓' / 'Failed'. Manual Save button still
    // works and cancels the pending debounce (immediate save).
    let saveTimer = null;
    function status (msg, cls) {
      const el = root.querySelector('[data-hero-cms-status]');
      if (!el) return;
      el.textContent = msg;
      el.className = 'aa-cms-status' + (cls ? ' ' + cls : '');
    }
    async function autosave () {
      status('Saving…', 'busy');
      const r = await save();
      if (r.ok) { status('Saved ✓', 'ok'); paintPreview(root); }
      else      { status('Save failed: ' + (r.error || 'unknown'), 'err'); }
      setTimeout(() => { if (root.querySelector('.aa-cms-status.ok')) status('', ''); }, 2200);
    }
    function scheduleSave () {
      if (saveTimer) clearTimeout(saveTimer);
      status('Editing…', 'dirty');
      saveTimer = setTimeout(() => { saveTimer = null; autosave(); }, 700);
    }
    // Expose for other blocks (app-logo, add-slide) to reuse.
    root.__aaScheduleSave = scheduleSave;
    root.__aaAutosaveNow  = () => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } return autosave(); };

    // ---- CSS sliders + companion number inputs ----
    root.querySelectorAll('[data-hero-css]').forEach(input => {
      input.addEventListener('input', () => {
        css[input.dataset.heroCss] = Number(input.value);
        paintCssLabels(root);
        scheduleSave();
      });
    });
    root.querySelectorAll('[data-hero-css-num]').forEach(num => {
      const commit = () => {
        const key = num.dataset.heroCssNum;
        const min = Number(num.min), max = Number(num.max);
        let v = Number(num.value);
        if (!Number.isFinite(v)) return;
        if (Number.isFinite(min)) v = Math.max(min, v);
        if (Number.isFinite(max)) v = Math.min(max, v);
        css[key] = v;
        paintCssLabels(root);
        scheduleSave();
      };
      num.addEventListener('input', commit);
      num.addEventListener('change', commit);
    });
    root.querySelector('[data-hero-css-save]').addEventListener('click', () => root.__aaAutosaveNow?.());
    root.querySelector('[data-hero-css-reset]').addEventListener('click', async () => {
      css = defaultCss();
      paintCss(root);
      await root.__aaAutosaveNow?.();
    });

    // ---- App-logo sliders + companion number inputs (autosaved too) ----
    root.querySelectorAll('[data-hero-al]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.heroAl;
        appLogo[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
        paintAlLabels(root);
        root.__aaScheduleSave?.();
      });
    });
    root.querySelectorAll('[data-hero-al-num]').forEach(num => {
      const commit = () => {
        const key = num.dataset.heroAlNum;
        const min = Number(num.min), max = Number(num.max);
        let v = Number(num.value);
        if (!Number.isFinite(v)) return;
        if (Number.isFinite(min)) v = Math.max(min, v);
        if (Number.isFinite(max)) v = Math.min(max, v);
        appLogo[key] = v;
        paintAlLabels(root);
        root.__aaScheduleSave?.();
      };
      num.addEventListener('input', commit);
      num.addEventListener('change', commit);
    });
    root.querySelector('[data-hero-al-save]').addEventListener('click', () => root.__aaAutosaveNow?.());
    // ---- App-logo add-slide form + upload ----
    const alAdd = root.querySelector('[data-hero-al-add]');
    const alFileInput = root.querySelector('[data-hero-al-file]');
    alFileInput?.addEventListener('change', async () => {
      const f = alFileInput.files?.[0]; if (!f) return;
      const up = await uploadFile(f);
      if (!up.ok) { alert('Upload failed: ' + up.error); return; }
      alAdd.value.value = up.url;
      alAdd.type.value  = f.type === 'image/gif' ? 'gif' : 'image';
    });
    alAdd?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = alAdd.type.value;
      const value = alAdd.value.value.trim();
      if (!value) return;
      appLogo.slides = Array.isArray(appLogo.slides) ? appLogo.slides : [];
      appLogo.slides.push({ type, src: value, duration: appLogo.rotateMs || 4500 });
      const r = await save();
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      alAdd.reset();
      paintAppLogoSlides(root);
    });

    // ---- Media library: multi-file bulk upload ----
    // Accepts N files, uploads with concurrency=3 to stay under Vercel's
    // per-request timeout while still being faster than serial. Progress
    // renders inline; on completion, repaint the media grid so the new
    // items show up without a page reload.
    const multiInput  = root.querySelector('[data-hero-media-multi]');
    const multiStatus = root.querySelector('[data-hero-media-upload-status]');
    multiInput?.addEventListener('change', async () => {
      const files = Array.from(multiInput.files || []);
      if (!files.length) return;
      multiStatus.textContent = `Uploading 0/${files.length}…`;
      let done = 0, failed = 0;
      const CONCURRENCY = 3;
      let cursor = 0;
      async function worker () {
        while (cursor < files.length) {
          const my = cursor++;
          const f = files[my];
          const up = await uploadFile(f);
          if (!up.ok) failed++;
          done++;
          multiStatus.textContent = `Uploaded ${done}/${files.length}${failed ? ` · ${failed} failed` : ''}…`;
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
      multiStatus.textContent = `Done · ${done - failed} uploaded${failed ? ` · ${failed} failed` : ''}.`;
      multiInput.value = '';   // reset input so re-selecting the same files re-fires change
      await paintMediaLibrary(root);
      setTimeout(() => { if (multiStatus) multiStatus.textContent = ''; }, 4000);
    });

    // ---- Add slide ----
    const addForm = root.querySelector('[data-hero-add]');
    const addStatus = root.querySelector('[data-hero-add-status]');
    const slideFileInput = root.querySelector('[data-hero-slide-file]');
    slideFileInput.addEventListener('change', async () => {
      const f = slideFileInput.files?.[0]; if (!f) return;
      addStatus.textContent = 'Uploading ' + f.name + '…';
      const up = await uploadFile(f);
      if (!up.ok) { addStatus.textContent = 'Upload failed: ' + up.error; return; }
      addForm.value.value = up.url;
      addForm.type.value  = f.type.startsWith('video/') ? 'video' : (f.type === 'image/gif' ? 'gif' : 'image');
      addStatus.textContent = 'Uploaded → ' + up.url;
    });
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = addForm.type.value;
      const value = addForm.value.value.trim();
      const duration = Math.max(500, Number(addForm.duration.value) || 3500);
      if (!value) return;
      const slide = { type, duration };
      if (type === 'text') slide.text = value; else slide.src = value;
      slides.push(slide);
      const r = await save();
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      addForm.reset();
      addForm.duration.value = 3500;
      paintSlides(root);
      paintPreview(root);
    });

    // ---- Background ----
    const bgForm = root.querySelector('[data-hero-bg]');
    const bgFileInput = root.querySelector('[data-hero-bg-file]');
    bgFileInput.addEventListener('change', async () => {
      const f = bgFileInput.files?.[0]; if (!f) return;
      const up = await uploadFile(f);
      if (!up.ok) { alert('Upload failed: ' + up.error); return; }
      bgForm.value.value = up.url;
      bgForm.type.value  = f.type.startsWith('video/') ? 'video' : (f.type === 'image/gif' ? 'gif' : 'image');
    });
    bgForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bg = { type: bgForm.type.value, value: bgForm.value.value.trim() };
      background = bg.value ? bg : null;
      const r = await save();
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      paintBg(root);
      paintPreview(root);
    });

    cmsRoot = root;    // used by openSlideEditor to re-paint after save/delete
    // ---- Slide list actions (up/down/delete/center) ----
    const listEl = root.querySelector('[data-hero-list]');
    listEl.addEventListener('click', async (e) => {
      const card = e.target.closest('.slide-card'); if (!card) return;
      const i = Number(card.dataset.idx);
      // Click on the preview thumb (not on an action button) → open
      // the fullscreen slide editor. Media slides get drag/zoom
      // controls; text/A slides just show the preview.
      if (e.target.closest('.slide-preview') && !e.target.closest('button')) {
        openSlideEditor(i);
        return;
      }
      let changed = false;
      if (e.target.matches('[data-hero-del]')) {
        if (!confirm('Delete this slide?')) return;
        slides.splice(i, 1); changed = true;
      } else if (e.target.matches('[data-hero-up]') && i > 0) {
        [slides[i-1], slides[i]] = [slides[i], slides[i-1]]; changed = true;
      } else if (e.target.matches('[data-hero-down]') && i < slides.length - 1) {
        [slides[i], slides[i+1]] = [slides[i+1], slides[i]]; changed = true;
      } else if (e.target.matches('[data-hero-edit]')) {
        const focal = card.querySelector('[data-hero-focal]');
        if (focal) focal.style.display = (focal.style.display === 'none' ? 'block' : 'none');
        return;
      } else if (e.target.matches('[data-focal-reset]')) {
        delete slides[i].focalX; delete slides[i].focalY; delete slides[i].zoom;
        changed = true;
      } else if (e.target.matches('[data-focal-save]')) {
        const focal = card.querySelector('[data-hero-focal]'); if (!focal) return;
        const fx = Number(focal.querySelector('[data-focal="focalX"]').value);
        const fy = Number(focal.querySelector('[data-focal="focalY"]').value);
        const zm = Number(focal.querySelector('[data-focal="zoom"]').value);
        slides[i].focalX = fx; slides[i].focalY = fy; slides[i].zoom = zm;
        changed = true;
      }
      if (changed) {
        const r = await save();
        if (!r.ok) { alert('Save failed: ' + r.error); return; }
        paintSlides(root);
        paintPreview(root);
      }
    });
    // Live-update the preview inside the card as sliders move
    listEl.addEventListener('input', (e) => {
      if (!e.target.matches('[data-focal]')) return;
      const card = e.target.closest('.slide-card');
      const focal = card.querySelector('[data-hero-focal]');
      const fx = focal.querySelector('[data-focal="focalX"]').value;
      const fy = focal.querySelector('[data-focal="focalY"]').value;
      const zm = focal.querySelector('[data-focal="zoom"]').value;
      focal.querySelector('[data-focal-val="focalX"]').textContent = fx + '%';
      focal.querySelector('[data-focal-val="focalY"]').textContent = fy + '%';
      focal.querySelector('[data-focal-val="zoom"]').textContent   = zm + '%';
      const media = card.querySelector('.slide-preview img, .slide-preview video');
      if (media) {
        media.style.objectPosition = fx + '% ' + fy + '%';
        media.style.transform      = 'scale(' + (Number(zm) / 100) + ')';
        media.style.transformOrigin= fx + '% ' + fy + '%';
      }
    });
  }

  // ---- paint helpers ----------------------------------------------------
  function paintSlides (root) {
    const list  = root.querySelector('[data-hero-list]');
    const count = root.querySelector('[data-hero-count]');
    count.textContent = '(' + slides.length + ')';
    if (!slides.length) { list.innerHTML = '<div style="color:var(--muted)">No slides yet — add one above.</div>'; return; }
    list.innerHTML = slides.map(cardHtml).join('');
  }
  // Wired below to make the whole slide-card open the Slide Editor.
  let cmsRoot = null;
  function cardHtml (s, i) {
    const isMedia = s.type !== 'text' && s.type !== 'a';
    const fx = Number.isFinite(+s.focalX) ? +s.focalX : 50;
    const fy = Number.isFinite(+s.focalY) ? +s.focalY : 50;
    const zm = Number.isFinite(+s.zoom)   ? +s.zoom   : 100;
    const mediaStyle = `object-position:${fx}% ${fy}%;transform:scale(${(zm/100).toFixed(2)});transform-origin:${fx}% ${fy}%;`;
    const preview = s.type === 'text' || s.type === 'a'
      ? esc(s.text || '')
      : (s.type === 'video' || s.type === 'mp4')
        ? `<video src="${esc(s.src)}" muted loop autoplay playsinline style="${mediaStyle}"></video>`
        : `<img src="${esc(s.src)}" alt="" style="${mediaStyle}">`;
    return `<div class="slide-card" data-idx="${i}">
      <div class="slide-preview">${preview}</div>
      <div class="slide-meta"><span>${esc(s.type)}</span><span>${s.duration}ms</span></div>
      <div class="slide-actions">
        <button data-hero-up>↑</button>
        <button data-hero-down>↓</button>
        ${isMedia ? '<button data-hero-edit>Center…</button>' : ''}
        <button class="danger" data-hero-del>Delete</button>
      </div>
      ${isMedia ? `<div class="slide-focal" data-hero-focal hidden style="display:none;grid-column:1/-1;padding:10px;background:var(--bg-2);border-radius:8px;margin-top:6px;font-size:.75rem">
        <div style="display:grid;gap:8px;grid-template-columns:60px 1fr 40px">
          <label>H focal</label><input type="range" min="0" max="100" step="1" value="${fx}" data-focal="focalX"><span data-focal-val="focalX">${fx}%</span>
          <label>V focal</label><input type="range" min="0" max="100" step="1" value="${fy}" data-focal="focalY"><span data-focal-val="focalY">${fy}%</span>
          <label>Zoom</label>  <input type="range" min="100" max="400" step="5" value="${zm}" data-focal="zoom"><span data-focal-val="zoom">${zm}%</span>
        </div>
        <div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end">
          <button data-focal-reset>Reset</button>
          <button data-focal-save class="primary">Save centering</button>
        </div>
      </div>` : ''}
    </div>`;
  }
  function paintBg (root) {
    const el = root.querySelector('[data-hero-bg-current]');
    const form = root.querySelector('[data-hero-bg]');
    el.textContent = background?.value ? `Current: ${background.type} — ${background.value}` : 'Current: solid black (default)';
    if (form && background) { form.type.value = background.type || 'color'; form.value.value = background.value || ''; }
  }
  function paintCss (root) {
    Object.keys(css).forEach(k => {
      const inp = root.querySelector(`[data-hero-css="${k}"]`);
      if (inp) inp.value = css[k];
    });
    paintCssLabels(root);
  }
  function paintCssLabels (root) {
    Object.keys(css).forEach(k => {
      // Sync BOTH the slider and its companion number input so either
      // control can be the authoritative editor without losing focus.
      const slider = root.querySelector(`[data-hero-css="${k}"]`);
      const num    = root.querySelector(`[data-hero-css-num="${k}"]`);
      if (slider && document.activeElement !== slider) slider.value = css[k];
      if (num    && document.activeElement !== num)    num.value    = css[k];
      // Legacy display span (kept for any tpl variant still using it).
      const lbl = root.querySelector(`[data-hero-css-${k}-val]`);
      if (lbl) lbl.textContent = k === 'heroSize' ? css[k] + '%' : css[k];
    });
  }
  function paintAlLabels (root) {
    const slider = root.querySelector('[data-hero-al="rotateMs"]');
    const num    = root.querySelector('[data-hero-al-num="rotateMs"]');
    if (slider && document.activeElement !== slider) slider.value = appLogo.rotateMs;
    if (num    && document.activeElement !== num)    num.value    = appLogo.rotateMs;
    const lbl = root.querySelector('[data-hero-al-rotateMs-val]');
    if (lbl) lbl.textContent = appLogo.rotateMs;
  }
  function paintPreview (root) {
    // Bump the iframe src cache-buster so it re-fetches css + slides.
    const iframe = root.querySelector('[data-hero-preview-iframe]');
    if (iframe) iframe.src = PREVIEW_URL + '&t=' + Date.now();
  }

  // =====================================================================
  // Fullscreen Slide Editor — real africa mask, drag to reposition, wheel
  // to zoom, arrow-keys to change slide, delete inline. Shows exactly
  // what the hero will render.
  // =====================================================================
  function openSlideEditor (startIdx) {
    if (!slides.length) return;
    let idx = Math.max(0, Math.min(startIdx, slides.length - 1));
    // A single working copy of the slide's focal/zoom/duration that we
    // mutate live, then commit to `slides[]` on Save.
    let draft = { ...slides[idx] };

    document.getElementById('aa-slide-editor')?.remove();
    const overlay = document.createElement('div');
    overlay.id        = 'aa-slide-editor';
    overlay.className = 'aa-slide-editor';
    overlay.innerHTML = `
      <button class="aa-lb-close"  aria-label="Close">×</button>
      <button class="aa-lb-prev"   aria-label="Previous slide">‹</button>
      <button class="aa-lb-next"   aria-label="Next slide">›</button>
      <div class="aa-se-frame">
        <div class="aa-se-stage" id="aa-se-stage"></div>
        <div class="aa-se-outline" aria-hidden="true"></div>
      </div>
      <div class="aa-se-panel">
        <div class="aa-se-row">
          <label>H focal <span data-se-val="focalX">50%</span>
            <input type="range" min="0" max="100" step="1" data-se-in="focalX">
          </label>
          <label>V focal <span data-se-val="focalY">50%</span>
            <input type="range" min="0" max="100" step="1" data-se-in="focalY">
          </label>
          <label>Zoom <span data-se-val="zoom">100%</span>
            <input type="range" min="100" max="400" step="5" data-se-in="zoom">
          </label>
          <label>Duration ms <span data-se-val="duration">2000</span>
            <input type="range" min="500" max="30000" step="100" data-se-in="duration">
          </label>
        </div>
        <div class="aa-se-actions">
          <button data-se-reset>Reset</button>
          <button data-se-delete class="danger">Delete slide</button>
          <button data-se-cancel>Cancel</button>
          <button data-se-save class="primary">Save</button>
        </div>
        <div class="aa-se-meta" data-se-meta></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const stage   = overlay.querySelector('#aa-se-stage');
    const meta    = overlay.querySelector('[data-se-meta]');
    const inputs  = overlay.querySelectorAll('[data-se-in]');
    const vals    = { focalX: 50, focalY: 50, zoom: 100, duration: 2000 };

    function loadFromSlide () {
      const s = slides[idx];
      draft = { ...s };
      vals.focalX   = Number.isFinite(+s.focalX)   ? +s.focalX   : 50;
      vals.focalY   = Number.isFinite(+s.focalY)   ? +s.focalY   : 50;
      vals.zoom     = Number.isFinite(+s.zoom)     ? +s.zoom     : 100;
      vals.duration = Number.isFinite(+s.duration) ? +s.duration : 2000;
      inputs.forEach(i => { i.value = vals[i.dataset.seIn]; });
      renderStage();
      renderLabels();
      const isMedia = s.type !== 'text' && s.type !== 'a';
      overlay.querySelectorAll('.aa-se-row label, [data-se-reset]').forEach(el => {
        el.style.opacity = isMedia ? '1' : '.3';
        el.querySelectorAll('input').forEach(i => i.disabled = !isMedia);
      });
      meta.textContent = `Slide ${idx + 1} / ${slides.length} · ${s.type}${s.src ? ' · ' + s.src.split('/').pop() : ''}`;
    }
    function renderStage () {
      const s = slides[idx];
      const style = `object-position:${vals.focalX}% ${vals.focalY}%;transform:scale(${(vals.zoom/100).toFixed(3)});transform-origin:${vals.focalX}% ${vals.focalY}%;`;
      if (s.type === 'video' || s.type === 'mp4') {
        stage.innerHTML = `<video src="${esc(s.src)}" muted loop autoplay playsinline style="${style}"></video>`;
      } else if (s.type === 'image' || s.type === 'gif') {
        stage.innerHTML = `<img src="${esc(s.src)}" alt="" style="${style}">`;
      } else {
        stage.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:'Arial Black',sans-serif;font-weight:900;font-size:70cqh;line-height:1">${esc(s.text || 'A')}</div>`;
      }
    }
    function renderLabels () {
      overlay.querySelector('[data-se-val="focalX"]').textContent  = vals.focalX + '%';
      overlay.querySelector('[data-se-val="focalY"]').textContent  = vals.focalY + '%';
      overlay.querySelector('[data-se-val="zoom"]').textContent    = vals.zoom + '%';
      overlay.querySelector('[data-se-val="duration"]').textContent= vals.duration;
    }

    // Sliders → state
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        vals[input.dataset.seIn] = Number(input.value);
        renderStage();
        renderLabels();
      });
    });

    // Drag on the stage → pan focal point. dx/dy in pixels map to
    // percentage of stage size, inverted because dragging RIGHT moves
    // the visible frame to look at content further LEFT.
    let dragging = false, dragStart = null;
    function toPct (dx, dy, rect) {
      const px = (dx / rect.width)  * 100;
      const py = (dy / rect.height) * 100;
      return { dx: px, dy: py };
    }
    stage.addEventListener('pointerdown', (e) => {
      const s = slides[idx];
      if (s.type === 'text' || s.type === 'a') return;
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY, focalX: vals.focalX, focalY: vals.focalY, rect: stage.getBoundingClientRect() };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const { dx, dy } = toPct(e.clientX - dragStart.x, e.clientY - dragStart.y, dragStart.rect);
      vals.focalX = Math.max(0, Math.min(100, dragStart.focalX - dx));
      vals.focalY = Math.max(0, Math.min(100, dragStart.focalY - dy));
      inputs.forEach(i => { if (i.dataset.seIn === 'focalX') i.value = vals.focalX; if (i.dataset.seIn === 'focalY') i.value = vals.focalY; });
      renderStage(); renderLabels();
    });
    stage.addEventListener('pointerup',     () => { dragging = false; });
    stage.addEventListener('pointercancel', () => { dragging = false; });

    // Wheel → zoom
    stage.addEventListener('wheel', (e) => {
      const s = slides[idx];
      if (s.type === 'text' || s.type === 'a') return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : +5;
      vals.zoom = Math.max(100, Math.min(400, vals.zoom + delta));
      inputs.forEach(i => { if (i.dataset.seIn === 'zoom') i.value = vals.zoom; });
      renderStage(); renderLabels();
    }, { passive: false });

    // Nav / actions
    function step (dir) { idx = (idx + dir + slides.length) % slides.length; loadFromSlide(); }
    function close ()   { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey (e) {
      if (e.target.matches('input')) return;   // don't hijack sliders
      if (e.key === 'ArrowRight')     { e.preventDefault(); step(+1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'Escape')    { e.preventDefault(); close(); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); overlay.querySelector('[data-se-save]').click(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); overlay.querySelector('[data-se-delete]').click(); }
    }
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.aa-lb-close').addEventListener('click', close);
    overlay.querySelector('.aa-lb-prev' ).addEventListener('click', () => step(-1));
    overlay.querySelector('.aa-lb-next' ).addEventListener('click', () => step(+1));

    overlay.querySelector('[data-se-reset]').addEventListener('click', () => {
      vals.focalX = 50; vals.focalY = 50; vals.zoom = 100;
      inputs.forEach(i => { if (['focalX','focalY','zoom'].includes(i.dataset.seIn)) i.value = vals[i.dataset.seIn]; });
      renderStage(); renderLabels();
    });
    overlay.querySelector('[data-se-cancel]').addEventListener('click', () => loadFromSlide());
    overlay.querySelector('[data-se-save]').addEventListener('click', async () => {
      const s = slides[idx];
      s.focalX = vals.focalX; s.focalY = vals.focalY; s.zoom = vals.zoom; s.duration = vals.duration;
      const r = await save();
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      if (cmsRoot) { paintSlides(cmsRoot); paintPreview(cmsRoot); }
    });
    overlay.querySelector('[data-se-delete]').addEventListener('click', async () => {
      if (!confirm('Delete this slide from the hero rotation?')) return;
      slides.splice(idx, 1);
      const r = await save();
      if (!r.ok) { alert('Delete failed: ' + r.error); return; }
      if (cmsRoot) { paintSlides(cmsRoot); paintPreview(cmsRoot); }
      if (!slides.length) { close(); return; }
      if (idx >= slides.length) idx = slides.length - 1;
      loadFromSlide();
    });

    loadFromSlide();
  }

  window.AfricaHeroCMS = { render };
})();
