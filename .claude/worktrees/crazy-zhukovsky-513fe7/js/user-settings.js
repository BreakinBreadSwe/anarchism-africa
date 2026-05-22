/* User Settings — full CSS customization for every role + page.
 *
 * Drops in a button + slide-out sheet on any page that loads this file.
 * Reads admin-proposed presets from data/seed.json (theme_presets).
 * Saves user-saved presets + tokens + free-form CSS overrides + custom logo
 * to localStorage so they persist across sessions and apply on every load.
 *
 * Public API:
 *   AA_SETTINGS.open()          show the sheet
 *   AA_SETTINGS.applyAll()      re-apply saved preferences (called on boot)
 *   AA_SETTINGS.tokens          read-only list of tokens
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const TOKENS = ['bg','bg-2','fg','fg-dim','muted','line','accent','red','green','violet','teal','radius','radius-lg','content-pad-x'];

  // ---- helpers ----
  const toHex = v => {
    v = (v || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map(c => c+c).join('');
    const m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return '#' + [m[1],m[2],m[3]].map(n => Number(n).toString(16).padStart(2,'0')).join('');
    return null; // non-color (e.g. radius value) — don't try to coerce
  };
  const isColor = t => !['radius','radius-lg','content-pad-x'].includes(t);

  function getCurrent () {
    const stored = JSON.parse(localStorage.getItem('aa.theme') || 'null');
    if (stored) return stored;
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    TOKENS.forEach(t => out[t] = cs.getPropertyValue('--' + t).trim());
    return out;
  }

  function applyTokens (tokens, persist = true) {
    Object.entries(tokens).forEach(([k, v]) => {
      if (v) document.documentElement.style.setProperty('--' + k, v);
    });
    if (persist) localStorage.setItem('aa.theme', JSON.stringify(tokens));
  }

  function applyCustomCSS () {
    const css = localStorage.getItem('aa.css');
    let tag = document.getElementById('aa-user-css');
    if (!css) { tag?.remove(); return; }
    if (!tag) { tag = document.createElement('style'); tag.id = 'aa-user-css'; document.head.appendChild(tag); }
    tag.textContent = css;
  }

  function applyCustomLogo () {
    const url = localStorage.getItem('aa.customLogo');
    if (!url) return;
    document.querySelectorAll('.brand .logo').forEach(l => {
      l.classList.add('custom');
      l.style.setProperty('--custom-logo', `url("${url}")`);
    });
  }

  function applyAll () {
    const t = JSON.parse(localStorage.getItem('aa.theme') || 'null');
    if (t) applyTokens(t, false);
    applyCustomCSS();
    applyCustomLogo();
    const anim = localStorage.getItem('aa.anim');
    if (anim) document.documentElement.style.setProperty('--enter-anim', anim);
    const dur = localStorage.getItem('aa.animDur');
    if (dur)  document.documentElement.style.setProperty('--enter-dur', dur + 'ms');
  }

  // ---- sheet builders ----
  function ensureSheet () {
    if ($('#aa-user-settings')) return;
    const sheet = document.createElement('aside');
    sheet.id = 'aa-user-settings';
    sheet.className = 'customize-sheet';
    sheet.innerHTML = `
      <div class="customize-head">
        <h3>User settings</h3>
        <button class="btn ghost" data-act="close">Close</button>
      </div>
      <div class="customize-body">
        <div class="form-row">
          <label style="font-size:.7rem;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Quick presets — proposed by LUVLAB</label>
          <div class="preset-list" id="aa-presets"></div>
        </div>
        <div class="form-row">
          <label style="font-size:.7rem;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin-bottom:6px">My saved themes</label>
          <div class="preset-list" id="aa-user-presets"></div>
        </div>
        <div class="form-row">
          <label style="font-size:.7rem;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Tokens</label>
          <div id="aa-tokens"></div>
        </div>
        <div class="form-row" style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">
          <input type="text" id="aa-preset-name" placeholder="Name your theme — 'Marrakech Sunset'" style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/>
          <button class="btn primary" data-act="save-preset">Save</button>
        </div>

        <div class="form-row">
          <label style="font-size:.7rem;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Animation effect</label>
          <select id="aa-anim" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px">
            <option value="aa-fade-up">Fade up</option>
            <option value="aa-slide-left">Slide left</option>
            <option value="aa-slide-right">Slide right</option>
            <option value="aa-scale-pop">Scale pop</option>
            <option value="aa-mask-reveal">Mask reveal</option>
            <option value="aa-blur-clear">Blur clear</option>
            <option value="aa-glitch-in">Glitch (afro-punk)</option>
            <option value="aa-rise-rotate">Rise &amp; rotate</option>
            <option value="aa-flip-y">Flip Y (3D)</option>
            <option value="aa-iris-in">Iris in</option>
            <option value="aa-marquee-in">Marquee</option>
          </select>
        </div>

        <div class="form-row">
          <label style="font-size:.7rem;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Custom round logo (≤500KB)</label>
          <input type="file" id="aa-logo-upload" accept="image/png,image/svg+xml,image/gif,image/webp"/>
          <div style="display:flex;gap:10px;align-items:center;margin-top:8px">
            <div id="aa-logo-preview" style="width:54px;height:54px;border-radius:50%;border:1px solid var(--line);background:var(--bg) center/cover no-repeat"></div>
            <button class="btn ghost" data-act="clear-logo">Clear</button>
          </div>
        </div>

        <div class="form-row">
          <label style="font-size:.7rem;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Free-form CSS overrides</label>
          <textarea id="aa-css" style="min-height:160px;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:.85rem" placeholder="/* any CSS here will apply on top */"></textarea>
          <button class="btn primary" data-act="save-css" style="margin-top:8px">Save CSS</button>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" data-act="reset">Reset everything</button>
          <button class="btn ghost" data-act="export">Export as JSON</button>
        </div>
      </div>`;
    document.body.appendChild(sheet);

    sheet.addEventListener('click', e => {
      const act = e.target.dataset.act;
      if (act === 'close')        close();
      if (act === 'save-preset')  savePreset();
      if (act === 'clear-logo')   clearLogo();
      if (act === 'save-css')     saveCSS();
      if (act === 'reset')        resetAll();
      if (act === 'export')       exportJSON();
    });
  }

  // ---- token rows ----
  function renderTokens () {
    const cur = getCurrent();
    const host = $('#aa-tokens');
    host.innerHTML = TOKENS.map(t => {
      if (isColor(t)) {
        return `<div class="token-row">
          <label>${t}</label>
          <input type="color" value="${toHex(cur[t]) || '#000000'}" data-tok="${t}"/>
          <input type="text"  value="${cur[t] || ''}" data-tok-text="${t}"/>
        </div>`;
      }
      return `<div class="token-row">
        <label>${t}</label>
        <span></span>
        <input type="text" value="${cur[t] || ''}" data-tok-text="${t}"/>
      </div>`;
    }).join('');
    host.querySelectorAll('[data-tok]').forEach(inp => inp.addEventListener('input', e => {
      const t = e.target.dataset.tok; const v = e.target.value;
      const txt = host.querySelector(`[data-tok-text="${t}"]`); if (txt) txt.value = v;
      document.documentElement.style.setProperty('--' + t, v);
      persistCurrent();
    }));
    host.querySelectorAll('[data-tok-text]').forEach(inp => inp.addEventListener('change', e => {
      const t = e.target.dataset.tokText; const v = e.target.value;
      const cp = host.querySelector(`[data-tok="${t}"]`); if (cp && toHex(v)) cp.value = toHex(v);
      document.documentElement.style.setProperty('--' + t, v);
      persistCurrent();
    }));
  }
  function persistCurrent () {
    const cur = {};
    TOKENS.forEach(t => cur[t] = getComputedStyle(document.documentElement).getPropertyValue('--' + t).trim());
    localStorage.setItem('aa.theme', JSON.stringify(cur));
  }

  // ---- presets ----
  async function loadAdminPresets () {
    try {
      const d = window.AA?.loadSeed ? await window.AA.loadSeed() : await fetch('data/seed.json').then(r => r.json());
      return d.theme_presets || [];
    } catch { return []; }
  }
  function swatches (tokens) {
    return ['bg','fg','accent','red','green'].map(k => `<i style="background:${tokens[k] || '#000'}"></i>`).join('');
  }
  async function renderPresets () {
    const presets = await loadAdminPresets();
    const host = $('#aa-presets'); host.innerHTML = '';
    presets.forEach(p => {
      const c = document.createElement('div');
      c.className = 'preset-card';
      c.innerHTML = `<div class="swatches">${swatches(p.tokens)}</div><div class="meta"><b>${p.name}</b><span>by ${p.by}</span></div>`;
      c.addEventListener('click', () => { applyTokens(p.tokens); renderTokens(); });
      host.appendChild(c);
    });
  }
  function renderUserPresets () {
    const list = JSON.parse(localStorage.getItem('aa.userPresets') || '[]');
    const host = $('#aa-user-presets'); host.innerHTML = '';
    if (!list.length) { host.innerHTML = '<p style="color:var(--muted);font-size:.8rem;margin:0">Save your first theme below.</p>'; return; }
    list.forEach((p, i) => {
      const c = document.createElement('div');
      c.className = 'preset-card';
      c.innerHTML = `<div class="swatches">${swatches(p.tokens)}</div><div class="meta"><b>${p.name}</b><span>${new Date(p.ts).toLocaleDateString()}</span></div><button class="delete" data-del="${i}">×</button>`;
      c.addEventListener('click', e => {
        if (e.target.dataset.del !== undefined) {
          const arr = JSON.parse(localStorage.getItem('aa.userPresets') || '[]');
          arr.splice(+e.target.dataset.del, 1);
          localStorage.setItem('aa.userPresets', JSON.stringify(arr));
          renderUserPresets();
          return;
        }
        applyTokens(p.tokens); renderTokens();
      });
      host.appendChild(c);
    });
  }

  // ---- actions ----
  function savePreset () {
    const name = $('#aa-preset-name').value.trim() || ('Theme ' + new Date().toLocaleString());
    const t = getCurrent();
    const arr = JSON.parse(localStorage.getItem('aa.userPresets') || '[]');
    arr.unshift({ name, tokens: t, ts: Date.now() });
    localStorage.setItem('aa.userPresets', JSON.stringify(arr));
    $('#aa-preset-name').value = '';
    renderUserPresets();
  }
  function clearLogo () {
    localStorage.removeItem('aa.customLogo');
    $('#aa-logo-preview').style.backgroundImage = '';
    document.querySelectorAll('.brand .logo').forEach(l => { l.classList.remove('custom'); l.style.removeProperty('--custom-logo'); });
  }
  function saveCSS () {
    localStorage.setItem('aa.css', $('#aa-css').value);
    applyCustomCSS();
  }
  function resetAll () {
    if (!confirm('Reset all customizations (theme, logo, CSS, animation, presets)?')) return;
    ['aa.theme','aa.userPresets','aa.css','aa.customLogo','aa.anim','aa.animDur'].forEach(k => localStorage.removeItem(k));
    location.reload();
  }
  function exportJSON () {
    const data = {
      theme:   JSON.parse(localStorage.getItem('aa.theme') || 'null'),
      presets: JSON.parse(localStorage.getItem('aa.userPresets') || '[]'),
      css:     localStorage.getItem('aa.css') || '',
      anim:    localStorage.getItem('aa.anim') || '',
      logo:    localStorage.getItem('aa.customLogo') ? '(custom logo present, ' + Math.round(localStorage.getItem('aa.customLogo').length / 1024) + 'KB)' : null
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => alert('Settings copied to clipboard.'));
  }

  // ---- open / close ----
  function open () {
    ensureSheet();
    $('#aa-user-settings').classList.add('open');
    renderPresets();
    renderUserPresets();
    renderTokens();
    // anim
    const anim = localStorage.getItem('aa.anim') || 'aa-fade-up';
    $('#aa-anim').value = anim;
    $('#aa-anim').addEventListener('change', e => {
      localStorage.setItem('aa.anim', e.target.value);
      document.documentElement.style.setProperty('--enter-anim', e.target.value);
    }, { once: true });
    // logo
    const url = localStorage.getItem('aa.customLogo');
    if (url) $('#aa-logo-preview').style.backgroundImage = `url("${url}")`;
    const upload = $('#aa-logo-upload');
    if (!upload.dataset.bound) {
      upload.dataset.bound = '1';
      upload.addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 500_000) { alert('Too big — under 500KB.'); return; }
        const r = new FileReader();
        r.onload = () => {
          const dataUrl = r.result;
          localStorage.setItem('aa.customLogo', dataUrl);
          $('#aa-logo-preview').style.backgroundImage = `url("${dataUrl}")`;
          document.querySelectorAll('.brand .logo').forEach(l => { l.classList.add('custom'); l.style.setProperty('--custom-logo', `url("${dataUrl}")`); });
        };
        r.readAsDataURL(f);
      });
    }
    // css
    $('#aa-css').value = localStorage.getItem('aa.css') || '';
  }
  function close () { $('#aa-user-settings')?.classList.remove('open'); }

  // ---- floating button ----
  function ensureFAB () {
    if ($('#aa-settings-fab')) return;
    const b = document.createElement('button');
    b.id = 'aa-settings-fab';
    b.title = 'User settings';
    b.innerHTML = '⚙';
    b.style.cssText = 'position:fixed;bottom:78px;left:18px;z-index:50;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:var(--bg-2);color:var(--fg);cursor:pointer;font-size:18px;box-shadow:var(--shadow);display:none';
    document.body.appendChild(b);
    b.addEventListener('click', open);
    // show only on role pages (anarchist/partner/publisher/market/admin) — public site has its own header button
    if (document.body.dataset.role) b.style.display = 'grid';
    b.style.placeItems = 'center';
  }

  // ---- boot ----
  applyAll();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureFAB);
  } else {
    ensureFAB();
  }

  window.AA_SETTINGS = { open, close, applyAll, tokens: TOKENS };
})();
