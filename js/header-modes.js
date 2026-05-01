/* ANARCHISM.AFRICA — header modes
 * 5 modes activated by mode-bar buttons:
 *   TITLE   — wordmark only, no bg
 *   QUOTE   — wordmark replaced with full quote; auto-marquee if it overflows
 *   PATTERN — full-header African pattern bg + wordmark on top
 *   GIF     — full-header GIF bg + wordmark on top
 *   AD      — wordmark replaced with rotating announcement; auto-marquee if overflow
 *
 * 9-second auto-revert to TITLE unless the mode is locked (double-click).
 */
(function () {
  const KEY = 'aa.header.mode';
  const MODES = ['title', 'quote', 'pattern', 'gif', 'ad'];
  const $ = (s, r=document) => r.querySelector(s);
  const read  = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...v })); } catch {} };
  const escapeHTML = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));

  // ---- DOM helpers -----------------------------------------------------
  const wordmarkHTML = `
    <a class="brand" href="#home">
      <span class="logoword"><span class="word">ANARCHISM<span class="dot">.</span>AFRICA</span></span>
    </a>`;

  function getBrandWrap () { return document.querySelector('.brand-wrap'); }
  function getBg () { return document.getElementById('topbar-bg'); }

  // Replace brand-wrap content but preserve the trailing buttons (shuffle / lock)
  function replaceBrandContent (innerHTML) {
    const wrap = getBrandWrap(); if (!wrap) return;
    const tools = Array.from(wrap.querySelectorAll('.logo-shuffle, .logo-lock')).map(el => el.outerHTML).join('');
    wrap.innerHTML = innerHTML + tools;
  }

  function clearBg () {
    const bg = getBg(); if (bg) bg.innerHTML = '';
    document.body.classList.remove('hm-has-bg');
  }
  function setBg (html) {
    const bg = getBg(); if (!bg) return;
    bg.innerHTML = html;
    document.body.classList.add('hm-has-bg');
  }

  // ---- Marquee — only animates if content overflows --------------------
  function applyMarquee (el) {
    if (!el) return;
    requestAnimationFrame(() => {
      const inner = el.querySelector('.hm-marquee-inner');
      if (!inner) return;
      const overflow = inner.scrollWidth > el.clientWidth + 4;
      if (overflow) {
        // Duplicate the content so the loop is seamless
        const text = inner.innerHTML;
        inner.innerHTML = text + '<span class="hm-marquee-gap"></span>' + text;
        // Slower for longer text — duration scales with content
        const duration = Math.max(20, Math.min(80, inner.scrollWidth / 30));
        el.style.setProperty('--marquee-duration', duration + 's');
        el.classList.add('hm-marquee--scrolling');
      }
    });
  }

  // ---- Mode renderers --------------------------------------------------
  function showTitle () {
    clearBg();
    replaceBrandContent(wordmarkHTML);
  }

  let quoteCache = null;
  async function loadQuotes () {
    if (quoteCache) return quoteCache;
    try {
      const [aQ, aS] = await Promise.all([
        fetch('data/afro-anarchist-quotes.json').then(r => r.json()).catch(() => ({})),
        fetch('https://blob.vercel-storage.com/content/merch/slogans.json?ts=' + Date.now()).then(r => r.ok ? r.json() : ({ items: [] })).catch(() => ({ items: [] }))
      ]);
      const q = (aQ.quotes || []).map(x => ({ text: x.text, attr: x.author + (x.year ? ' · ' + x.year : '') }));
      const s = (aS.items || []).map(x => ({ text: x.text, attr: '' }));
      quoteCache = [...s, ...q];
    } catch { quoteCache = []; }
    return quoteCache;
  }
  async function showQuote () {
    clearBg();
    const list = await loadQuotes();
    if (!list.length) return showTitle();
    const q = list[Math.floor(Math.random() * list.length)];
    const inner = `“${escapeHTML(q.text)}”${q.attr ? ` <span class="hm-quote-attr">— ${escapeHTML(q.attr)}</span>` : ''}`;
    replaceBrandContent(`<div class="hm-marquee hm-quote"><div class="hm-marquee-inner">${inner}</div></div>`);
    applyMarquee(document.querySelector('.hm-marquee.hm-quote'));
  }

  // ---- Patterns (full-header) ------------------------------------------
  function hash (s) { let h=5381; for (let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return Math.abs(h); }
  function rng (seed) { let s=seed>>>0; return () => (s = (s*1664525 + 1013904223)>>>0)/0xffffffff; }

  function patternKente (r, w, h) {
    let bands = ''; let y = 0;
    while (y < h) { const t = 1 + Math.floor(r() * 6); bands += `<rect x="0" y="${y}" width="${w}" height="${t}" fill="currentColor" opacity="${(0.18+r()*0.7).toFixed(2)}"/>`; y += t + 1; }
    return bands;
  }
  function patternAdinkra (r, w, h) {
    let dots = ''; const cell = 18;
    for (let x=cell/2; x<w; x+=cell) for (let y=cell/2; y<h; y+=cell) {
      if (r() > 0.45) dots += `<circle cx="${x}" cy="${y}" r="${1+r()*3}" fill="currentColor" opacity="${(0.3+r()*0.6).toFixed(2)}"/>`;
    }
    return dots;
  }
  function patternKuba (r, w, h) {
    let tris = ''; const cell = 18;
    for (let i=0; i<w; i+=cell) for (let j=0; j<h; j+=cell) {
      if (r() > 0.45) {
        const f = r() > 0.5;
        const pts = f ? `${i},${j} ${i+cell},${j} ${i},${j+cell}` : `${i+cell},${j} ${i+cell},${j+cell} ${i},${j+cell}`;
        tris += `<polygon points="${pts}" fill="currentColor" opacity="${(0.2+r()*0.7).toFixed(2)}"/>`;
      }
    }
    return tris;
  }
  function patternNdebele (r, w, h) {
    let blocks = ''; const cell = 14;
    for (let i=0; i<w; i+=cell) for (let j=0; j<h; j+=cell) {
      if (r() > 0.4) {
        const sz = cell - 2 - r()*4;
        blocks += `<rect x="${i+(cell-sz)/2}" y="${j+(cell-sz)/2}" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="${(0.6+r()*1.6).toFixed(1)}" opacity="${(0.3+r()*0.6).toFixed(2)}"/>`;
      }
    }
    return blocks;
  }
  function patternSona (r, w, h) {
    let path = ''; const lines = Math.floor(h / 10);
    for (let n=0; n<lines; n++) {
      const y = (n + 0.5) * (h/lines) + r()*4;
      let d = `M 0 ${y.toFixed(1)}`;
      for (let x=0; x<w; x+=18) {
        const dy = (Math.sin((x + r()*100)*0.06) * 5 + r()*3 - 1.5).toFixed(1);
        d += ` Q ${x+9} ${(y+dy).toFixed(1)} ${x+18} ${y.toFixed(1)}`;
      }
      path += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${(0.8+r()*1.6).toFixed(1)}" opacity="${(0.3+r()*0.6).toFixed(2)}"/>`;
    }
    return path;
  }
  const PATTERN_FNS = [patternKente, patternAdinkra, patternKuba, patternNdebele, patternSona];
  const PATTERN_NAMES = ['kente','adinkra','kuba','ndebele','sona'];

  function showPattern (seedHint) {
    // Header is always-visible above this; we render an SVG that fills the full topbar
    const w = 1600, h = 56;
    const seed = hash(seedHint || ('p' + Date.now()));
    const r = rng(seed);
    const which = Math.floor(r() * PATTERN_FNS.length);
    const inner = PATTERN_FNS[which](r, w, h);
    setBg(`<svg class="hm-pattern-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" data-pattern="${PATTERN_NAMES[which]}">${inner}</svg>`);
    // Wordmark stays
    replaceBrandContent(wordmarkHTML);
    // Click bg → remix
    document.querySelector('.hm-pattern-svg')?.addEventListener('click', () => showPattern('p' + Date.now()));
  }

  // ---- GIF mode (Giphy when key set; placeholder otherwise) ------------
  async function showGif () {
    const key = (window.AA_CONFIG && window.AA_CONFIG.giphy_api_key) || null;
    const tags = ['afrofuturism','afrobeat','black panther party','kente','sun ra','fela kuti','ndebele','sankofa','protest dance','dance africa'];
    const tag  = tags[Math.floor(Math.random() * tags.length)];
    if (key) {
      try {
        const r = await fetch(`https://api.giphy.com/v1/gifs/random?api_key=${key}&tag=${encodeURIComponent(tag)}&rating=pg`);
        const d = await r.json();
        const url = d?.data?.images?.original?.url || d?.data?.images?.fixed_height?.url;
        if (url) {
          setBg(`<img class="hm-gif-img" src="${url}" alt="${tag}"/><span class="hm-gif-tag">#${tag}</span>`);
          replaceBrandContent(wordmarkHTML);
          return;
        }
      } catch {}
    }
    // Fallback — animated pattern with a tag pill
    showPattern('gif-' + tag + '-' + Date.now());
    const bg = getBg();
    if (bg) bg.insertAdjacentHTML('beforeend', `<span class="hm-gif-tag">#${tag} · placeholder (set AA_CONFIG.giphy_api_key)</span>`);
  }

  // ---- AD mode ---------------------------------------------------------
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
  async function showAd () {
    clearBg();
    const list = await loadAds();
    if (!list.length) return showTitle();
    const a = list[Math.floor(Math.random() * list.length)];
    const inner = `<a class="hm-ad-inner" href="item.html?type=${a.kind}&id=${encodeURIComponent(a.id)}">
      <span class="hm-ad-kind">${a.kind.toUpperCase()}</span>
      <span class="hm-ad-title">${escapeHTML(a.title)}</span>
      ${a.sub ? `<span class="hm-ad-sub">— ${escapeHTML(a.sub)}</span>` : ''}
    </a>`;
    replaceBrandContent(`<div class="hm-marquee hm-ad"><div class="hm-marquee-inner">${inner}</div></div>`);
    applyMarquee(document.querySelector('.hm-marquee.hm-ad'));
  }

  // ---- Mode bar --------------------------------------------------------
  function ensureModeBar () {
    if (document.getElementById('hm-bar')) return;
    const tb = document.querySelector('.topbar'); if (!tb) return;
    const bar = document.createElement('div');
    bar.id = 'hm-bar'; bar.className = 'hm-bar';
    bar.innerHTML = MODES.map(m =>
      `<button class="hm-mode-btn" data-mode="${m}" type="button" title="${labelFor(m)}" aria-label="${labelFor(m)}" aria-pressed="false">${glyphFor(m)}</button>`
    ).join('');
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
  function labelFor (m) { return ({ title:'Title', quote:'Random quote', pattern:'African pattern', gif:'Random GIF', ad:'What\'s coming up' })[m] || m; }
  function glyphFor (m) { return ({ title:'Aa', quote:'""', pattern:'▦', gif:'◐', ad:'◔' })[m] || '·'; }
  function paintModeButtons (active) {
    document.querySelectorAll('.hm-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === active);
      b.setAttribute('aria-pressed', b.dataset.mode === active);
    });
  }

  // ---- Activate with 9s auto-revert ------------------------------------
  let revertTimer;
  async function activate (mode) {
    clearTimeout(revertTimer);
    if      (mode === 'title')   showTitle();
    else if (mode === 'quote')   await showQuote();
    else if (mode === 'pattern') showPattern();
    else if (mode === 'gif')     await showGif();
    else if (mode === 'ad')      await showAd();
    write({ mode });
    paintModeButtons(mode);
    if (mode === 'title') return;
    const locks = (read().locks) || {};
    if (locks[mode]) return;
    revertTimer = setTimeout(() => activate('title'), 9000);
  }

  // ---- Init ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    ensureModeBar();
    const saved = read();
    const locked = saved.locks && Object.keys(saved.locks).find(k => saved.locks[k]);
    if (locked) { activate(locked); return; }
    if (saved.mode && saved.mode !== 'title') { activate(saved.mode); return; }
    // No user choice yet — fall back to LUVLAB / COOLHUNTPARIS visitor default
    try {
      const v = window.AA?.visitorDefaults ? await window.AA.visitorDefaults() : null;
      const m = v && v.header_default_mode;
      if (m && MODES.includes(m) && m !== 'title') activate(m);
    } catch {}
  });

  window.AA_HEADER_MODES = { activate, MODES };
})();
