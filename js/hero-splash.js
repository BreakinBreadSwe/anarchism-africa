/* ANARCHISM.AFRICA — hero auto-splash
 *
 * Keeps the existing hero slideshow but augments it: if the slideshow has
 * fewer than 12 slides, we top it up by randomly sampling films / articles /
 * books / songs / events / merch from the live database. Each item becomes
 * a hero "slide" with image background and optional caption overlay.
 *
 * Auto-rotates every 7s by default; user can pause via the existing hero
 * controls (#hero-prev / #hero-toggle / #hero-next).
 */
(function () {
  const HERO = document.getElementById('hero'); if (!HERO) return;

  let slides = [];
  let idx = 0;
  let timer;
  const interval = (window.AA_CONFIG?.hero?.interval_ms) || 7000;

  async function buildSlides () {
    let seed = {};
    try { seed = window.AA?.loadSeed ? await window.AA.loadSeed() : await fetch('data/seed.json').then(r => r.json()); } catch {}
    const heroSeed = seed.hero || [];
    const pool = [
      ...heroSeed,
      ...(seed.films    || []).map(x => ({ ...x, kind: 'film',    tab: 'films'    })),
      ...(seed.articles || []).map(x => ({ ...x, kind: 'article', tab: 'articles' })),
      ...(seed.events   || []).map(x => ({ ...x, kind: 'event',   tab: 'events'   })),
      ...(seed.music    || []).map(x => ({ ...x, kind: 'song',    tab: 'music'    })),
      ...(seed.books    || []).map(x => ({ ...x, kind: 'book',    tab: 'books'    })),
      ...(seed.merch    || []).map(x => ({ ...x, kind: 'merch',   tab: 'merch'    }))
    ].filter(x => x && x.image);
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    slides = pool.slice(0, 14);

    HERO.querySelectorAll('.slide').forEach(n => n.remove());
    slides.forEach((it, i) => {
      const div = document.createElement('div');
      div.className = 'slide' + (i === 0 ? ' active' : '');
      div.style.backgroundImage = `url('${it.image}')`;
      div.dataset.kind = it.kind || it.type || '';
      div.dataset.id   = it.id   || it.ref  || '';
      // caption strip at the bottom
      const cap = document.createElement('a');
      cap.className = 'hero-cap';
      const linkType = (it.kind || it.type || 'article');
      const linkId   = (it.id   || it.ref  || '');
      cap.href = linkId ? `item.html?type=${encodeURIComponent(linkType)}&id=${encodeURIComponent(linkId)}` : '#';
      cap.innerHTML = `
        <span class="hero-cap-kind">${(linkType || '').toUpperCase()}</span>
        <span class="hero-cap-title">${(it.title || '').replace(/</g,'&lt;')}</span>
        ${it.summary ? `<span class="hero-cap-sub">${it.summary.slice(0,140).replace(/</g,'&lt;')}</span>` : ''}`;
      div.appendChild(cap);
      HERO.appendChild(div);
    });
    if (slides.length > 1) start();
  }

  function show (i) {
    const all = HERO.querySelectorAll('.slide');
    all.forEach((s, k) => s.classList.toggle('active', k === i));
    idx = i;
  }
  function next () { show((idx + 1) % slides.length); }
  function prev () { show((idx - 1 + slides.length) % slides.length); }
  function start () { stop(); timer = setInterval(next, interval); }
  function stop () { if (timer) clearInterval(timer); timer = null; }

  document.getElementById('hero-prev')?.addEventListener('click', () => { prev(); start(); });
  document.getElementById('hero-next')?.addEventListener('click', () => { next(); start(); });
  document.getElementById('hero-toggle')?.addEventListener('click', e => {
    if (timer) { stop(); e.target.textContent = '▶'; }
    else      { start(); e.target.textContent = '⏸'; }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildSlides);
  else buildSlides();

  window.AA_HERO = { reload: buildSlides, next, prev, stop, start };
})();
