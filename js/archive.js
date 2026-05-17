/* ANARCHISM.AFRICA — Media Archive
 *
 * Displays all film, sound, image, PDF and data files stored in
 * archive/manifest.json on Vercel Blob. Admins can upload files or add URL
 * references. Clicking any card opens a full-viewport inline viewer/player
 * that fills the chrome (below topbar, above bottombar) — no browser pop-up.
 *
 * Endpoints:
 *   GET    /api/archive/list           → { items:[…], updated }
 *   POST   /api/archive/upload         → { ok:true, entry:{…} }
 *   DELETE /api/archive/delete?id=…    → { ok:true }
 *
 * Public API: window.Archive = { render() }
 */
(function () {

  // ── Media-type registry ─────────────────────────────────────────────────────
  const TYPE_META = {
    video: { label: 'Film',  emoji: '🎬', color: '#7c3aed', exts: ['mp4','webm','mov','avi','mkv','ogv'] },
    audio: { label: 'Sound', emoji: '🔊', color: '#0891b2', exts: ['mp3','wav','ogg','flac','aac','m4a','opus'] },
    image: { label: 'Image', emoji: '🖼',  color: '#059669', exts: ['jpg','jpeg','png','gif','webp','svg','avif','bmp'] },
    pdf:   { label: 'PDF',   emoji: '📄', color: '#d97706', exts: ['pdf'] },
    data:  { label: 'Data',  emoji: '📊', color: '#475569', exts: ['csv','json','tsv','txt','md','xlsx','xls','ndjson'] },
  };

  function mimeToType (mime = '', url = '') {
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (mime && mime !== 'application/octet-stream') return 'data';
    // fall back to extension
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    for (const [type, meta] of Object.entries(TYPE_META)) {
      if (meta.exts.includes(ext)) return type;
    }
    return 'data';
  }

  function guessFromExt (name = '') {
    const ext = (name.split('?')[0].split('.').pop() || '').toLowerCase();
    const map = {
      mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', ogv:'video/ogg',
      mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', flac:'audio/flac',
      aac:'audio/aac', m4a:'audio/mp4', opus:'audio/ogg',
      jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif',
      webp:'image/webp', svg:'image/svg+xml', avif:'image/avif',
      pdf:'application/pdf', csv:'text/csv', json:'application/json',
      txt:'text/plain', md:'text/plain', tsv:'text/tab-separated-values'
    };
    return map[ext] || 'application/octet-stream';
  }

  function fmtSize (bytes) {
    if (!bytes) return '';
    if (bytes < 1024)       return bytes + ' B';
    if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function fmtDate (iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }); }
    catch { return (iso + '').slice(0, 10); }
  }

  function isAdmin () {
    return document.body.dataset.role === 'admin'
      || sessionStorage.getItem('aa.session.admin') === 'ok';
  }

  // ── State ───────────────────────────────────────────────────────────────────
  let items        = [];
  let activeFilter = 'all';
  let painted      = false;

  // ── Public entry point ──────────────────────────────────────────────────────
  async function render () {
    const root = document.getElementById('view-archive');
    if (!root) return;
    if (!painted) {
      root.innerHTML = buildTemplate();
      painted = true;
      bindFilters(root);
      bindUploadPanel(root);
    }
    renderGrid(root);          // show whatever we have immediately
    await loadItems(root);     // then refresh from API
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  async function loadItems (root) {
    try {
      const r = await fetch('/api/archive/list', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        items = Array.isArray(d.items) ? d.items : [];
        renderGrid(root);
      }
    } catch {}
  }

  // ── Template ────────────────────────────────────────────────────────────────
  function buildTemplate () {
    const admin = isAdmin();
    return `
<div class="section-head">
  <div>
    <h2>Media Archive</h2>
    <p class="lead">Film, sound, image, PDF &amp; data files — tap any card to open full-screen.</p>
  </div>
  ${admin ? `<button class="btn primary" id="arc-add-btn">+ Add file</button>` : ''}
</div>

${admin ? uploadPanelHtml() : ''}

<div class="archive-filters" id="archive-filters" role="toolbar" aria-label="Filter by type">
  <button class="chip active" data-filter="all">All</button>
  ${Object.entries(TYPE_META).map(([k, v]) =>
    `<button class="chip" data-filter="${k}">${v.emoji} ${v.label}</button>`
  ).join('')}
</div>

<div class="grid" id="archive-grid" aria-live="polite">
  <div class="archive-empty" id="archive-empty" hidden>
    <p>No files yet.${admin ? ' Use <b>+ Add file</b> to upload or link media.' : ''}</p>
  </div>
</div>`;
  }

  function uploadPanelHtml () {
    return `
<div class="panel archive-upload-panel" id="arc-panel" hidden style="margin-bottom:16px">
  <h3 style="margin:0 0 12px">Add to archive</h3>
  <div style="display:grid;gap:10px">

    <label style="display:grid;gap:4px">
      <span class="mono" style="font-size:.7rem;color:var(--muted)">Title *</span>
      <input id="arc-title" placeholder="e.g. Fanon Interview 1961"
        style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit"/>
    </label>

    <label style="display:grid;gap:4px">
      <span class="mono" style="font-size:.7rem;color:var(--muted)">Description</span>
      <textarea id="arc-desc" rows="2" placeholder="Optional…"
        style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit;resize:vertical"></textarea>
    </label>

    <label style="display:grid;gap:4px">
      <span class="mono" style="font-size:.7rem;color:var(--muted)">Tags (comma-separated)</span>
      <input id="arc-tags" placeholder="decolonial, audio, 1961"
        style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit"/>
    </label>

    <label style="display:grid;gap:4px">
      <span class="mono" style="font-size:.7rem;color:var(--muted)">External URL (for large / already-hosted files)</span>
      <input id="arc-url" type="url" placeholder="https://…"
        style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit"/>
    </label>

    <label style="display:grid;gap:4px">
      <span class="mono" style="font-size:.7rem;color:var(--muted)">MIME type (required when entering URL)</span>
      <select id="arc-mime"
        style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit">
        <option value="">Auto-detect from URL extension</option>
        <optgroup label="Video"><option value="video/mp4">video/mp4</option><option value="video/webm">video/webm</option></optgroup>
        <optgroup label="Audio"><option value="audio/mpeg">audio/mpeg (MP3)</option><option value="audio/ogg">audio/ogg</option><option value="audio/wav">audio/wav</option><option value="audio/flac">audio/flac</option></optgroup>
        <optgroup label="Image"><option value="image/jpeg">image/jpeg</option><option value="image/png">image/png</option><option value="image/gif">image/gif</option><option value="image/webp">image/webp</option></optgroup>
        <optgroup label="Document"><option value="application/pdf">application/pdf</option><option value="text/csv">text/csv</option><option value="application/json">application/json</option><option value="text/plain">text/plain</option></optgroup>
      </select>
    </label>

    <div id="arc-dropzone" class="archive-dropzone" role="button" tabindex="0" aria-label="Drop a file or click to browse">
      <span>Drop a file here — or click to browse</span>
      <input id="arc-file" type="file" style="display:none"
        accept="video/*,audio/*,image/*,application/pdf,.csv,.json,.txt,.md"/>
      <div id="arc-drop-name" class="mono" style="font-size:.73rem;color:var(--muted);margin-top:4px"></div>
    </div>

    <label style="display:grid;gap:4px">
      <span class="mono" style="font-size:.7rem;color:var(--muted)">Admin token</span>
      <input id="arc-token" type="password" placeholder="Required to save"
        style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit"/>
    </label>

  </div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">
    <button class="btn primary" id="arc-submit">Upload / Add</button>
    <button class="btn ghost"   id="arc-cancel">Cancel</button>
    <span id="arc-status" class="mono" style="font-size:.75rem;color:var(--muted)"></span>
  </div>
</div>`;
  }

  // ── Grid ────────────────────────────────────────────────────────────────────
  function renderGrid (root) {
    const grid  = root?.querySelector('#archive-grid');
    const empty = root?.querySelector('#archive-empty');
    if (!grid) return;

    const filtered = activeFilter === 'all'
      ? items
      : items.filter(it => mimeToType(it.mimeType, it.url) === activeFilter);

    // Remove existing cards, keep the empty sentinel
    grid.querySelectorAll('.archive-card').forEach(c => c.remove());

    if (!filtered.length) {
      if (empty) empty.removeAttribute('hidden');
      return;
    }
    if (empty) empty.setAttribute('hidden', '');

    const frag = document.createDocumentFragment();
    filtered.forEach(it => frag.appendChild(buildCard(it)));
    grid.appendChild(frag);
  }

  function buildCard (it) {
    const type = mimeToType(it.mimeType, it.url);
    const meta = TYPE_META[type] || TYPE_META.data;
    const card = document.createElement('div');
    card.className = 'card archive-card';
    card.dataset.id = it.id;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open: ${it.title}`);

    const isImg  = type === 'image';
    const thumbBg = isImg ? `background-image:url("${it.url}")` : `background:${meta.color}1a`;

    card.innerHTML = `
<div class="card-thumb archive-thumb" style="${thumbBg}">
  ${!isImg ? `<span class="archive-big-icon">${meta.emoji}</span>` : ''}
  <span class="archive-type-pill" style="background:${meta.color}">${meta.emoji} ${meta.label}</span>
  ${isAdmin() ? `<button class="archive-delete-btn" data-delete-id="${it.id}" title="Remove from archive" aria-label="Delete">✕</button>` : ''}
</div>
<div class="card-body">
  <div class="card-title">${it.title || 'Untitled'}</div>
  <div class="card-meta mono">${[fmtDate(it.uploadedAt), fmtSize(it.size)].filter(Boolean).join(' · ')}</div>
  ${it.description ? `<p class="card-desc">${it.description.slice(0, 90)}${it.description.length > 90 ? '…' : ''}</p>` : ''}
  ${it.tags?.length ? `<div class="archive-tags">${it.tags.slice(0,4).map(t=>`<span class="archive-tag">${t}</span>`).join('')}</div>` : ''}
</div>`;

    card.addEventListener('click', e => {
      if (e.target.closest('.archive-delete-btn')) return; // handled below
      openViewer(it);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(it); }
    });
    card.querySelector('.archive-delete-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      deleteItem(it.id, card);
    });
    return card;
  }

  // ── Filters ─────────────────────────────────────────────────────────────────
  function bindFilters (root) {
    root.querySelector('#archive-filters')?.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      activeFilter = chip.dataset.filter;
      root.querySelectorAll('#archive-filters .chip')
          .forEach(c => c.classList.toggle('active', c === chip));
      renderGrid(root);
    });
  }

  // ── Upload panel ─────────────────────────────────────────────────────────────
  function bindUploadPanel (root) {
    const addBtn  = root.querySelector('#arc-add-btn');
    const panel   = root.querySelector('#arc-panel');
    const cancel  = root.querySelector('#arc-cancel');
    const submit  = root.querySelector('#arc-submit');
    const dz      = root.querySelector('#arc-dropzone');
    const fi      = root.querySelector('#arc-file');
    const dname   = root.querySelector('#arc-drop-name');

    if (!panel) return;

    addBtn?.addEventListener('click', () => {
      panel.toggleAttribute('hidden');
      if (!panel.hasAttribute('hidden')) panel.scrollIntoView({ behavior:'smooth', block:'start' });
    });
    cancel?.addEventListener('click', () => panel.setAttribute('hidden', ''));
    submit?.addEventListener('click', () => doUpload(root));

    // Drag-drop / browse
    if (dz && fi) {
      const pick = f => {
        if (!f) return;
        fi._file = f;
        if (dname) dname.textContent = f.name + (f.size ? ' (' + fmtSize(f.size) + ')' : '');
        // Auto-fill mime if not already set
        const mimeEl = root.querySelector('#arc-mime');
        if (mimeEl && !mimeEl.value) mimeEl.value = f.type || guessFromExt(f.name);
      };
      dz.addEventListener('click', () => fi.click());
      dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fi.click(); });
      dz.addEventListener('dragover',   e => { e.preventDefault(); dz.classList.add('drag-over'); });
      dz.addEventListener('dragleave',  () => dz.classList.remove('drag-over'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('drag-over');
        pick(e.dataTransfer?.files?.[0]);
      });
      fi.addEventListener('change', () => pick(fi.files?.[0]));
    }
  }

  function setStatus (root, msg, kind = '') {
    const el = root.querySelector('#arc-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = kind === 'error' ? 'var(--red,#e74c3c)'
                   : kind === 'ok'    ? 'var(--green,#2ecc71)'
                   : 'var(--muted)';
  }

  async function doUpload (root) {
    const v = s => root.querySelector(s)?.value?.trim?.() ?? '';
    const title = v('#arc-title');
    const desc  = v('#arc-desc');
    const tags  = v('#arc-tags').split(',').map(t => t.trim()).filter(Boolean);
    const url   = v('#arc-url');
    const mime  = v('#arc-mime');
    const token = v('#arc-token');
    const fi    = root.querySelector('#arc-file');
    const file  = fi?._file || fi?.files?.[0];

    if (!title)        { setStatus(root, 'Title required', 'error'); return; }
    if (!url && !file) { setStatus(root, 'Drop a file or enter a URL', 'error'); return; }

    setStatus(root, 'Uploading…');

    try {
      const payload = { title, description: desc, tags };

      if (url) {
        payload.url      = url;
        payload.mimeType = mime || guessFromExt(url);
      } else {
        const b64 = await fileToB64(file);
        payload.b64      = b64;
        payload.name     = file.name;
        payload.mimeType = mime || file.type || guessFromExt(file.name);
        payload.size     = file.size;
      }

      const r = await fetch('/api/archive/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-aa-admin-token': token },
        body:    JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);

      items.unshift(data.entry);
      renderGrid(root);
      setStatus(root, 'Added ✓', 'ok');
      // Reset form
      ['#arc-title','#arc-desc','#arc-tags','#arc-url'].forEach(s => {
        const el = root.querySelector(s); if (el) el.value = '';
      });
      const fi2 = root.querySelector('#arc-file');
      if (fi2) { fi2.value = ''; fi2._file = null; }
      const dn = root.querySelector('#arc-drop-name');
      if (dn) dn.textContent = '';
    } catch (e) {
      setStatus(root, 'Error: ' + e.message, 'error');
    }
  }

  async function deleteItem (id, cardEl) {
    const token = prompt('Admin token to confirm delete:');
    if (!token) return;
    try {
      const r = await fetch('/api/archive/delete?id=' + encodeURIComponent(id), {
        method: 'DELETE', headers: { 'x-aa-admin-token': token }
      });
      if (r.ok) {
        items = items.filter(i => i.id !== id);
        cardEl.remove();
      } else {
        const d = await r.json();
        alert('Delete failed: ' + (d.error || r.status));
      }
    } catch (e) { alert('Delete error: ' + e.message); }
  }

  function fileToB64 (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Full-viewport viewer ────────────────────────────────────────────────────
  function getOrCreateViewer () {
    let viewer = document.getElementById('archive-viewer');
    if (!viewer) {
      viewer = document.createElement('div');
      viewer.id        = 'archive-viewer';
      viewer.className = 'archive-viewer';
      viewer.setAttribute('aria-modal', 'true');
      viewer.setAttribute('role', 'dialog');
      viewer.setAttribute('tabindex', '-1');
      viewer.setAttribute('hidden', '');
      viewer.innerHTML = `
<div class="av-bar">
  <span class="av-type-pill" id="av-type-pill"></span>
  <span class="av-title-txt" id="av-title-txt"></span>
  <span class="av-meta-txt mono" id="av-meta-txt"></span>
  <a class="btn ghost av-download" id="av-download" download target="_blank" rel="noopener" title="Download / open in new tab" aria-label="Download">↓</a>
  <button class="btn ghost av-close" id="av-close" title="Close (Esc)" aria-label="Close viewer">✕</button>
</div>
<div class="av-body" id="av-body"></div>`;
      document.body.appendChild(viewer);

      viewer.querySelector('#av-close').addEventListener('click', () => closeViewer());
      viewer.addEventListener('keydown', e => { if (e.key === 'Escape') closeViewer(); });
    }
    return viewer;
  }

  function openViewer (it) {
    const viewer = getOrCreateViewer();
    const type   = mimeToType(it.mimeType, it.url);
    const meta   = TYPE_META[type] || TYPE_META.data;

    // Update header
    const pill = viewer.querySelector('#av-type-pill');
    pill.textContent       = meta.emoji + ' ' + meta.label;
    pill.style.background  = meta.color;
    viewer.querySelector('#av-title-txt').textContent = it.title || 'Untitled';
    viewer.querySelector('#av-meta-txt').textContent  =
      [fmtDate(it.uploadedAt), it.mimeType, fmtSize(it.size)].filter(Boolean).join(' · ');
    const dl = viewer.querySelector('#av-download');
    if (dl) dl.href = it.url;

    // Swap body content
    const body = viewer.querySelector('#av-body');
    // Teardown old media before replacing
    body.querySelectorAll('video,audio').forEach(m => {
      try { m.pause(); m.removeAttribute('src'); m.load(); } catch {}
    });
    body.innerHTML = '';
    body.appendChild(buildMediaEl(type, it));

    viewer.removeAttribute('hidden');
    viewer.focus();
    document.body.classList.add('archive-viewer-open');
  }

  function closeViewer () {
    const viewer = document.getElementById('archive-viewer');
    if (!viewer) return;
    viewer.querySelectorAll('video,audio').forEach(m => {
      try { m.pause(); m.removeAttribute('src'); m.load(); } catch {}
    });
    viewer.setAttribute('hidden', '');
    document.body.classList.remove('archive-viewer-open');
    // Return focus to last clicked card
    document.querySelector('.archive-card[data-active]')?.focus();
    document.querySelectorAll('.archive-card[data-active]').forEach(c => c.removeAttribute('data-active'));
  }

  function buildMediaEl (type, it) {
    switch (type) {

      case 'video': {
        const v = Object.assign(document.createElement('video'), {
          src:      it.url,
          controls: true,
          autoplay: false,
          preload:  'metadata',
          className:'av-media-el'
        });
        v.setAttribute('playsinline', '');
        return v;
      }

      case 'audio': {
        const wrap = document.createElement('div');
        wrap.className = 'av-audio-wrap';
        wrap.innerHTML = `
<div class="av-audio-cover">
  ${it.coverUrl ? `<img src="${it.coverUrl}" alt="" loading="lazy"/>` : `<span>${TYPE_META.audio.emoji}</span>`}
</div>
<div class="av-audio-info">
  <div class="av-audio-title">${it.title || ''}</div>
  ${it.description ? `<p class="av-audio-desc">${it.description}</p>` : ''}
  ${it.tags?.length ? `<div class="archive-tags">${it.tags.map(t=>`<span class="archive-tag">${t}</span>`).join('')}</div>` : ''}
</div>`;
        const aud = document.createElement('audio');
        Object.assign(aud, { src: it.url, controls: true, preload: 'metadata', className: 'av-audio-el' });
        wrap.appendChild(aud);
        return wrap;
      }

      case 'image': {
        const wrap = document.createElement('div');
        wrap.className = 'av-image-wrap';
        const img = document.createElement('img');
        Object.assign(img, { src: it.url, alt: it.title || '', className: 'av-image-el' });
        // Wheel zoom
        let scale = 1;
        img.addEventListener('wheel', e => {
          e.preventDefault();
          scale = Math.min(8, Math.max(1, scale + (e.deltaY < 0 ? 0.2 : -0.2)));
          img.style.transform = scale > 1 ? `scale(${scale})` : '';
          wrap.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
        }, { passive: false });
        img.addEventListener('dblclick', () => {
          scale = scale > 1 ? 1 : 2;
          img.style.transform = scale > 1 ? `scale(${scale})` : '';
        });
        wrap.appendChild(img);
        return wrap;
      }

      case 'pdf': {
        const frame = document.createElement('iframe');
        Object.assign(frame, { src: it.url + '#toolbar=1', title: it.title || 'PDF', className: 'av-media-el' });
        return frame;
      }

      case 'data': {
        const wrap = document.createElement('div');
        wrap.className = 'av-data-wrap';
        const pre = document.createElement('pre');
        pre.className  = 'av-data-pre';
        pre.textContent = 'Loading…';
        wrap.appendChild(pre);
        fetch(it.url).then(r => r.text()).then(txt => {
          const isJson = it.mimeType === 'application/json' || it.url.endsWith('.json');
          if (isJson) { try { txt = JSON.stringify(JSON.parse(txt), null, 2); } catch {} }
          pre.textContent = txt;
        }).catch(e => { pre.textContent = 'Could not load: ' + e.message; });
        return wrap;
      }

      default: {
        const p = document.createElement('p');
        p.style.cssText = 'padding:32px;color:var(--fg-dim);text-align:center';
        p.innerHTML = `Cannot preview this file type. <a href="${it.url}" target="_blank" rel="noopener" style="color:var(--accent)">Open in new tab →</a>`;
        return p;
      }
    }
  }

  // ── Expose ──────────────────────────────────────────────────────────────────
  window.Archive = { render };

})();
