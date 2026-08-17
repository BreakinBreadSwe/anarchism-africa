/* ANARCHISM.AFRICA — CMS for the fullscreen Africa-shaped loading screen.
 *
 * Renders into whatever container the caller provides. Loads current
 * slides from /api/africa-slides (falls back to seed on empty), lets
 * admin/publisher add/edit/delete, and POSTs the updated list back.
 *
 * Public API: window.AfricaHeroCMS
 *   .render(container)     – paint the CMS into an HTMLElement
 */
(function () {
  'use strict';

  const ENDPOINT = '/api/africa-slides';
  let cachedSlides = null;
  let cachedBackground = null;

  function esc (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function load () {
    try {
      const r = await fetch(ENDPOINT, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        cachedBackground = d.background || null;
        if (Array.isArray(d.slides)) return d.slides;
      }
    } catch {}
    return [];
  }

  async function save (slides, background) {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides, background })
    });
    return r.ok ? { ok: true } : { ok: false, error: (await r.text()).slice(0, 200) };
  }

  async function render (container) {
    if (!container) return;
    container.innerHTML = `
      <div class="panel">
        <h2 style="margin:0 0 4px">Loading Screen</h2>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 14px;font-size:.86rem">
          Fullscreen splash shown on first visit, cropped to the Africa continent
          silhouette. Each slide is one of: <b>text</b> · <b>image</b> · <b>gif</b> ·
          <b>video / mp4</b> · <b>iframe</b>. Every layer pulses in sync with the
          media player audio (Web Audio → CSS variable).
          <br>Changes are live for admin + publisher — POSTs to /api/africa-slides.
        </p>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button class="btn" data-hero-preview>Preview fullscreen</button>
          <button class="btn ghost" data-hero-reload>Reload from server</button>
        </div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 10px">Outside-africa background</h3>
        <p style="color:var(--fg-dim);max-width:70ch;margin:0 0 10px;font-size:.82rem">
          Renders in the space AROUND the continent silhouette. Solid colour,
          image, gif, mp4 loop, or iframe URL (YouTube/Vimeo embed).
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
          <label>&nbsp;<button type="button" data-hero-bg-clear style="background:transparent;color:var(--fg-dim);border:1px solid var(--line)">Clear</button></label>
          <button type="submit">Save background</button>
        </form>
        <div data-hero-bg-current style="margin-top:8px;font-size:.75rem;color:var(--fg-dim)"></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 10px">Add slide</h3>
        <form class="aa-slide-form" data-hero-add>
          <label>Type
            <select name="type" required>
              <option value="text">text</option>
              <option value="image">image</option>
              <option value="gif">gif</option>
              <option value="video">video / mp4</option>
              <option value="iframe">iframe</option>
            </select>
          </label>
          <label class="wide">Text / URL
            <input name="value" placeholder="Slogan for text, https://… for media" required />
          </label>
          <label>Duration (ms)
            <input name="duration" type="number" min="500" step="100" value="3500" />
          </label>
          <button type="submit">Add</button>
        </form>
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 10px">Current slides <span style="color:var(--fg-dim);font-weight:400" data-hero-count></span></h3>
        <div class="aa-slides-cms" data-hero-list><div style="color:var(--muted)">Loading…</div></div>
      </div>
    `;

    const list  = container.querySelector('[data-hero-list]');
    const count = container.querySelector('[data-hero-count]');

    async function paint () {
      cachedSlides = await load();
      count.textContent = '(' + cachedSlides.length + ')';
      const bgCurrent = container.querySelector('[data-hero-bg-current]');
      if (bgCurrent) {
        bgCurrent.textContent = cachedBackground?.value
          ? `Current: ${cachedBackground.type} — ${cachedBackground.value}`
          : 'Current: solid black (default)';
      }
      // Pre-fill the bg form with the current values
      const bgForm = container.querySelector('[data-hero-bg]');
      if (bgForm && cachedBackground) {
        bgForm.type.value  = cachedBackground.type  || 'color';
        bgForm.value.value = cachedBackground.value || '';
      }
      if (!cachedSlides.length) {
        list.innerHTML = '<div style="color:var(--muted)">No slides yet — add one above.</div>';
        return;
      }
      list.innerHTML = cachedSlides.map((s, i) => cardHtml(s, i)).join('');
    }

    // Background config handlers
    container.querySelector('[data-hero-bg]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const bg = { type: f.type.value, value: f.value.value.trim() };
      cachedSlides = cachedSlides || await load();
      cachedBackground = bg.value ? bg : null;
      const r = await save(cachedSlides, cachedBackground);
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      await paint();
    });
    container.querySelector('[data-hero-bg-clear]').addEventListener('click', async () => {
      cachedSlides = cachedSlides || await load();
      cachedBackground = null;
      const r = await save(cachedSlides, null);
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      await paint();
    });

    function cardHtml (s, i) {
      const preview = s.type === 'text'
        ? esc(s.text || '')
        : (s.type === 'video' || s.type === 'mp4'
            ? `<video src="${esc(s.src)}" muted loop autoplay playsinline></video>`
            : `<img src="${esc(s.src)}" alt="">`);
      return `
        <div class="slide-card" data-idx="${i}">
          <div class="slide-preview">${preview}</div>
          <div class="slide-meta"><span>${esc(s.type)}</span><span>${s.duration}ms</span></div>
          <div class="slide-actions">
            <button data-hero-up>↑</button>
            <button data-hero-down>↓</button>
            <button class="danger" data-hero-del>Delete</button>
          </div>
        </div>`;
    }

    list.addEventListener('click', async (e) => {
      const card = e.target.closest('.slide-card');
      if (!card) return;
      const i = Number(card.dataset.idx);
      let changed = false;
      if (e.target.matches('[data-hero-del]')) {
        if (!confirm('Delete this slide?')) return;
        cachedSlides.splice(i, 1); changed = true;
      } else if (e.target.matches('[data-hero-up]') && i > 0) {
        [cachedSlides[i-1], cachedSlides[i]] = [cachedSlides[i], cachedSlides[i-1]]; changed = true;
      } else if (e.target.matches('[data-hero-down]') && i < cachedSlides.length - 1) {
        [cachedSlides[i], cachedSlides[i+1]] = [cachedSlides[i+1], cachedSlides[i]]; changed = true;
      }
      if (changed) {
        const r = await save(cachedSlides, cachedBackground);
        if (!r.ok) alert('Save failed: ' + r.error);
        await paint();
      }
    });

    container.querySelector('[data-hero-add]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const type = f.type.value;
      const value = f.value.value.trim();
      const duration = Math.max(500, Number(f.duration.value) || 3500);
      if (!value) return;
      const slide = { type, duration };
      if (type === 'text') slide.text = value;
      else                 slide.src  = value;
      cachedSlides = cachedSlides || await load();
      cachedSlides.push(slide);
      const r = await save(cachedSlides, cachedBackground);
      if (!r.ok) { alert('Save failed: ' + r.error); return; }
      f.reset();
      f.duration.value = 3500;
      await paint();
    });

    container.querySelector('[data-hero-preview]').addEventListener('click', () => {
      if (window.AA?.hero) window.AA.hero.reload();
      else window.open('/?hero=1', '_blank');
    });
    container.querySelector('[data-hero-reload]').addEventListener('click', paint);

    await paint();
  }

  window.AfricaHeroCMS = { render };
})();
