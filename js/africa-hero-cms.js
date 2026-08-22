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

  async function uploadFile (file) {
    if (!file) return { ok: false, error: 'no file' };
    const r = await fetch(UPLOAD_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-filename':   file.name || 'upload.bin'
      },
      body: file
    });
    if (!r.ok) return { ok: false, error: (await r.text()).slice(0, 200) };
    return await r.json();
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
  async function paintMediaLibrary (root) {
    const grid  = root.querySelector('[data-hero-media-grid]');
    const count = root.querySelector('[data-hero-media-count]');
    if (!grid) return;
    const items = await loadMediaLibrary();
    count.textContent = '(' + items.length + ')';
    if (!items.length) { grid.innerHTML = '<div style="color:var(--muted)">No media yet — upload above.</div>'; return; }
    grid.innerHTML = items.map((m, i) => `
      <div class="slide-card" data-media-idx="${i}" data-media-url="${esc(m.url)}" data-media-source="${esc(m.source)}">
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
          <button data-media-add>+ Slide</button>
          <button class="danger" data-media-del title="${m.source === 'blob' ? 'Delete this blob upload permanently' : 'Hide this /media/ file from the library (file stays in the repo — commit a git remove to delete for real)'}">${m.source === 'blob' ? 'Delete' : 'Hide'}</button>
        </div>
      </div>`).join('');
    // Bind row actions
    grid.querySelectorAll('.slide-card').forEach(card => {
      card.querySelector('[data-media-add]')?.addEventListener('click', async () => {
        const url = card.dataset.mediaUrl;
        const item = items.find(x => x.url === url); if (!item) return;
        slides.push({ type: item.type, src: url, duration: css.advanceMs || 2000 });
        const r = await save();
        if (!r.ok) { alert('Save failed: ' + r.error); return; }
        paintSlides(root);
        paintPreview(root);
      });
      card.querySelector('[data-media-del]')?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const url = card.dataset.mediaUrl;
        const src = card.dataset.mediaSource;
        const prompt = src === 'blob'
          ? 'Delete this blob upload permanently? (Irreversible)'
          : 'Hide this /media/ file from the library?\n\nFile stays in the git repo — this only removes it from the CMS and hero rotation. To delete for real, commit a git remove.';
        if (!confirm(prompt)) return;
        try {
          await deleteBlobUrl(url);
          await paintMediaLibrary(root);
        } catch (e) { alert('Delete failed: ' + e.message); }
      });
      // Click on the preview thumb → open fullscreen lightbox at that item
      card.querySelector('.slide-preview')?.addEventListener('click', () => {
        const url = card.dataset.mediaUrl;
        const idx = items.findIndex(x => x.url === url);
        if (idx >= 0) openLightbox(items, idx, root);
      });
    });
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
        <h2 style="margin:0 0 4px">Loading Screen · CMS + CSS</h2>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 14px;font-size:.86rem">
          Fullscreen splash shown on first visit. Africa continent silhouette is a
          window; the slideshow renders inside. All content stored in Vercel Blob —
          upload directly from your machine, no folder pushes needed.
          <br>Live preview beneath every panel. Changes save on click.
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-hero-preview>Open fullscreen preview</button>
          <button class="btn ghost" data-hero-reload>Reload from server</button>
        </div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 10px">Africa outline &amp; timing</h3>
        <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
          <label class="cms-slider">Africa size <span data-hero-css-heroSize-val>72%</span>
            <input type="range" min="40" max="100" step="1" data-hero-css="heroSize" />
          </label>
          <label class="cms-slider">Outline stroke <span data-hero-css-outlineWidth-val>35</span>
            <input type="range" min="1" max="80" step="1" data-hero-css="outlineWidth" />
          </label>
          <label class="cms-slider">Crossfade (ms) <span data-hero-css-crossfadeMs-val>4000</span>
            <input type="range" min="200" max="10000" step="100" data-hero-css="crossfadeMs" />
          </label>
          <label class="cms-slider">Big-A every N slides <span data-hero-css-aFrequency-val>6</span>
            <input type="range" min="1" max="50" step="1" data-hero-css="aFrequency" />
          </label>
          <label class="cms-slider">Advance (ms) <span data-hero-css-advanceMs-val>2000</span>
            <input type="range" min="500" max="30000" step="100" data-hero-css="advanceMs" />
          </label>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" data-hero-css-save>Save CSS</button>
          <button class="btn ghost" data-hero-css-reset>Reset defaults</button>
        </div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 10px">App logo — outline &amp; timing</h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 10px;font-size:.82rem">
          Header (top-left) mini hero. Curate the mini-slideshow separately below.
          If the app-logo list is empty, it falls back to the hero's current slides.
        </p>
        <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
          <label class="cms-slider">Slideshow rotation (ms) <span data-hero-al-rotateMs-val>4500</span>
            <input type="range" min="1000" max="60000" step="500" data-hero-al="rotateMs" />
          </label>
          <label style="display:flex;gap:8px;align-items:center">
            <input type="checkbox" data-hero-al="showOutline" />
            Show africa outline stroke
          </label>
        </div>
        <div style="margin-top:10px"><button class="btn" data-hero-al-save>Save app logo</button></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 10px">App logo · Current slides <span style="color:var(--fg-dim);font-weight:400" data-hero-al-count></span></h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 10px;font-size:.82rem">
          Independent slide list for the header mini-hero (image / gif only —
          video can't render as a background-image at 40px).
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
        <h3 style="margin:0 0 10px">Outside-africa background</h3>
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
        <h3 style="margin:0 0 10px">Add slide</h3>
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
        <h3 style="margin:0 0 10px">Current slides <span style="color:var(--fg-dim);font-weight:400" data-hero-count></span></h3>
        <div class="aa-slides-cms" data-hero-list><div style="color:var(--muted)">Loading…</div></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 10px">Media library <span style="color:var(--fg-dim);font-weight:400" data-hero-media-count></span></h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 10px;font-size:.82rem">
          Every image / gif / video managed for the hero. Blob uploads
          can be deleted here; <b>repo</b> files (committed under /media/)
          are read-only and need a git commit to remove.
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
        <h3 style="margin:0 0 10px">Live preview</h3>
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

    // ---- CSS sliders ----
    root.querySelectorAll('[data-hero-css]').forEach(input => {
      input.addEventListener('input', () => {
        css[input.dataset.heroCss] = Number(input.value);
        paintCssLabels(root);
      });
    });
    root.querySelector('[data-hero-css-save]').addEventListener('click', async () => {
      const r = await save();
      if (!r.ok) alert('Save failed: ' + r.error);
      paintPreview(root);
    });
    root.querySelector('[data-hero-css-reset]').addEventListener('click', async () => {
      css = defaultCss();
      paintCss(root);
      await save();
      paintPreview(root);
    });

    // ---- App-logo sliders ----
    root.querySelectorAll('[data-hero-al]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.heroAl;
        appLogo[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
        paintAlLabels(root);
      });
    });
    root.querySelector('[data-hero-al-save]').addEventListener('click', async () => {
      const r = await save();
      if (!r.ok) alert('Save failed: ' + r.error);
      paintPreview(root);
    });
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
      const lbl = root.querySelector(`[data-hero-css-${k}-val]`);
      if (lbl) lbl.textContent = k === 'heroSize' ? css[k] + '%' : css[k];
    });
  }
  function paintAlLabels (root) {
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
