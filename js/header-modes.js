/* ANARCHISM.AFRICA — header-modes
 *
 * The header isn't just the wordmark anymore. It's a 5-mode display surface:
 *   1. TITLE    — the app wordmark (existing random-font behavior in logo.js)
 *   2. QUOTE    — a random afro-anarchist slogan/quote, minimalist serif/mono
 *   3. PATTERN  — a procedural African geometric pattern (kente / kuba / adinkra
 *                 grid / ndebele triangles / sona) — interactive
 *   4. GIF      — a random afro-art/anarchism/music GIF (Giphy when GIPHY_API_KEY
 *                 is wired; falls back to a curated placeholder bank)
 *   5. AD       — rotating announcement: upcoming events, new releases, merch drops
 *
 * Each mode has a button. Click → switch to that mode + randomize within it.
 * Double-click → lock that mode (no further auto-randomization).
 * Lock state persists per-mode in localStorage['aa.header.mode'].
 *
 * The TITLE mode keeps using js/logo.js to swap fonts on the wordmark.
 * Other modes swap the wordmark area for their own content while active.
 */
(function () {
  const KEY = 'aa.header.mode';      // { mode: 'title'|'quote'|...,  locks: { mode: bool } }
  const MODES = ['title', 'quote', 'pattern', 'gif', 'ad'];

  const $ = (s, r = document) => r.querySelector(s);
  const read  = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...v })); } catch {} };

  // ---- mode renderers ---------------------------------------------------
  function showTitle (host) {
    // Restore the original wordmark — logo.js handles fonts/anim
    host.innerHTML = `
      <a class="brand" href="#home">
        <span class="logoword"><span class="word">ANARCHISM<span class="dot">.</span>AFRICA</span></span>
      </a>`;
  }

  let quoteCache = null;
  async function loadQuotes () {
    if (quoteCache) return quoteCache;
    try {
      const [aQ, aS] = await Promise.all([
        fetch('data/afro-anarchist-quotes.json').then(r => r.json()).catch(() => ({})),
        fetch('https://blob.vercel-storage.com/content/merch/slogans.json?ts=' + Date.now()).then(r => r.ok ? r.json() : ({ items: [] })).catch(() => ({ items: [] }))
      ]);
      const fromQuotes = (aQ.quotes || []).map(q => ({ text: q.text, attribution: q.author + (q.year ? ' · ' + q.year : '') }));
      const fromSlogans = (aS.items || []).map(s => ({ text: s.text, attribution: '' }));
      quoteCache = [...fromSlogans, ...fromQuotes];
    } catch { quoteCache = []; }
    return quoteCache;
  }
  async function showQuote (host) {
    const list = await loadQuotes();
    if (!list.length) { showTitle(host); return; }
    const q = list[Math.floor(Math.random() * list.length)];
    host.innerHTML = `
      <div class="hm-quote">
        <span class="hm-quote-text">${escapeHTML(q.text)}</span>
        ${q.attribution ? `<span class="hm-quote-attr">— ${escapeHTML(q.attribution)}</span>` : ''}
      </div>`;
  }

  // ---- procedural African patterns -------------------------------------
  // 5 pattern families. Each takes a seed and renders a tileable SVG.
  function hash (s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h<<5)+h+s.charCodeAt(i))|0; return Math.abs(h); }
  function rng (seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff; }

  function patternKente (r) {
    let bands = ''; let y = 0;
    while (y < 60) { const h = 1 + Math.floor(r() * 6); bands += `<rect x="0" y="${y}" width="320" height="${h}" fill="currentColor" opacity="${(0.15 + r()*0.85).toFixed(2)}"/>`; y += h + 1; }
    return bands;
  }
  function patternAdinkra (r) {
    let dots = ''; const cell = 16;
    for (let x = cell/2; x < 320; x += cell) for (let y = cell/2; y < 60; y += cell) {
      if (r() > 0.5) dots += `<circle cx="${x}" cy="${y}" r="${1 + r()*3}" fill="currentColor" opacity="${(0.3+r()*0.7).toFixed(2)}"/>`;
    }
    return dots;
  }
  function patternKuba (r) {
    let tris = ''; const cell = 16;
    for (let i = 0; i < 320; i += cell) for (let j = 0; j < 60; j += cell) {
      if (r() > 0.4) {
        const flip = r() > 0.5;
        const pts = flip ? `${i},${j} ${i+cell},${j} ${i},${j+cell}` : `${i+cell},${j} ${i+cell},${j+cell} ${i},${j+cell}`;
        tris += `<polygon points="${pts}" fill="currentColor" opacity="${(0.2+r()*0.7).toFixed(2)}"/>`;
      }
    }
    return tris;
  }
  function patternNdebele (r) {
    let blocks = ''; const cell = 14;
    for (let i = 0; i < 320; i += cell) for (let j = 0; j < 60; j += cell) {
      if (r() > 0.3) {
        const sz = cell - 2 - r() * 4;
        blocks += `<rect x="${i+(cell-sz)/2}" y="${j+(cell-sz)/2}" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="${(0.5 + r()*1.5).toFixed(1)}" opacity="${(0.3+r()*0.7).toFixed(2)}"/>`;
      }
    }
    return blocks;
  }
  function patternSona (r) {
    // Sand-drawing curls — sinuous lines
    let path = '';
    for (let n = 0; n < 5; n++) {
      const y = 8 + n * 12 + r() * 6;
      let d = `M 0 ${y.toFixed(1)}`;
      for (let x = 0; x < 320; x += 16) {
        const dy = (Math.sin((x + r()*100) * 0.06) * 4 + r() * 3 - 1.5).toFixed(1);
        d += ` Q ${x+8} ${(y+dy).toFixed(1)} ${x+16} ${y.toFixed(1)}`;
      }
      path += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${(0.6 + r()*1.4).toFixed(1)}" opacity="${(0.3+r()*0.6).toFixed(2)}"/>`;
    }
    return path;
  }
  const PATTERN_FNS = [patternKente, patternAdinkra, patternKuba, patternNdebele, patternSona];
  const PATTERN_NAMES = ['kente', 'adinkra', 'kuba', 'ndebele', 'sona'];

  function showPattern (host, seedHint) {
    const seed = hash(seedHint || ('p' + Date.now()));
    const r = rng(seed);
    const which = Math.floor(r() * PATTERN_FNS.length);
    const inner = PATTERN_FNS[which](r);
    host.innerHTML = `
      <div class="hm-pattern" data-pattern="${PATTERN_NAMES[which]}" title="African pattern: ${PATTERN_NAMES[which]} (click to remix)">
        <svg viewBox="0 0 320 60" preserveAspectRatio="xMidYMid slice">${inner}</svg>
        <span class="hm-pattern-label">${PATTERN_NAMES[which]}</span>
      </div>`;
    host.querySelector('.hm-pattern')?.addEventListener('click', () => showPattern(host, 'p' + Date.now()));
  }

  // ---- GIF (placeholder bank — replace with Giphy when key present) ----
  // Curated short list of CC / public-domain GIF URLs related to afro-anarchism, music, art.
  const GIF_BANK = [
    // These are deterministic placeholder data-URI patterns; swap for live Giphy on your end
    null
  ];
  async function showGif (host) {
    const key = (window.AA_CONFIG && window.AA_CONFIG.giphy_api_key) || null;
    const tags = ['afrofuturism','afrobeat','black panther party','kente','sun ra','fela kuti','ndebele','protest dance','dance africa','sankofa'];
    const tag = tags[Math.floor(Math.random() * tags.length)];
    if (key) {
      try {
        const r = await fetch(`https://api.giphy.com/v1/gifs/random?api_key=${key}&tag=${encodeURIComponent(tag)}&rating=pg`);
        const d = await r.json();
        const url = d?.data?.images?.original?.url || d?.data?.images?.fixed_height?.url;
        if (url) {
          host.innerHTML = `<div class="hm-gif"><img src="${url}" alt="${tag}"/><span class="hm-gif-tag">#${tag}</span></div>`;
          return;
        }
      } catch {}
    }
    // Fallback — render the same procedural pattern but over a brighter accent
    host.innerHTML = `<div class="hm-gif hm-gif-fallback"><span class="hm-gif-tag">GIF · ${tag}</span><span class="hm-gif-hint">Set <code>AA_CONFIG.giphy_api_key</code> for live GIFs</span></div>`;
  }

  // ---- Ad / announcements ----------------------------------------------
  let adsCache = null;
  async function loadAds () {
    if (adsCache) return adsCache;
    try {
      const seed = window.AA?.loadSeed ? await window.AA.loadSeed() : await fetch('data/seed.json').then(r => r.json());
      const evs    = (seed.events   || []).filter(e => e.starts_at && new Date(e.starts_at).getTime() > Date.now()).slice(0, 8).map(x => ({ kind: 'event',   title: x.title, sub: new Date(x.starts_at).toLocaleDateString() + (x.city ? ' · ' + x.city : ''), id: x.id }));
      const films  = (seed.films    || []).slice(0, 5).map(x => ({ kind: 'film',    title: x.title, sub: x.director  || '', id: x.id }));
      const books  = (seed.books    || []).slice(0, 5).map(x => ({ kind: 'book',    title: x.title, sub: x.author    || '', id: x.id }));
      const merch  = (seed.merch    || []).slice(0, 5).map(x => ({ kind: 'merch',   title: x.title, sub: 'merch drop' + (x.price_eur ? ' · €' + x.price_eur : ''), id: x.id }));
      const arts   = (seed.articles || []).slice(0, 5).map(x => ({ kind: 'article', title: x.title, sub: x.author    || '', id: x.id }));
      adsCache = [...evs, ...films, ...books, ...merch, ...arts];
    } catch { adsCache = []; }
    return adsCache;
  }
  async function showAd (host) {
    const list = await loadAds();
    if (!list.length) { showTitle(host); return; }
    const a = list[Math.floor(Math.random() * list.length)];
    host.innerHTML = `
      <a class="hm-ad" href="item.html?type=${a.kind}&id=${encodeURIComponent(a.id)}">
        <span class="hm-ad-kind">${a.kind.toUpperCase()}</span>
        <span class="hm-ad-title">${escapeHTML(a.title)}</span>
        ${a.sub ? `<span class="hm-ad-sub">${escapeHTML(a.sub)}</span>` : ''}
      </a>`;
  }

  // ---- mode controller --------------------------------------------------
  function getHost () {
    // The wordmark area inside .brand-wrap. We re-paint inside the .brand-wrap
    // every time so no leftover from previous mode survives.
    return document.querySelector('.brand-wrap');
  }

  async function activate (mode) {
    const host = getHost(); if (!host) return;
    // Strip the brand-wrap of everything except the .logo-shuffle and .logo-lock
    // (we keep the random buttons; they apply per-mode meaning)
    const tools = Array.from(host.querySelectorAll('.logo-shuffle, .logo-lock')).map(el => el.outerHTML).join('');
    host.innerHTML = '';
    // Each mode renders into a wrapper div first, then we re-append the tools at the end
    if      (mode === 'title')   showTitle(host);
    else if (mode === 'quote')   await showQuote(host);
    else if (mode === 'pattern') showPattern(host);
    else if (mode === 'gif')     await showGif(host);
    else if (mode === 'ad')      await showAd(host);
    if (tools) host.insertAdjacentHTML('beforeend', tools);
    // re-bind the shuffle/lock since logo.js wired before paint — quick rebind:
    document.querySelectorAll('.logo-shuffle:not([data-hm-bound])').forEach(b => {
      b.dataset.hmBound = '1';
      b.addEventListener('click', () => { /* logo.js handles when mode === title */ });
    });
    write({ mode });
    paintModeButtons(mode);
  }

  function paintModeButtons (active) {
    document.querySelectorAll('.hm-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === active);
      b.setAttribute('aria-pressed', b.dataset.mode === active);
    });
  }

  function ensureModeBar () {
    if (document.getElementById('hm-bar')) return;
    const tb = document.querySelector('.topbar'); if (!tb) return;
    const bar = document.createElement('div');
    bar.id = 'hm-bar'; bar.className = 'hm-bar';
    bar.innerHTML = MODES.map(m => `
      <button class="hm-mode-btn" data-mode="${m}" type="button" title="${labelFor(m)}" aria-label="${labelFor(m)}">${glyphFor(m)}</button>
    `).join('');
    tb.appendChild(bar);
    bar.addEventListener('click', e => {
      const b = e.target.closest('.hm-mode-btn'); if (!b) return;
      activate(b.dataset.mode);
    });
    bar.addEventListener('dblclick', e => {
      const b = e.target.closest('.hm-mode-btn'); if (!b) return;
      const cur = read(); cur.locks = cur.locks || {}; cur.locks[b.dataset.mode] = !cur.locks[b.dataset.mode];
      write(cur);
      b.classList.toggle('locked', !!cur.locks[b.dataset.mode]);
    });
  }

  function labelFor (m) {
    return ({ title: 'Title font shuffle', quote: 'Random quote', pattern: 'African pattern', gif: 'Random GIF', ad: 'What\'s coming up' })[m] || m;
  }
  function glyphFor (m) {
    return ({ title: 'Aa', quote: '“"', pattern: '▦', gif: '◐', ad: '◔' })[m] || '·';
  }

  // ---- 9-second auto-revert behavior -----------------------------------
  // When user hits a non-title mode button, the header flips for 9 s and reverts
  // to TITLE — UNLESS the mode is locked (double-click toggle on the button).
  let revertTimer;
  const ORIG_activate = activate;
  // wrap activate so non-title modes auto-revert
  activate = async function wrappedActivate (mode) {
    clearTimeout(revertTimer);
    await ORIG_activate(mode);
    if (mode === 'title') return;
    const locks = (read().locks) || {};
    if (locks[mode]) return; // user locked it — stay
    revertTimer = setTimeout(() => ORIG_activate('title'), 9000);
  };

  // ---- init -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    ensureModeBar();
    // Restore any locked mode on load; otherwise default to title
    const saved = read();
    const locked = saved.locks && Object.keys(saved.locks).find(k => saved.locks[k]);
    if (locked) ORIG_activate(locked);
    else if (saved.mode && saved.mode !== 'title') ORIG_activate(saved.mode);
  });

  function escapeHTML (s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }

  window.AA_HEADER_MODES = { activate, MODES };
})();
