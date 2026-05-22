/* ANARCHISM.AFRICA — logo source resolver + corner randomizer + drag-drop upload
 *
 * Source priority (first reachable wins):
 *   1. localStorage['aa.user.logo']   - user-uploaded data URL (admin/publisher drop-zone)
 *   2. /icons/AAlogo1.svg             - the curated brand logo (canonical)
 *   3. /icons/AA-logo1.png            - PNG variant fallback
 *
 * Logo-corner click → cycles through small-format display modes:
 *   default | pattern (small SVG) | gif (when AA_CONFIG.giphy_api_key present)
 * Lock state per user via localStorage['aa.logo.mode'].
 *
 * Drag-and-drop on the .menu-toggle button:
 *   admin / publisher → file becomes the new logo, saved to localStorage
 *   (no upload to server in this version — admins can later sync to Blob)
 *
 * Public API: window.AA.logo
 *   .src()          → currently active logo URL
 *   .setUser(url)   → set custom user logo (data URL or http URL)
 *   .clearUser()    → revert to default sources
 *   .randomize()    → cycle to next mode
 *   .lock(bool)     → freeze the current mode
 */
(function () {
  const SOURCES = [
    'localStorage:aa.user.logo',
    '/icons/AAlogo1.svg',
    '/icons/AA-logo1.png'
  ];
  const LOGO_MODE_KEY = 'aa.logo.mode';        // { mode, locked }

  function readMode () { try { return JSON.parse(localStorage.getItem(LOGO_MODE_KEY) || '{}'); } catch { return {}; } }
  function writeMode (v) { try { localStorage.setItem(LOGO_MODE_KEY, JSON.stringify({ ...readMode(), ...v })); } catch {} }
  function userLogo () { try { return localStorage.getItem('aa.user.logo') || ''; } catch { return ''; } }

  async function probe (url) {
    try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch { return false; }
  }

  let _visitorCache = null;
  async function fetchVisitorDefaults () {
    if (_visitorCache) return _visitorCache;
    try {
      const r = await fetch('/api/site/visitor-defaults', { cache: 'no-store' });
      if (r.ok) { _visitorCache = await r.json(); return _visitorCache; }
    } catch {}
    _visitorCache = {};
    return _visitorCache;
  }
  async function resolveDefault () {
    if (userLogo()) return userLogo();
    const v = await fetchVisitorDefaults();
    if (v && v.logo_url) {
      // probe; if reachable, use; else fall through
      if (v.logo_url.startsWith('data:') || await probe(v.logo_url)) return v.logo_url;
    }
    for (const src of SOURCES.slice(1)) {
      if (await probe(src)) return src;
    }
    return SOURCES[SOURCES.length - 1];
  }
  // expose visitor-defaults loader to the rest of the app
  window.AA = window.AA || {};
  window.AA.visitorDefaults = fetchVisitorDefaults;

  function setMarkBg (url) {
    document.querySelectorAll('.brand .logo').forEach(el => {
      if (el.classList.contains('custom')) return;
      el.style.backgroundImage = `url('${url}')`;
    });
    document.querySelectorAll('.menu-toggle .logo').forEach(el => {
      el.style.backgroundImage = `url('${url}')`;
    });
  }
  function setFavicon (url) {
    document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(l => l.href = url);
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(m => m.setAttribute('content', url));
  }

  // ---- modes for the corner -------------------------------------------
  // 'default' uses resolved logo URL; 'pattern' renders a tiny SVG; 'gif' pulls from Giphy.
  const PATTERN_FNS = {
    kente   (r) { let s=''; let y=0; while (y<48) { const t=1+Math.floor(r()*5); s+=`<rect x="0" y="${y}" width="48" height="${t}" fill="#fff" opacity="${(0.3+r()*0.7).toFixed(2)}"/>`; y+=t+1; } return s; },
    adinkra (r) { let s=''; const c=10; for(let x=c/2;x<48;x+=c)for(let y=c/2;y<48;y+=c)if(r()>0.45)s+=`<circle cx="${x}" cy="${y}" r="${1+r()*2.5}" fill="#fff" opacity="${(0.4+r()*0.6).toFixed(2)}"/>`; return s; },
    kuba    (r) { let s=''; const c=12; for(let i=0;i<48;i+=c)for(let j=0;j<48;j+=c){if(r()>0.4){const f=r()>0.5;const p=f?`${i},${j} ${i+c},${j} ${i},${j+c}`:`${i+c},${j} ${i+c},${j+c} ${i},${j+c}`;s+=`<polygon points="${p}" fill="#fff" opacity="${(0.3+r()*0.6).toFixed(2)}"/>`;}} return s; },
    sona    (r) { let s=''; for (let n=0;n<3;n++){ const y=12+n*12+r()*4; let d=`M 0 ${y.toFixed(1)}`; for(let x=0;x<48;x+=8){const dy=(Math.sin((x+r()*100)*0.12)*4+r()*2-1).toFixed(1);d+=` Q ${x+4} ${(y+dy).toFixed(1)} ${x+8} ${y.toFixed(1)}`;} s+=`<path d="${d}" fill="none" stroke="#fff" stroke-width="${(0.6+r()*1.4).toFixed(1)}" opacity="${(0.4+r()*0.5).toFixed(2)}"/>`;} return s; }
  };
  function rng (seed) { let s = seed >>> 0; return () => (s = (s*1664525 + 1013904223) >>> 0)/0xffffffff; }
  function patternDataUrl () {
    const families = Object.keys(PATTERN_FNS);
    const fam = families[Math.floor(Math.random() * families.length)];
    const r = rng(Date.now());
    const inner = PATTERN_FNS[fam](r);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#000"/>${inner}</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  async function gifSrc () {
    const key = (window.AA_CONFIG && window.AA_CONFIG.giphy_api_key) || null;
    if (!key) return null;
    try {
      const tags = ['kente','adinkra','sun ra','afrofuturism','dance africa','protest dance'];
      const tag = tags[Math.floor(Math.random() * tags.length)];
      const r = await fetch(`https://api.giphy.com/v1/gifs/random?api_key=${key}&tag=${encodeURIComponent(tag)}&rating=pg`);
      const d = await r.json();
      return d?.data?.images?.fixed_height_small?.url || d?.data?.images?.fixed_height?.url || null;
    } catch { return null; }
  }

  // ---- Public API -----------------------------------------------------
  let currentDefault = '';
  async function applyDefault () {
    currentDefault = await resolveDefault();
    setMarkBg(currentDefault);
    setFavicon(currentDefault);
  }
  function setUser (url) {
    if (!url) return;
    try { localStorage.setItem('aa.user.logo', url); } catch {}
    setMarkBg(url); setFavicon(url);
  }
  function clearUser () {
    try { localStorage.removeItem('aa.user.logo'); } catch {}
    applyDefault();
  }
  async function randomize () {
    const order = ['default', 'pattern', 'gif'];
    const cur = readMode().mode || 'default';
    let next = order[(order.indexOf(cur) + 1) % order.length];
    if (next === 'gif') {
      const url = await gifSrc();
      if (!url) next = order[(order.indexOf('gif') + 1) % order.length];
      else { setMarkBg(url); writeMode({ mode: 'gif' }); return; }
    }
    if (next === 'pattern') { setMarkBg(patternDataUrl()); writeMode({ mode: 'pattern' }); return; }
    applyDefault(); writeMode({ mode: 'default' });
  }
  function lock (val) { writeMode({ locked: !!val }); document.querySelectorAll('.menu-toggle').forEach(b => b.classList.toggle('locked', !!val)); }

  // ---- Wire the logo button -------------------------------------------
  function bindLogoButton () {
    document.querySelectorAll('.menu-toggle').forEach(btn => {
      if (btn.dataset.logoBound === '1') return;
      btn.dataset.logoBound = '1';
      // Single click → existing menu/rail toggle (preserved by app.js & menu-behavior.js).
      // Long-press OR Shift-click on the logo → randomize.
      let pressTimer;
      btn.addEventListener('mousedown', e => {
        pressTimer = setTimeout(() => randomize(), 600);
      });
      ['mouseup','mouseleave'].forEach(ev => btn.addEventListener(ev, () => clearTimeout(pressTimer)));
      btn.addEventListener('click', e => {
        if (e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); randomize(); }
      }, true);
      btn.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopImmediatePropagation();
        const newLocked = !readMode().locked;
        lock(newLocked);
      }, true);

      // ---- Drag & drop logo upload (admin / publisher) ----
      // Drop is open to every user — overrides are local-only (per-device).
      // Admin / publisher additionally see a "Set as visitor default" prompt
      // after dropping, which writes to /api/site/visitor-defaults.
      const role = document.body.dataset.role || '';
      const isAdminish = ['admin', 'publisher'].includes(role) ||
                         sessionStorage.getItem('aa.session.admin') === 'ok' ||
                         sessionStorage.getItem('aa.session.publisher') === 'ok';
      btn.title = (btn.title ? btn.title + ' · ' : '') + 'Drop a PNG/SVG to set as the app logo';
      btn.addEventListener('dragover', e => { e.preventDefault(); btn.classList.add('logo-droppable'); });
      btn.addEventListener('dragleave', () => btn.classList.remove('logo-droppable'));
      btn.addEventListener('drop', e => {
        e.preventDefault();
        btn.classList.remove('logo-droppable');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (file.size > 700 * 1024) {
          alert('Logo too big — keep under 700KB.');
          return;
        }
        if (!/^image\//.test(file.type)) {
          alert('Drop an image file (SVG, PNG, JPG).');
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          setUser(reader.result);
          if (isAdminish && confirm('Save this as the visitor default (everyone sees it)?')) {
            const token = prompt('Paste your admin token to confirm:');
            if (!token) return;
            try {
              await fetch('/api/site/visitor-defaults', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-aa-admin-token': token },
                body: JSON.stringify({ logo_url: reader.result })
              });
            } catch {}
          }
        };
        reader.readAsDataURL(file);
      });
    });
  }

  // ---- Init ------------------------------------------------------------
  function init () {
    bindLogoButton();
    const m = readMode();
    if (m.locked && m.mode === 'pattern') setMarkBg(patternDataUrl());
    else if (m.locked && m.mode === 'gif') gifSrc().then(u => u && setMarkBg(u));
    else applyDefault();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AA = window.AA || {};
  window.AA.logo = { src: () => userLogo() || currentDefault, setUser, clearUser, randomize, lock };
})();
