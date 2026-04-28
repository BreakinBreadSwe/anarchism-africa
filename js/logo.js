/* ANARCHISM.AFRICA — animated logo
 * Rotates the wordmark through a curated library of fonts every 9 seconds.
 * Each rotation picks a random "entry" animation. Header button reshuffles instantly.
 *
 * Library mixes: museum (serif/display), afro/funk (bold display), punk (glitch/mono),
 * brutalist, vintage. Loaded on demand from Google Fonts so first paint stays fast.
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

  const loaded = new Set();
  function loadFont (frag) {
    if (loaded.has(frag)) return;
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
    lastFont = f[0];
    return f;
  }
  function pickAnim () {
    let a; do { a = rand(ANIMS); } while (ANIMS.length > 1 && a === lastAnim);
    lastAnim = a;
    return a;
  }

  function shuffle (host) {
    const [family, frag, vibe] = pickFont();
    loadFont(frag);
    const anim = pickAnim();
    // Use weight 400 fallback for fonts that don't have multiple weights
    const span = host.querySelector('.word');
    span.classList.remove(...ANIMS);
    // void reflow to restart animation
    void span.offsetWidth;
    span.style.fontFamily = `'${family}', 'Bebas Neue', system-ui`;
    span.dataset.vibe = vibe;
    span.classList.add(anim, 'is-anim');
    host.dataset.font = family;
  }

  function init () {
    const host = document.querySelector('.brand .logoword');
    if (!host) return;
    shuffle(host);
    setInterval(() => {
      if (localStorage.getItem('aa.logoPaused') === '1') return;
      shuffle(host);
    }, 9000);
    const btn = document.querySelector('.logo-shuffle');
    if (btn) btn.addEventListener('click', () => shuffle(host));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AA_LOGO = { shuffle: () => shuffle(document.querySelector('.brand .logoword')) };
})();
