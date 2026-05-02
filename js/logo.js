/* ANARCHISM.AFRICA — animated logo
 *
 * Default state: wordmark uses Bebas Neue (the hero/title font).
 *
 * Two independent buttons sit next to the wordmark:
 *
 *   ⟳  random font — click ANY number of times to cycle through
 *      the curated library. No timer, no auto-revert. Spam it until
 *      one clicks for you.
 *   🔒  lock — locks whatever font is currently showing. Persists
 *      across reloads. Once locked, the icon flips to 🔓 — click again
 *      to unlock and return to the Bebas Neue default.
 *
 * Lock state persists via localStorage['aa.logoLock'].
 *
 * The lock button is auto-injected if not present in the HTML, so existing
 * pages with only the .logo-shuffle button still get the new behavior.
 */
(function () {
  // [css-family, google-fonts URL fragment, vibe]
  const FONTS = [
    ['Playfair Display','Playfair+Display:wght@700;900','museum'],
    ['Cinzel','Cinzel:wght@700;900','museum'],
    ['Cormorant Garamond','Cormorant+Garamond:wght@700','museum'],
    ['Bodoni Moda','Bodoni+Moda:wght@700;900','museum'],
    ['Cormorant SC','Cormorant+SC:wght@700','museum'],
    ['EB Garamond','EB+Garamond:wght@800','museum'],
    ['IM Fell English SC','IM+Fell+English+SC','museum'],
    ['UnifrakturCook','UnifrakturCook:wght@700','museum'],
    ['Bungee','Bungee','funk'],
    ['Bungee Shade','Bungee+Shade','funk'],
    ['Major Mono Display','Major+Mono+Display','funk'],
    ['Bowlby One SC','Bowlby+One+SC','funk'],
    ['Alfa Slab One','Alfa+Slab+One','funk'],
    ['Anton','Anton','funk'],
    ['Bebas Neue','Bebas+Neue','funk'],
    ['Lilita One','Lilita+One','funk'],
    ['Black Ops One','Black+Ops+One','funk'],
    ['Press Start 2P','Press+Start+2P','punk'],
    ['VT323','VT323','punk'],
    ['Special Elite','Special+Elite','punk'],
    ['Fascinate','Fascinate','punk'],
    ['Faster One','Faster+One','punk'],
    ['Frijole','Frijole','punk'],
    ['Sancreek','Sancreek','punk'],
    ['Rubik Glitch','Rubik+Glitch','punk'],
    ['Rubik Spray Paint','Rubik+Spray+Paint','punk'],
    ['Rubik Mono One','Rubik+Mono+One','punk'],
    ['Monoton','Monoton','punk'],
    ['Audiowide','Audiowide','punk'],
    ['Creepster','Creepster','punk'],
    ['Nosifer','Nosifer','punk'],
    ['Eater','Eater','punk'],
    ['Vast Shadow','Vast+Shadow','punk'],
    ['Bungee Spice','Bungee+Spice','punk']
  ];

  const ANIMS = ['anim-glitch','anim-slice','anim-scramble','anim-bounce','anim-flip',
                 'anim-zoom','anim-typeon','anim-neon','anim-rotate3d','anim-marquee',
                 'anim-shake','anim-fall','anim-warp'];

  const DEFAULT_FONT = 'Bebas Neue';
  const DEFAULT_VIBE = 'default';
  const LOCK_KEY = 'aa.logoLock';   // { family, frag, vibe } | null

  const loaded = new Set();
  function loadFont (frag) {
    if (!frag || loaded.has(frag)) return;
    loaded.add(frag);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${frag}&display=swap`;
    document.head.appendChild(link);
  }

  function rand (arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  let lastFont = null, lastAnim = null;
  function pickFont () {
    let f; do { f = rand(FONTS); } while (FONTS.length > 1 && f[0] === lastFont);
    lastFont = f[0]; return f;
  }
  function pickAnim () {
    let a; do { a = rand(ANIMS); } while (ANIMS.length > 1 && a === lastAnim);
    lastAnim = a; return a;
  }

  // ---- state ---------------------------------------------------------------
  let locked = false;
  let currentFont = null;   // tracks what's currently shown (for lock-on-click)
  let currentFrag = null;
  let currentVibe = DEFAULT_VIBE;

  function readLock () { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); } catch { return null; } }
  function writeLock (v) {
    try {
      if (v) localStorage.setItem(LOCK_KEY, JSON.stringify(v));
      else   localStorage.removeItem(LOCK_KEY);
    } catch {}
  }

  function applyFont (host, family, frag, vibe, animate) {
    const span = host.querySelector('.word'); if (!span) return;
    span.classList.remove(...ANIMS);
    void span.offsetWidth;
    span.style.fontFamily = `'${family}', 'Bebas Neue', system-ui`;
    span.dataset.vibe = vibe || '';
    host.dataset.font = family;
    if (animate) span.classList.add(pickAnim(), 'is-anim');
    currentFont = family; currentFrag = frag; currentVibe = vibe || DEFAULT_VIBE;
  }
  function applyDefault (host, animate) { applyFont(host, DEFAULT_FONT, '', DEFAULT_VIBE, !!animate); }

  // ---- actions -------------------------------------------------------------
  function shuffle (host) {
    if (locked) {
      // While locked, ⟳ acts as a quick "preview new option without unlocking" —
      // we leave the lock untouched but apply a random preview. To revert,
      // hit 🔓 (which restores the default and clears the lock).
      // NOTE: most users will unlock first; this is a power-user shortcut.
    }
    const [family, frag, vibe] = pickFont();
    loadFont(frag);
    applyFont(host, family, frag, vibe, true);
    updateUI();
  }

  function lock (host) {
    if (!currentFont || currentFont === DEFAULT_FONT) {
      // nothing meaningful to lock; pick one first
      shuffle(host); return;
    }
    locked = true;
    writeLock({ family: currentFont, frag: currentFrag, vibe: currentVibe });
    updateUI();
  }

  function unlock (host) {
    locked = false;
    writeLock(null);
    applyDefault(host, true);
    updateUI();
  }

  // ---- UI ------------------------------------------------------------------
  function ensureLockButton () {
    const shuffle = document.querySelector('.logo-shuffle');
    if (!shuffle) return null;
    let lockBtn = document.querySelector('.logo-lock');
    if (!lockBtn) {
      lockBtn = document.createElement('button');
      lockBtn.className = 'logo-lock';
      lockBtn.type = 'button';
      lockBtn.setAttribute('aria-label', 'Lock current font');
      shuffle.insertAdjacentElement('afterend', lockBtn);
    }
    return lockBtn;
  }

  function updateUI () {
    const shuffleBtn = document.querySelector('.logo-shuffle');
    const lockBtn = ensureLockButton();
    if (shuffleBtn) {
      shuffleBtn.textContent = '⟳';
      shuffleBtn.title = locked
        ? 'Click: try another font - Double-click: UNLOCK (back to default)'
        : 'Click: try a random font - Double-click: LOCK current font';
      shuffleBtn.setAttribute('aria-label', 'Random font');
    }
    if (lockBtn) {
      if (locked) {
        lockBtn.textContent = '🔓';
        lockBtn.title = 'Unlock — return to default font';
        lockBtn.setAttribute('aria-label', 'Unlock font');
        lockBtn.dataset.state = 'locked';
      } else {
        lockBtn.textContent = '🔒';
        lockBtn.title = currentFont && currentFont !== DEFAULT_FONT
          ? `Lock "${currentFont}"`
          : 'Hit ⟳ first, then 🔒 to lock the font you like';
        lockBtn.setAttribute('aria-label', 'Lock current font');
        lockBtn.dataset.state = 'idle';
      }
    }
  }

  // ---- init ----------------------------------------------------------------
  function init () {
    const host = document.querySelector('.brand .logoword');
    if (!host) return;

    const stored = readLock();
    if (stored && stored.family) {
      locked = true;
      loadFont(stored.frag);
      applyFont(host, stored.family, stored.frag, stored.vibe || DEFAULT_VIBE, false);
    } else {
      applyDefault(host, false);
    }

    // Wire EVERY .logo-shuffle (topbar + hero etc):
    //   single click -> shuffle (cycle to a random font)
    //   double-click -> lock the CURRENTLY shown font (or unlock if already locked)
    // We delay the single-click action by 220ms so a double-click suppresses it,
    // matching the user's expectation that the second click "captures" the style.
    document.querySelectorAll('.logo-shuffle').forEach(b => {
      let pendingTimer = null;
      b.addEventListener('click', () => {
        if (pendingTimer) return;
        pendingTimer = setTimeout(() => { pendingTimer = null; shuffle(host); }, 220);
      });
      b.addEventListener('dblclick', e => {
        e.preventDefault();
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
        if (locked) unlock(host); else lock(host);
        // little flash on the button to acknowledge the lock toggle
        b.classList.add('aa-lock-flash');
        setTimeout(() => b.classList.remove('aa-lock-flash'), 350);
      });
      b.title = locked
        ? 'Click to try another font - double-click to UNLOCK and return to default'
        : 'Click to try a random font - double-click to LOCK the current one';
    });
    // Lock button — auto-injected next to the FIRST .logo-shuffle that doesn't already have a sibling lock
    ensureLockButton()?.addEventListener('click', () => locked ? unlock(host) : lock(host));
    // Also wire any explicit .logo-lock siblings created in hero markup
    document.querySelectorAll('.logo-lock').forEach(b => {
      if (b.dataset.bound === '1') return;
      b.dataset.bound = '1';
      b.addEventListener('click', () => locked ? unlock(host) : lock(host));
    });
    updateUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AA_LOGO = {
    shuffle: () => { const h = document.querySelector('.brand .logoword'); if (h) shuffle(h); },
    lock:    () => { const h = document.querySelector('.brand .logoword'); if (h) lock(h); },
    unlock:  () => { const h = document.querySelector('.brand .logoword'); if (h) unlock(h); },
    isLocked: () => locked,
    currentFont: () => currentFont
  };
})();
