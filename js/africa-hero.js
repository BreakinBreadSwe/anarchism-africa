/* ANARCHISM.AFRICA — fullscreen Africa-shaped loading screen
 *
 * Renders once per session on first visit (unless the user hits ENTER).
 * Rotates through a list of slides (text / image / gif / video / iframe),
 * masked to the africa continent silhouette. When audio is playing
 * anywhere in the app (mini-player, embedded video, radio stream), a Web
 * Audio AnalyserNode drives a CSS custom property that makes the whole
 * silhouette pulse and brighten in sync with the sound — "woofer" effect.
 *
 * Sources of slides (first available wins):
 *   1. /api/africa-slides         — Vercel Blob-backed CMS, admin+publisher writable
 *   2. /data/africa-slides.json   — seed defaults committed to the repo
 *
 * Public API (window.AA.hero):
 *   .show()          – re-open the loading page manually
 *   .hide()          – close it
 *   .reload()        – re-fetch slides
 *   .attachAudio(el) – hook an <audio>/<video> element to the reactive layer
 *   .slides          – current slide list
 */
(function () {
  'use strict';

  const SEEN_KEY = 'aa-hero-seen-v1';
  const SLIDES_ENDPOINT = '/api/africa-slides';
  const SLIDES_SEED     = '/data/africa-slides.json';

  const state = {
    slides: [],
    background: null,             // {type: 'color'|'image'|'video', value}
    idx: 0,
    timer: null,
    startTs: 0,
    hero: null,
    stage: null,
    progress: null,
    audioCtx: null,
    analyser: null,
    freqBuf: null,
    rafId: null,
    attached: new WeakSet()
  };

  function esc (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---- fetch slides -------------------------------------------------------
  async function loadSlides () {
    try {
      const r = await fetch(SLIDES_ENDPOINT, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d.background) state.background = d.background;
        if (Array.isArray(d.slides) && d.slides.length) return d.slides;
      }
    } catch {}
    try {
      const r = await fetch(SLIDES_SEED, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d.background && !state.background) state.background = d.background;
        if (Array.isArray(d.slides) && d.slides.length) return d.slides;
      }
    } catch {}
    // Last-resort fallback: single title card
    return [{ type: 'text', text: 'ANARCHISM.AFRICA', duration: 3000, className: 'aa-huge' }];
  }

  // ---- DOM construction ---------------------------------------------------
  function buildDom () {
    if (state.hero) return;
    const hero = document.createElement('div');
    hero.className = 'aa-hero';
    hero.innerHTML = `
      <div class="aa-hero-bg" id="aa-hero-bg" aria-hidden="true"></div>
      <div class="aa-hero-stage" id="aa-hero-stage"></div>
      <div class="aa-hero-mask" aria-hidden="true"></div>
      <div class="aa-hero-progress" id="aa-hero-progress"></div>
      <div class="aa-hero-actions">
        <button type="button" data-hero-enter>ENTER</button>
      </div>
    `;
    document.body.appendChild(hero);
    state.hero     = hero;
    state.stage    = hero.querySelector('#aa-hero-stage');
    state.progress = hero.querySelector('#aa-hero-progress');
    hero.querySelector('[data-hero-enter]').addEventListener('click', hide);
    hero.addEventListener('click', (e) => {
      // Click anywhere outside the ENTER button dismisses too.
      if (e.target.closest('[data-hero-enter]')) return;
      if (e.target.closest('.aa-slide-video-audio')) return;
      hide();
    });
  }

  function paintSlides () {
    if (!state.stage) return;
    state.stage.innerHTML = state.slides.map((s, i) => renderSlide(s, i)).join('');
    state.progress.innerHTML = state.slides.map(() => '<span></span>').join('');
    paintBackground();
  }

  // Outside-africa background layer. Independent of the slide stage.
  // Accepts { type: 'color'|'image'|'gif'|'video'|'iframe', value: <string> }.
  function paintBackground () {
    const bg = state.hero?.querySelector('#aa-hero-bg');
    if (!bg) return;
    const b = state.background;
    bg.innerHTML = '';
    bg.style.background = '#000';
    if (!b || !b.value) return;
    if (b.type === 'color') {
      bg.style.background = b.value;
    } else if (b.type === 'image' || b.type === 'gif') {
      bg.style.background = `#000 url("${b.value}") center/cover no-repeat`;
    } else if (b.type === 'video' || b.type === 'mp4') {
      const v = document.createElement('video');
      v.src = b.value; v.muted = true; v.loop = true;
      v.playsInline = true; v.autoplay = true;
      v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      bg.appendChild(v);
      try { v.play().catch(() => {}); } catch {}
      attachAudioElement(v);
    } else if (b.type === 'iframe') {
      const f = document.createElement('iframe');
      f.src = b.value; f.frameBorder = '0';
      f.allow = 'autoplay; fullscreen';
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      bg.appendChild(f);
    }
  }

  function renderSlide (s, i) {
    const cls = 'aa-slide type-' + (s.type || 'text') + (s.className ? ' ' + esc(s.className) : '');
    switch (s.type) {
      case 'image':
      case 'gif':
        return `<div class="${cls}" data-idx="${i}"><img src="${esc(s.src)}" alt="${esc(s.alt || '')}" loading="lazy"></div>`;
      case 'video':
      case 'mp4':
        return `<div class="${cls}" data-idx="${i}"><video src="${esc(s.src)}" muted playsinline autoplay loop class="aa-slide-video"></video></div>`;
      case 'iframe':
        return `<div class="${cls}" data-idx="${i}"><iframe src="${esc(s.src)}" frameborder="0" allow="autoplay; fullscreen" style="width:100%;height:100%"></iframe></div>`;
      case 'text':
      default:
        return `<div class="${cls}" data-idx="${i}">${esc(s.text || '')}</div>`;
    }
  }

  // ---- slideshow rotation -------------------------------------------------
  function activate (i) {
    if (!state.stage) return;
    state.idx = i;
    state.startTs = performance.now();
    state.stage.querySelectorAll('.aa-slide').forEach(el => {
      el.classList.toggle('is-active', Number(el.dataset.idx) === i);
    });
    state.progress.querySelectorAll('span').forEach((el, j) => {
      el.classList.toggle('is-done', j < i);
      el.classList.toggle('is-active', j === i);
      if (j !== i) el.style.removeProperty('--aa-slide-progress');
    });
    // Play the video/audio inside this slide, if any.
    const active = state.stage.querySelector('.aa-slide.is-active video');
    if (active) {
      try { active.currentTime = 0; active.play().catch(() => {}); } catch {}
      attachAudioElement(active);
    }
  }

  function tick () {
    if (!state.hero || state.hero.classList.contains('is-hidden')) return;
    const dur = Math.max(1000, Number(state.slides[state.idx]?.duration) || 3500);
    const elapsed = performance.now() - state.startTs;
    const pct = Math.min(1, elapsed / dur);
    const bar = state.progress.querySelector('span.is-active');
    if (bar) bar.style.setProperty('--aa-slide-progress', pct.toFixed(3));
    if (pct >= 1) {
      const next = state.idx + 1;
      if (next >= state.slides.length) {
        // End of slideshow → auto-dismiss on FIRST visit only.
        hide(); return;
      }
      activate(next);
    }
    state.rafId = requestAnimationFrame(tick);
  }

  // ---- audio reactivity ---------------------------------------------------
  // Web Audio: connect an AnalyserNode to whatever <audio>/<video> is
  // currently emitting sound. Compute an "energy" scalar every frame and
  // publish it as --aa-hero-level on the hero root; CSS reads it to pulse
  // the mask and brightness. This works for MP.audio (mini-player), any
  // embedded <video>, and radio streams (all end up as HTMLMediaElements).
  function ensureAudioCtx () {
    if (state.audioCtx) return state.audioCtx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    state.audioCtx = new Ctor();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 256;
    state.analyser.smoothingTimeConstant = 0.7;
    state.freqBuf = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.connect(state.audioCtx.destination);
    startAnalyserLoop();
    return state.audioCtx;
  }
  function attachAudioElement (el) {
    if (!el || state.attached.has(el)) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    try {
      const src = ctx.createMediaElementSource(el);
      src.connect(state.analyser);
      state.attached.add(el);
    } catch (e) {
      // createMediaElementSource throws if the element is already routed
      // through another AudioNode — ignore silently.
    }
  }
  function startAnalyserLoop () {
    const loop = () => {
      if (!state.analyser) return;
      state.analyser.getByteFrequencyData(state.freqBuf);
      // RMS-ish energy across the low + mid bins (0..64 of 128)
      let sum = 0, n = Math.min(64, state.freqBuf.length);
      for (let i = 0; i < n; i++) sum += state.freqBuf[i] * state.freqBuf[i];
      const level = Math.min(1, Math.sqrt(sum / (n * 255 * 255)) * 1.8);
      if (state.hero) state.hero.style.setProperty('--aa-hero-level', level.toFixed(3));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  // Also hook the mini-player's Audio (created on demand). Poll for it
  // because MP.play() creates a new Audio() on each track — we watch and
  // re-attach as the reference changes.
  function watchMiniPlayer () {
    let lastRef = null;
    setInterval(() => {
      const MP = window.MP;
      // The mini-player's internal audio isn't part of its public API,
      // but the shared <audio> DOM (if any) is a good proxy. Fall back
      // to scanning the document.
      const els = document.querySelectorAll('audio, video');
      els.forEach(el => attachAudioElement(el));
    }, 2000);
  }

  // ---- show / hide --------------------------------------------------------
  async function show (opts = {}) {
    buildDom();
    if (!state.slides.length || opts.reload) state.slides = await loadSlides();
    paintSlides();
    state.hero.classList.remove('is-hidden');
    document.documentElement.style.overflow = 'hidden';
    activate(0);
    cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
    // Resume any suspended AudioContext (browsers suspend until user gesture)
    if (state.audioCtx?.state === 'suspended') state.audioCtx.resume().catch(() => {});
  }
  function hide () {
    if (!state.hero) return;
    state.hero.classList.add('is-hidden');
    document.documentElement.style.overflow = '';
    cancelAnimationFrame(state.rafId);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    // Pause any in-hero videos
    state.stage?.querySelectorAll('video').forEach(v => { try { v.pause(); } catch {} });
  }

  // ---- auto-show on first visit ------------------------------------------
  function maybeAutoShow () {
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch {}
    // ?hero=1 forces show for previews; ?hero=0 skips
    const params = new URLSearchParams(location.search);
    if (params.get('hero') === '0') return;
    if (!seen || params.get('hero') === '1') show();
  }

  // ---- boot ---------------------------------------------------------------
  function boot () {
    watchMiniPlayer();
    maybeAutoShow();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Public API
  window.AA = window.AA || {};
  window.AA.hero = {
    show, hide,
    reload: () => show({ reload: true }),
    attachAudio: attachAudioElement,
    get slides () { return state.slides.slice(); }
  };
})();
