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
  // ── Ancient African symbol patterns ─────────────────────────────────────────
  // Eight civilisations, each rendered as an animated SVG (SMIL, infinite loop).
  // patternDataUrl() picks one at random; the animation makes them feel like
  // seamless looping GIFs when used as a background-image on the logo corner.
  const PATTERN_FNS = {

    // Kemet (Ancient Egypt) — ankh symbols in gold, pulsing opacity
    kemet (r) {
      let s = '';
      [[8,10],[32,10],[8,34],[32,34],[20,22]].forEach(([cx,cy]) => {
        const dur = (2.2+r()*1.4).toFixed(1);
        const d   = (r()*1.5).toFixed(2);
        s += `<g opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.25;0.9" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>
          <ellipse cx="${cx}" cy="${cy-4}" rx="3" ry="3.5" fill="none" stroke="#c8a000" stroke-width="1"/>
          <line x1="${cx}" y1="${cy-1}" x2="${cx}" y2="${cy+6}" stroke="#c8a000" stroke-width="1"/>
          <line x1="${cx-3.5}" y1="${cy+1}" x2="${cx+3.5}" y2="${cy+1}" stroke="#c8a000" stroke-width="1"/>
        </g>`;
      });
      return s;
    },

    // Adinkra (Akan / Ghana) — Sankofa circle-heart form, gold, breathes
    adinkra (r) {
      let s = '';
      [[8,8],[40,8],[8,40],[40,40],[24,24]].forEach(([cx,cy]) => {
        const dur = (2.2+r()*1.6).toFixed(1);
        const d   = (r()*1.8).toFixed(2);
        s += `<g opacity="0.82">
          <animate attributeName="opacity" values="0.82;0.22;0.82" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>
          <circle cx="${cx}" cy="${cy-2}" r="5" fill="none" stroke="#e8b800" stroke-width="0.95"/>
          <path d="M${cx-3},${cy+1} Q${cx},${cy+8} ${cx+3},${cy+1}" fill="none" stroke="#e8b800" stroke-width="0.95"/>
          <circle cx="${cx}" cy="${cy-2}" r="1.6" fill="#e8b800" opacity="0.75"/>
        </g>`;
      });
      return s;
    },

    // Nsibidi (Cross River, Nigeria / Cameroon) — eye-mirror + crossroads
    nsibidi (r) {
      let s = '';
      for (let x = 8; x < 48; x += 16) for (let y = 8; y < 48; y += 16) {
        const dur = (2.6+r()*1.5).toFixed(1);
        const d   = (r()*2.2).toFixed(2);
        const y4  = (y-4).toFixed(1);
        const y5  = (y+5).toFixed(1);
        s += `<g opacity="0.85">
          <animate attributeName="opacity" values="0.85;0.18;0.85" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>
          <path d="M${x-5},${y} Q${x},${y4} ${x+5},${y} Q${x},${y5} ${x-5},${y} Z" fill="none" stroke="#e0e0e0" stroke-width="0.85"/>
          <circle cx="${x}" cy="${y}" r="1.3" fill="#fff" opacity="0.9"/>
          <line x1="${x}" y1="${y+3}" x2="${x}" y2="${y+7}" stroke="#e0e0e0" stroke-width="0.7"/>
          <line x1="${x-2}" y1="${y+5}" x2="${x+2}" y2="${y+5}" stroke="#e0e0e0" stroke-width="0.7"/>
        </g>`;
      }
      return s;
    },

    // Tifinagh / Amazigh (North Africa) — ancient Berber script geometry, blue drift
    tifinagh (r) {
      const glyphs = [
        (x,y) => `<line x1="${x-4}" y1="${y}" x2="${x+4}" y2="${y}" stroke="#9ad4ff" stroke-width="1"/>
                   <line x1="${x}" y1="${y-4}" x2="${x}" y2="${y+4}" stroke="#9ad4ff" stroke-width="1"/>
                   <circle cx="${x}" cy="${y}" r="1.3" fill="#9ad4ff"/>`,
        (x,y) => `<path d="M${x-4},${y+2} A4,4 0 1 1 ${x+4},${y+2}" fill="none" stroke="#9ad4ff" stroke-width="1"/>
                   <line x1="${x-4}" y1="${y+2}" x2="${x+4}" y2="${y+2}" stroke="#9ad4ff" stroke-width="0.8"/>`,
        (x,y) => `<polygon points="${x},${y-4} ${x-4},${y+3} ${x+4},${y+3}" fill="none" stroke="#9ad4ff" stroke-width="0.9"/>`,
        (x,y) => `<path d="M${x-4},${y+3} Q${x-1.5},${y-3} ${x},${y+3} Q${x+1.5},${y-3} ${x+4},${y+3}" fill="none" stroke="#9ad4ff" stroke-width="0.9"/>`,
      ];
      let s = ''; let idx = 0;
      for (let x = 8; x < 48; x += 16) for (let y = 8; y < 48; y += 16) {
        const dur = (3+r()*2).toFixed(1);
        const d   = (r()*2.5).toFixed(2);
        s += `<g opacity="0.85"><animate attributeName="opacity" values="0.85;0.15;0.85" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>${glyphs[idx%glyphs.length](x,y)}</g>`;
        idx++;
      }
      return s;
    },

    // Kuba Kingdom (DRC / Congo) — diamond shoowa weave, slowly rotating
    kuba (r) {
      const COLS = ['#c8a000','#8b0000','#f5e090','#b85c00','#5a1800'];
      let s = '';
      for (let x = 0; x < 48; x += 12) for (let y = 0; y < 48; y += 12) {
        const cx  = x+6, cy = y+6;
        const c1  = COLS[Math.floor(r()*COLS.length)];
        const c2  = COLS[Math.floor(r()*COLS.length)];
        const dur = (4.5+r()*3).toFixed(1);
        const d   = (r()*2).toFixed(2);
        s += `<g>
          <animateTransform attributeName="transform" type="rotate"
            values="0 ${cx} ${cy};90 ${cx} ${cy};0 ${cx} ${cy}"
            dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>
          <polygon points="${cx},${cy-5} ${cx+5},${cy} ${cx},${cy+5} ${cx-5},${cy}" fill="${c1}" opacity="0.72"/>
          <polygon points="${cx},${cy-2.5} ${cx+2.5},${cy} ${cx},${cy+2.5} ${cx-2.5},${cy}" fill="${c2}" opacity="0.88"/>
        </g>`;
      }
      return s;
    },

    // Sona / Chokwe (Angola) — sand-drawing paths that trace and retrace
    sona (r) {
      let s = '';
      for (let n = 0; n < 4; n++) {
        const cy  = (8 + n*11 + r()*3).toFixed(1);
        const cy2 = (parseFloat(cy) - 7 + r()*5).toFixed(1);
        const cy3 = (parseFloat(cy) + 6 - r()*5).toFixed(1);
        const dur = (1.8+r()*1.2).toFixed(1);
        const d   = (n*0.45).toFixed(2);
        const L   = 100;
        s += `<path d="M0,${cy} Q12,${cy2} 24,${cy} Q36,${cy3} 48,${cy}"
          fill="none" stroke="#e8c060" stroke-width="1.3" opacity="0.82"
          stroke-dasharray="${L}" stroke-dashoffset="${L}">
          <animate attributeName="stroke-dashoffset" values="${L};0;${-L};0;${L}" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>
        </path>`;
      }
      return s;
    },

    // Dogon (Mali) — 8-pointed Sirius stars slowly orbiting, cosmological
    dogon (r) {
      let s = '';
      [[24,24],[8,8],[40,8],[8,40],[40,40]].forEach(([cx,cy],i) => {
        const spin = (9+r()*7).toFixed(0);
        const pd   = (i*0.55).toFixed(2);
        const bd   = (r()*1.5).toFixed(2);
        const bur  = (1.5+r()*1.5).toFixed(1);
        s += `<g>
          <animateTransform attributeName="transform" type="rotate"
            values="0 ${cx} ${cy};360 ${cx} ${cy}"
            dur="${spin}s" begin="${pd}s" repeatCount="indefinite"/>
          <polygon points="
            ${cx},${cy-5} ${cx+1.5},${cy-1.5} ${cx+5},${cy-5}
            ${cx+1.5},${cy} ${cx+5},${cy+5} ${cx+1.5},${cy+1.5}
            ${cx},${cy+5} ${cx-1.5},${cy+1.5} ${cx-5},${cy+5}
            ${cx-1.5},${cy} ${cx-5},${cy-5} ${cx-1.5},${cy-1.5}"
            fill="#c8a000" opacity="0.85"/>
        </g>
        <circle cx="${cx}" cy="${cy}" r="1.4" fill="#fff" opacity="0.7">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="${bur}s" begin="${bd}s" repeatCount="indefinite"/>
        </circle>`;
      });
      return s;
    },

    // Ndebele / Zulu (South Africa) — bold geometric triangles, colour-pulse
    ndebele (r) {
      const COLS = ['#e74c3c','#f39c12','#2ecc71','#3498db','#9b59b6','#e8c060','#ff6b35'];
      const SZ = 8;
      let s = '';
      for (let x = 0; x < 48; x += SZ) for (let y = 0; y < 48; y += SZ) {
        if (r() < 0.38) continue;
        const col  = COLS[Math.floor(r()*COLS.length)];
        const dur  = (2.8+r()*2).toFixed(1);
        const d    = (r()*1.8).toFixed(2);
        const flip = r() < 0.5;
        const pts  = flip
          ? `${x},${y+SZ} ${x+SZ/2},${y} ${x+SZ},${y+SZ}`
          : `${x},${y} ${x+SZ/2},${y+SZ} ${x+SZ},${y}`;
        s += `<polygon points="${pts}" fill="${col}" opacity="0.72">
          <animate attributeName="opacity" values="0.72;0.18;0.72" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>
        </polygon>`;
      }
      return s;
    }
  };

  function rng (seed) { let s = seed >>> 0 || 1; return () => (s = (s*1664525 + 1013904223) >>> 0)/0xffffffff; }

  // Background tones keyed to each civilisation's night palette
  const PATTERN_BG = {
    kemet:'#1a0800', adinkra:'#0a0800', nsibidi:'#101010', tifinagh:'#080d18',
    kuba:'#130400',  sona:'#0b0900',    dogon:'#04040f',   ndebele:'#0e080a'
  };

  function patternDataUrl () {
    const families = Object.keys(PATTERN_FNS);
    const fam   = families[Math.floor(Math.random() * families.length)];
    const r     = rng(Date.now());
    const bg    = PATTERN_BG[fam] || '#000';
    const inner = PATTERN_FNS[fam](r);
    const svg   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${bg}"/>${inner}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
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
