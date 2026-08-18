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

  const BUILT_IN_SLIDES = [
    { type: 'image', src: kentePattern(1),    duration: 3200 },
    { type: 'text',  text: 'ANARCHISM.AFRICA', duration: 2600, className: 'aa-hm-huge' },
    { type: 'image', src: adinkraPattern(7),  duration: 3200 },
    { type: 'text',  text: 'no gods · no masters · no borders', duration: 3000 },
    { type: 'image', src: ndebelePattern(3),  duration: 3200 },
    { type: 'text',  text: 'a living archive', duration: 2400 },
    { type: 'image', src: mudclothPattern(5), duration: 3200 },
    { type: 'text',  text: 'films · articles · sound · events · books', duration: 3200 }
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
    try {
      const r = await fetch('/api/africa-slides', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.slides) && d.slides.length) {
          // Merge: built-in patterns FIRST, then CMS slides interleaved.
          slides = interleave(BUILT_IN_SLIDES, d.slides);
          repaint();
        }
      }
    } catch {}
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.AA = window.AA || {};
  window.AA.homeMask = { mount, repaint };
})();
