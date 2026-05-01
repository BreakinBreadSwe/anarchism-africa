/* ANARCHISM.AFRICA — animated logo
 *
 * Default state: wordmark uses the app's main display font (Bebas Neue —
 * same as the hero/section titles). NO auto-rotation.
 *
 * The ⟳ button is a three-state toggle:
 *   1. idle      → click picks a random font from the library
 *   2. previewing → font is applied for 9 seconds, then auto-reverts to default
 *                   (clicking again during this window LOCKS the current font)
 *   3. locked    → font stays indefinitely; the button becomes 🔓 — click to unlock
 *                   and return to the default font
 *
 * Lock state persists across reloads via localStorage['aa.logoLock'].
 *
 * Library mixes: museum (serif/display), afro/funk (bold display), punk
 * (glitch/mono), brutalist, vintage. Loaded on demand from Google Fonts.
 */
(function () {
  // [css-family, google-fonts URL fragment, vibe]
  const FONTS = [
    // museum / classical
    ['Playfair Display',     'Playfair+Display:wght@700;900',  'museum'],
    ['Cinzel',               'Cinzel:wght@700;900',            'museum'],
    ['Cormorant Garamond',   'Cormorant+Garamond:wght@700',    'museum'],
    ['Bodoni Moda',          'Bodoni+Moda:wght@700;900',       'museum'],
    ['Cormorant SC',         'Cormorant+SC:wght@700',          'museum'],
    ['EB Garamond',          'EB+Garamond:wght@800',           'museum'],
    ['IM Fell English SC',   'IM+Fell+English+SC',             'museum'],
    ['UnifrakturCook',       'UnifrakturCook:wght@700',        'museum'],
    // afro / funk / display
    ['Bungee',               'Bungee',                         'funk'],
    ['Bungee Shade',         'Bungee+Shade',                   'funk'],
    ['Major Mono Display',   'Major+Mono+Display',             'funk'],
    ['Bowlby One SC',        'Bowlby+One+SC',                  'funk'],
    ['Alfa Slab One',        'Alfa+Slab+One',                  'funk'],
    ['Anton',                'Anton',                          'funk'],
    ['Bebas Neue',           'Bebas+Neue',                     'funk'],
    ['Lilita One',           'Lilita+One',                     'funk'],
    ['Black Ops One',        'Black+Ops+One',                  'funk'],
    // punk / glitch / mono
    ['Press Start 2P',       'Press+Start+2P',                 'punk'],
    ['VT323',                'VT323',                          'punk'],
    ['Special Elite',        'Special+Elite',                  'punk'],
    ['Fascinate',            'Fascinate',                      'punk'],
    ['Faster One',           'Faster+One',                     'punk'],
    ['Frijole',              'Frijole',                        'punk'],
    ['Sancreek',             'Sancreek',                       'punk'],
    ['Rubik Glitch',         'Rubik+Glitch',                   'punk'],
    ['Rubik Spray Paint',    'Rubik+Spray+Paint',              'punk'],
    ['Rubik Mono One',       'Rubik+Mono+One',                 'punk'],
    ['Monoton',              'Monoton',                        'punk'],
    ['Audiowide',            'Audiowide',                      'punk'],
    ['Creepster',            'Creepster',                      'punk'],
    ['Nosifer',              'Nosifer',                        'punk'],
    ['Eater',                'Eater',                          'punk'],
    ['Vast Shadow',          'Vast+Shadow',                    'punk'],
    ['Bungee Spice',         'Bungee+Spice',                   'punk']
  ];

  const ANIMS = ['anim-glitch','anim-slice','anim-scramble','anim-bounce','anim-flip',
                 'anim-zoom','anim-typeon','anim-neon','anim-rotate3d','anim-marquee',
                 'anim-shake','anim-fall','anim-warp'];

  // The app's main display font — same as section/hero headings (loaded in index.html).
  const DEFAULT_FONT  = 'Bebas Neue';
  const DEFAULT_VIBE  = 'default';
  const PREVIEW_MS    = 9000;
  const LOCK_KEY      = 'aa.logoLock';   // { family, frag, vibe } | null

  const loaded = new Set();
  function loadFont (frag) {
    if (!frag || loaded.has(frag)) return;
    loaded.add(frag);
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${frag}&display=swap`;
    document.head.appendChild(link);
  }

  function rand (arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  let lastFont = null, lastAnim = null;
  function pickFont () {
    let f;
    do { f = rand(FONTS); } while (FONTS.length > 1 && f[0] === lastFont);
    lastFont = f[0];
    return f;
  }
  function pickAnim () {
    let a;
    do { a = rand(ANIMS); } while (ANIMS.length > 1 && a === lastAnim);
    lastAnim = a;
    return a;
  }

  // ----- state ---------------------------------------------------------------
  let revertTimer = null;
  let locked      = false;

  function readLock () {
    try { return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); } catch { return null; }
  }
  function writeLock (v) {
    try {
      if (v) localStorage.setItem(LOCK_KEY, JSON.stringify(v));
      else   localStorage.removeItem(LOCK_KEY);
    } catch {}
  }

  // ----- font application ----------------------------------------------------
  function applyFont (host, family, vibe, animate) {
    const span = host.querySelector('.word');
    if (!span) return;
    span.classList.remove(...ANIMS);
    void span.offsetWidth; // restart any animation
    span.style.fontFamily = `'${family}', 'Bebas Neue', system-ui`;
    span.dataset.vibe = vibe || '';
    host.dataset.font = family;
    if (animate) span.classList.add(pickAnim(), 'is-anim');
  }

  function applyDefault (host, animate) {
    applyFont(host, DEFAULT_FONT, DEFAULT_VIBE, !!animate);
  }

  // ----- actions -------------------------------------------------------------
  function startPreview (host) {
    if (revertTimer) { clearTimeout(revertTimer); revertTimer = null; }
    const [family, frag, vibe] = pickFont();
    loadFont(frag);
    applyFont(host, family, vibe, true);
    host.dataset.previewing = '1';
    host.dataset.previewFamily = family;
    host.dataset.previewFrag   = frag;
    host.dataset.previewVibe   = vibe;
    revertTimer = setTimeout(() => {
      delete host.dataset.previewing;
      delete host.dataset.previewFamily;
      delete host.dataset.previewFrag;
      delete host.dataset.previewVibe;
      revertTimer = null;
      if (!locked) applyDefault(host, true);
      updateBtn();
    }, PREVIEW_MS);
    updateBtn();
  }

  function lockCurrent (host) {
    if (!host.dataset.previewing) return;
    if (revertTimer) { clearTimeout(revertTimer); revertTimer = null; }
    locked = true;
    writeLock({
      family: host.dataset.previewFamily,
      frag:   host.dataset.previewFrag,
      vibe:   host.dataset.previewVibe
    });
    delete host.dataset.previewing;
    delete host.dataset.previewFamily;
    delete host.dataset.previewFrag;
    delete host.dataset.previewVibe;
    updateBtn();
  }

  function unlock (host) {
    locked = false;
    writeLock(null);
    if (revertTimer) { clearTimeout(revertTimer); revertTimer = null; }
    applyDefault(host, true);
    updateBtn();
  }

  function onShuffleClick (host) {
    if (locked)               return unlock(host);
    if (host.dataset.previewing) return lockCurrent(host);
    return startPreview(host);
  }

  // ----- button UI -----------------------------------------------------------
  function updateBtn () {
    const btn = document.querySelector('.logo-shuffle');
    if (!btn) return;
    if (locked) {
      btn.textContent = '🔓';
      btn.title       = 'Unlock — return to default font';
      btn.dataset.state = 'locked';
    } else if (revertTimer) {
      btn.textContent = '🔒';
      btn.title       = 'Lock this font';
      btn.dataset.state = 'previewing';
    } else {
      btn.textContent = '⟳';
      btn.title       = 'Try a random font (9s preview)';
      btn.dataset.state = 'idle';
    }
  }

  // ----- init ----------------------------------------------------------------
  function init () {
    const host = document.querySelector('.brand .logoword');
    if (!host) return;

    // Restore prior lock OR start with the default (hero) font.
    const lock = readLock();
    if (lock && lock.family) {
      locked = true;
      loadFont(lock.frag);
      applyFont(host, lock.family, lock.vibe || '', false);
    } else {
      applyDefault(host, false);
    }
    updateBtn();

    const btn = document.querySelector('.logo-shuffle');
    if (btn) btn.addEventListener('click', () => onShuffleClick(host));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // ----- public API ---------------------------------------------------------
  window.AA_LOGO = {
    shuffle: () => {
      const host = document.querySelector('.brand .logoword');
      if (host) onShuffleClick(host);
    },
    reset: () => {
      const host = document.querySelector('.brand .logoword');
      if (host) unlock(host);
    },
    isLocked: () => locked
  };
})();
