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
  // 2s advance rate — matches CSS 4s crossfade so consecutive slides
  // are always mid-transition.
  const SLIDE_MS   = 2000;
  const BIG_A_SLIDE = { type: 'a', text: 'A', duration: SLIDE_MS, className: 'aa-hm-a' };
  const BUILT_IN_SLIDES = [
    BIG_A_SLIDE,
    { type: 'image', src: kentePattern(1),    duration: SLIDE_MS },
    BIG_A_SLIDE,
    { type: 'image', src: adinkraPattern(7),  duration: SLIDE_MS },
    BIG_A_SLIDE,
    { type: 'image', src: ndebelePattern(3),  duration: SLIDE_MS },
    BIG_A_SLIDE,
    { type: 'image', src: mudclothPattern(5), duration: SLIDE_MS }
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
    // Single source of truth: cms.slides. What the admin sees in the
    // 'Current slides' panel IS what plays inside the hero. No hidden
    // interleave with /media/, no built-in patterns injected.
    // Fallback to BIG_A_SLIDE only if the CMS is empty (fresh install).
    let cmsCss = null;
    try {
      const cms = await fetch('/api/africa-slides', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).catch(() => null);
      if (cms?.css) cmsCss = cms.css;
      const cmsSlides = Array.isArray(cms?.slides) ? cms.slides : [];
      slides = cmsSlides.length ? cmsSlides : [BIG_A_SLIDE];
    } catch {
      slides = [BIG_A_SLIDE];
    }
    if (cmsCss) applyCss(cmsCss);
    repaint();
  }

  // Apply CSS-knob overrides from the CMS as custom properties on the
  // mask element. The base stylesheet reads them via var() with defaults.
  function applyCss (cssKnobs) {
    const el = document.getElementById('aa-home-mask');
    if (!el || !cssKnobs) return;
    if (cssKnobs.heroSize)     el.style.setProperty('--aa-hm-size',       cssKnobs.heroSize + 'vmin');
    if (cssKnobs.outlineWidth) el.style.setProperty('--aa-hm-outline-w',  cssKnobs.outlineWidth);
    if (cssKnobs.crossfadeMs)  el.style.setProperty('--aa-hm-crossfade',  cssKnobs.crossfadeMs + 'ms');
    // advanceMs handled in JS below
    if (cssKnobs.advanceMs) {
      slides = slides.map(s => ({ ...s, duration: cssKnobs.advanceMs }));
    }
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
    // Per-slide focal point + zoom → object-position + transform:scale on
    // the media element. Renderer only injects these if the slide actually
    // sets them, so uncustomised slides stay at the CSS default (50% 50%
    // + no scale).
    const fx = Number.isFinite(+s.focalX) ? +s.focalX : 50;
    const fy = Number.isFinite(+s.focalY) ? +s.focalY : 50;
    const zm = Number.isFinite(+s.zoom)   ? +s.zoom   : 100;
    // Use CSS 'scale' property (not transform:scale) so the Ken Burns
    // keyframe animation can own `transform` without overriding the
    // per-slide zoom. transform-origin doubles as the animation's
    // pivot point so KB pans around the user-chosen focal.
    const mediaStyle = `object-position:${fx}% ${fy}%;scale:${(zm/100).toFixed(3)};transform-origin:${fx}% ${fy}%;`;
    switch (s.type) {
      case 'image':
      case 'gif':
        return `<div class="${cls}" data-idx="${i}"><img src="${esc(s.src)}" alt="" style="${mediaStyle}"></div>`;
      case 'video':
      case 'mp4':
        return `<div class="${cls}" data-idx="${i}"><video src="${esc(s.src)}" muted loop autoplay playsinline style="${mediaStyle}"></video></div>`;
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
