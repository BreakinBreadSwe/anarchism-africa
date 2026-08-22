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
    // 'Current slides' panel IS what plays inside the hero. Big-A slide
    // gets sprinkled in every N slides (cms.css.aFrequency, default 6)
    // so the wordmark punctuates the rotation.
    let cmsCss = null;
    let aFreq = 6;
    try {
      const cms = await fetch('/api/africa-slides', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).catch(() => null);
      if (cms?.css) {
        cmsCss = cms.css;
        if (Number.isFinite(cms.css.aFrequency) && cms.css.aFrequency > 0) {
          aFreq = Math.max(1, Math.min(50, Number(cms.css.aFrequency)));
        }
      }
      const cmsSlides = Array.isArray(cms?.slides) ? cms.slides : [];
      slides = cmsSlides.length ? interleaveA(cmsSlides, aFreq) : [BIG_A_SLIDE];
    } catch {
      slides = [BIG_A_SLIDE];
    }
    if (cmsCss) applyCss(cmsCss);
    repaint();
  }

  // Inject BIG_A_SLIDE every `n` slides. n=6 → A, X, X, X, X, X, A, X, X ...
  // Set n=0 or 1 to always/never; the CMS clamps to 1..50.
  function interleaveA (list, n) {
    if (!list.length || n <= 0) return list.slice();
    const out = [];
    for (let i = 0; i < list.length; i++) {
      if (i % n === 0) out.push(BIG_A_SLIDE);
      out.push(list[i]);
    }
    return out;
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

  // Audio reactivity — TWO sources feed --aa-hm-level, whichever is
  // louder wins:
  //   (a) the loading hero's --aa-hero-level (only alive while the
  //       loading overlay is up), and
  //   (b) our own AudioContext + AnalyserNode wired to the mini-player's
  //       currently-playing <audio> (survives after the loading hero
  //       dismisses, so the outline woofer keeps reacting to whatever
  //       MP is playing).
  //
  // Plus device-orientation tilt: gamma/beta drive --aa-hm-tx/--aa-hm-ty
  // custom properties that offset each slide's object-position so you
  // can peek behind the africa mask by tilting the phone.
  function startWooferLoop () {
    const el = document.getElementById('aa-home-mask');
    if (!el) return;
    const heroRoot = () => document.querySelector('.aa-hero');

    // -- Own analyser wired to the mini-player audio element ----------
    let ownCtx = null, ownAnalyser = null, ownBuf = null;
    const attached = new WeakSet();
    function ensureCtx () {
      if (ownCtx) return true;
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return false;
        ownCtx = new Ctor();
        ownAnalyser = ownCtx.createAnalyser();
        ownAnalyser.fftSize = 256;
        ownAnalyser.smoothingTimeConstant = 0.7;
        ownBuf = new Uint8Array(ownAnalyser.frequencyBinCount);
        ownAnalyser.connect(ownCtx.destination);
        return true;
      } catch { return false; }
    }
    function attachEl (a) {
      if (!a || attached.has(a)) return;
      if (!ensureCtx()) return;
      try {
        // MediaElementAudioSourceNode requires cross-origin OK for
        // remote streams. If it throws we swallow — the analyser
        // just won't hear that specific element.
        const src = ownCtx.createMediaElementSource(a);
        src.connect(ownAnalyser);
        attached.add(a);
      } catch {}
    }

    // Level readout: RMS-ish average of the low-mid bins, published as
    // 0..1. Max of loading-hero level + own level.
    function readOwnLevel () {
      if (!ownAnalyser) return 0;
      ownAnalyser.getByteFrequencyData(ownBuf);
      // First ~40% of bins (bass + low-mid) → the "woofer" range.
      const cutoff = Math.floor(ownBuf.length * 0.4) || 1;
      let sum = 0;
      for (let i = 0; i < cutoff; i++) sum += ownBuf[i];
      return Math.min(1, (sum / cutoff) / 180);
    }

    function tick () {
      let heroLvl = 0;
      const src = heroRoot();
      if (src) {
        const v = getComputedStyle(src).getPropertyValue('--aa-hero-level');
        const n = parseFloat(v);
        if (!Number.isNaN(n)) heroLvl = n;
      }
      const own = readOwnLevel();
      const level = Math.max(heroLvl, own);
      el.style.setProperty('--aa-hm-level', level.toFixed(3));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Scan for new <audio>/<video> every 2s. Also nudge the loading
    // hero's analyser if it's up — belt-and-braces.
    setInterval(() => {
      document.querySelectorAll('audio, video').forEach(a => {
        attachEl(a);
        if (window.AA?.hero?.attachAudio) { try { window.AA.hero.attachAudio(a); } catch {} }
      });
    }, 2000);

    // Resume AudioContext on any user gesture (browsers suspend it
    // until then). Once resumed, we're good for the session.
    const wake = () => { if (ownCtx?.state === 'suspended') ownCtx.resume().catch(() => {}); };
    ['click','touchstart','keydown'].forEach(ev => document.addEventListener(ev, wake, { once: false, passive: true }));

    // -- Tilt parallax ------------------------------------------------
    // gamma = left/right tilt (-90..90), beta = front/back tilt (-180..180).
    // Map to a small ±14px offset published as CSS variables. The mask
    // stage stays put (it's the mask); only the image content shifts,
    // revealing more of what's behind the mask edge at extreme tilts.
    let tx = 0, ty = 0, targetTx = 0, targetTy = 0;
    function setTilt (gamma, beta) {
      const MAX = 14;   // px of offset at full tilt
      const CLAMP = 30; // degrees of tilt = full offset
      targetTx = Math.max(-MAX, Math.min(MAX, (gamma / CLAMP) * MAX));
      targetTy = Math.max(-MAX, Math.min(MAX, ((beta - 45) / CLAMP) * MAX));
    }
    function tiltTick () {
      // Ease toward target so motion is buttery, not jittery.
      tx += (targetTx - tx) * 0.15;
      ty += (targetTy - ty) * 0.15;
      el.style.setProperty('--aa-hm-tx', tx.toFixed(2) + 'px');
      el.style.setProperty('--aa-hm-ty', ty.toFixed(2) + 'px');
      requestAnimationFrame(tiltTick);
    }
    requestAnimationFrame(tiltTick);

    function onOrient (e) {
      const g = e.gamma; const b = e.beta;
      if (typeof g !== 'number' || typeof b !== 'number') return;
      setTilt(g, b);
    }
    function bindOrientation () {
      // iOS 13+ needs an explicit permission request from a user gesture.
      const Ctor = window.DeviceOrientationEvent;
      if (!Ctor) return;
      if (typeof Ctor.requestPermission === 'function') {
        const askOnce = () => {
          document.removeEventListener('click', askOnce);
          document.removeEventListener('touchend', askOnce);
          Ctor.requestPermission().then(state => {
            if (state === 'granted') window.addEventListener('deviceorientation', onOrient);
          }).catch(() => {});
        };
        document.addEventListener('click',   askOnce, { once: true, passive: true });
        document.addEventListener('touchend',askOnce, { once: true, passive: true });
      } else {
        window.addEventListener('deviceorientation', onOrient);
      }
    }
    bindOrientation();

    // Desktop fallback: mousemove over the hero produces a tilt too, so
    // the parallax isn't mobile-only.
    document.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = ((e.clientX - r.left) / r.width) * 2 - 1;    // -1..1
      const py = ((e.clientY - r.top)  / r.height) * 2 - 1;
      // Fake gamma/beta from cursor position — same downstream code.
      setTilt(px * 30, 45 + py * 30);
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.AA = window.AA || {};
  window.AA.homeMask = { mount, repaint };
})();
