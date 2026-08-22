/* ANARCHISM.AFRICA — home-page hero: africa-shaped mask over a slideshow
 * of African-pattern visuals. Sits above the existing carousel hero in
 * #view-home. Uses the same icons/africa-mask.svg the loading screen uses
 * so the two masks stay pixel-identical.
 *
 * Built-in slide pool: vector kente / adinkra / ndebele / mudcloth
 * patterns, generated as inline SVG data URLs. Optionally augmented by
 * anything already published to /api/africa-slides (the CMS pool).
 */
(function () {
  'use strict';

  // ---- Built-in vector patterns (data URLs, seeded to be visually
  //      distinct so each rotation feels different) --------------------
  const svgUrl = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

  function kentePattern (seed = 1) {
    const bands = [];
    let y = 0;
    const rng = seededRng(seed);
    while (y < 600) {
      const h  = 8 + Math.floor(rng() * 40);
      const op = 0.25 + rng() * 0.7;
      const cx = ['#ffd700','#e94560','#00b894','#ffffff'][Math.floor(rng()*4)];
      bands.push(`<rect x="0" y="${y}" width="900" height="${h}" fill="${cx}" opacity="${op.toFixed(2)}"/>`);
      y += h + 3;
    }
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice"><rect width="900" height="600" fill="#000"/>${bands.join('')}</svg>`);
  }

  function adinkraPattern (seed = 1) {
    // Grid of adinkra-inspired glyphs (concentric circles, cross, spiral)
    const rng = seededRng(seed);
    const cells = [];
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 4; y++) {
        const cx = 75 + x * 150;
        const cy = 75 + y * 150;
        const kind = Math.floor(rng() * 4);
        let g = '';
        if (kind === 0)      g = `<circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="#fff" stroke-width="6"/><circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="#fff" stroke-width="6"/>`;
        else if (kind === 1) g = `<path d="M${cx-40} ${cy-40} L${cx+40} ${cy+40} M${cx+40} ${cy-40} L${cx-40} ${cy+40}" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`;
        else if (kind === 2) g = `<path d="M${cx} ${cy-50} Q${cx+55} ${cy-15} ${cx+30} ${cy+40} Q${cx-30} ${cy+55} ${cx-45} ${cy}" fill="none" stroke="#fff" stroke-width="7"/>`;
        else                 g = `<rect x="${cx-38}" y="${cy-38}" width="76" height="76" fill="none" stroke="#fff" stroke-width="6" transform="rotate(45 ${cx} ${cy})"/>`;
        cells.push(g);
      }
    }
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice"><rect width="900" height="600" fill="#0a0a0a"/>${cells.join('')}</svg>`);
  }

  function ndebelePattern (seed = 1) {
    // High-contrast angular Ndebele-style bands + triangles
    const rng = seededRng(seed);
    const shapes = [];
    for (let y = 0; y < 6; y++) {
      const yy = y * 100;
      shapes.push(`<rect x="0" y="${yy}" width="900" height="${20 + rng()*30}" fill="${['#e94560','#0088ff','#ffd700','#00b894'][y%4]}"/>`);
      for (let x = 0; x < 6; x++) {
        const xx = x * 150 + 30;
        shapes.push(`<polygon points="${xx},${yy+50} ${xx+50},${yy+50} ${xx+25},${yy+95}" fill="#fff"/>`);
      }
    }
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice"><rect width="900" height="600" fill="#000"/>${shapes.join('')}</svg>`);
  }

  function mudclothPattern (seed = 1) {
    // Bogolan-inspired: dark warm ground with cream-coloured grid strokes
    const rng = seededRng(seed);
    const marks = [];
    for (let i = 0; i < 40; i++) {
      const x = rng() * 900, y = rng() * 600;
      const kind = Math.floor(rng() * 3);
      if (kind === 0)      marks.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="14" fill="none" stroke="#eddfc9" stroke-width="4"/>`);
      else if (kind === 1) marks.push(`<path d="M${x} ${y} l30 0 M${x+15} ${y-15} l0 30" stroke="#eddfc9" stroke-width="4"/>`);
      else                 marks.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="18" height="18" fill="none" stroke="#eddfc9" stroke-width="3"/>`);
    }
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice"><rect width="900" height="600" fill="#3a1e0d"/>${marks.join('')}</svg>`);
  }

  function seededRng (seed) {
    let s = (seed * 9301 + 49297) % 233280;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  // Big bold sans-serif A as the DEFAULT first slide. Rendered as a
  // text-type slide with class 'aa-hm-a' — CSS provides the font
  // (Arial Black / Helvetica Neue) + size. The stage is already masked
  // to africa so the A auto-clips to the continent shape. Classified as
  // 'a' type so the boot() text-filter passes it through (text-slides
  // are stripped from CMS pool but this one is intentional).
  const BIG_A_SLIDE = { type: 'a', text: 'A', duration: 3600, className: 'aa-hm-a' };
  const BUILT_IN_SLIDES = [
    BIG_A_SLIDE,
    { type: 'image', src: kentePattern(1),    duration: 3200 },
    BIG_A_SLIDE,
    { type: 'image', src: adinkraPattern(7),  duration: 3200 },
    BIG_A_SLIDE,
    { type: 'image', src: ndebelePattern(3),  duration: 3200 },
    BIG_A_SLIDE,
    { type: 'image', src: mudclothPattern(5), duration: 3200 }
  ];

  // ---- component ---------------------------------------------------------
  function mount () {
    const host = document.getElementById('view-home');
    if (!host || document.getElementById('aa-home-mask')) return;

    const el = document.createElement('div');
    el.id = 'aa-home-mask';
    el.className = 'aa-home-mask';
    el.innerHTML = `
      <div class="aa-hm-stage" id="aa-hm-stage"></div>
      <div class="aa-hm-shape" aria-hidden="true"></div>
      <div class="aa-hm-progress" id="aa-hm-progress"></div>
    `;
    // Insert as the FIRST child of #view-home so it sits above the
    // existing carousel + Featured grid.
    host.insertBefore(el, host.firstChild);

    startSlideshow(el);
    boot();
  }

  let slides = BUILT_IN_SLIDES.slice();
  let idx = 0, timer = null;

  async function boot () {
    // Parallel: fetch CMS slides + /media/ folder listing. Auto-picks up
    // any gif/image/video the user drops into media/ in the repo.
    let cmsVisual = [], mediaSlides = [];
    try {
      const [cms, media] = await Promise.all([
        fetch('/api/africa-slides', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/media/list',    { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
      ]);
      if (cms && Array.isArray(cms.slides)) {
        cmsVisual = cms.slides.filter(s => s && s.type !== 'text');
      }
      if (media && Array.isArray(media.files)) {
        mediaSlides = media.files.map(f => ({
          type: f.type,          // image | gif | video
          src:  f.url,
          duration: f.type === 'video' ? 6000 : 3500
        }));
      }
    } catch {}
    // Media files from the /media/ folder come FIRST (user-curated
    // wins over generative patterns), then the built-in vector patterns,
    // then any CMS slides. Big-A stays as the anchor between blocks.
    const merged = interleaveMulti(
      [BIG_A_SLIDE],
      mediaSlides,
      BUILT_IN_SLIDES,
      cmsVisual
    );
    slides = merged.length ? merged : [BIG_A_SLIDE];
    repaint();
  }

  // Round-robin merge across multiple lists so no single source
  // dominates the rotation.
  function interleaveMulti (...lists) {
    const out = [];
    const maxLen = Math.max(...lists.map(l => l.length));
    for (let i = 0; i < maxLen; i++) {
      for (const l of lists) if (l[i]) out.push(l[i]);
    }
    return out;
  }

  function interleave (a, b) {
    const out = [];
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i]) out.push(a[i]);
      if (b[i]) out.push(b[i]);
    }
    return out;
  }

  function renderSlide (s, i) {
    const cls = 'aa-hm-slide type-' + (s.type || 'text') + (s.className ? ' ' + s.className : '');
    const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    switch (s.type) {
      case 'image':
      case 'gif':
        return `<div class="${cls}" data-idx="${i}"><img src="${esc(s.src)}" alt=""></div>`;
      case 'video':
      case 'mp4':
        return `<div class="${cls}" data-idx="${i}"><video src="${esc(s.src)}" muted loop autoplay playsinline></video></div>`;
      case 'iframe':
        return `<div class="${cls}" data-idx="${i}"><iframe src="${esc(s.src)}" frameborder="0" allow="autoplay; fullscreen"></iframe></div>`;
      case 'a':
      case 'text':
      default:
        return `<div class="${cls}" data-idx="${i}">${esc(s.text || '')}</div>`;
    }
  }

  function repaint () {
    const stage = document.getElementById('aa-hm-stage');
    const prog  = document.getElementById('aa-hm-progress');
    if (!stage) return;
    stage.innerHTML = slides.map(renderSlide).join('');
    prog.innerHTML  = slides.map(() => '<span></span>').join('');
    activate(0);
  }

  function activate (i) {
    idx = i;
    const stage = document.getElementById('aa-hm-stage');
    if (!stage) return;
    stage.querySelectorAll('.aa-hm-slide').forEach(el => {
      el.classList.toggle('is-active', Number(el.dataset.idx) === i);
    });
    const bars = document.querySelectorAll('#aa-hm-progress span');
    bars.forEach((b, j) => {
      b.classList.toggle('is-done', j < i);
      b.classList.toggle('is-active', j === i);
    });
  }

  function startSlideshow () {
    repaint();
    if (timer) clearInterval(timer);
    let last = performance.now();
    timer = setInterval(() => {
      const s = slides[idx];
      const dur = Math.max(1200, s?.duration || 3000);
      if (performance.now() - last > dur) {
        activate((idx + 1) % slides.length);
        last = performance.now();
      }
    }, 200);
    startWooferLoop();
  }

  // Audio reactivity — piggyback on window.AA.hero's Web Audio analyser
  // (created by the loading hero) so we don't spin up a second AudioContext.
  // Every 2s attach any newly-created <audio>/<video> so mini-player track
  // changes and video slides feed the woofer too.
  function startWooferLoop () {
    // Prime: publish the loading hero's --aa-hero-level onto our local var.
    // The loading hero already runs a rAF loop that reads the analyser and
    // sets that variable on the .aa-hero element; we mirror it here.
    const el = document.getElementById('aa-home-mask');
    if (!el) return;
    const heroRoot = () => document.querySelector('.aa-hero');
    function tick () {
      // Prefer the loading hero's live level; fall back to 0.
      const src = heroRoot();
      let level = 0;
      if (src) {
        const v = getComputedStyle(src).getPropertyValue('--aa-hero-level');
        const n = parseFloat(v);
        if (!Number.isNaN(n)) level = n;
      }
      el.style.setProperty('--aa-hm-level', level.toFixed(3));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // Also ask the loading hero to attach any <audio>/<video> on the page,
    // in case it hasn't booted yet (order-of-load is non-deterministic).
    setInterval(() => {
      if (window.AA?.hero?.attachAudio) {
        document.querySelectorAll('audio, video').forEach(a => {
          try { window.AA.hero.attachAudio(a); } catch {}
        });
      }
    }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.AA = window.AA || {};
  window.AA.homeMask = { mount, repaint };
})();
