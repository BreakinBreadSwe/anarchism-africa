/* ANARCHISM.AFRICA — header sticky/auto-hide + mobile menu pop-up + favorites mosaic
 *
 * 1. Topbar: sticky. On scroll-down it slides up; when scrolling stops for
 *    `aa.header.restoreMs` it slides back into view.
 *    Tunable via localStorage (LUVLAB admin):
 *       aa.header.hideMs      ms to slide up    (default 220)
 *       aa.header.restoreMs   ms idle before slide-down (default 280)
 *       aa.header.threshold   px scrolled before hiding kicks in (default 64)
 *
 * 2. Mobile bottombar: clicking the leftmost button (the logo) expands the
 *    bottombar into a full-screen overlay containing all rail items as square
 *    tiles + the user's wishlist favorites mosaic below. Both are scrollable.
 */
(function () {
  // ---------- 1. sticky-hide topbar -------------------------------------
  const tb = document.getElementById('topbar') || document.querySelector('.topbar');
  if (tb) {
    const cfg = () => ({
      hideMs:    parseInt(localStorage.getItem('aa.header.hideMs')    || '220', 10),
      restoreMs: parseInt(localStorage.getItem('aa.header.restoreMs') || '280', 10),
      threshold: parseInt(localStorage.getItem('aa.header.threshold') || '64',  10)
    });
    tb.classList.add('topbar-auto-hide');
    let lastY = window.scrollY;
    let hiding = false;
    let restoreTimer;
    function applyTransition () {
      const c = cfg();
      tb.style.transition = `transform ${c.hideMs}ms cubic-bezier(.4,0,.2,1)`;
    }
    applyTransition();
    function onScroll () {
      const y = window.scrollY;
      const c = cfg();
      const dy = y - lastY;
      if (y < c.threshold) {
        // Always show near top
        tb.classList.remove('hidden');
        hiding = false;
      } else if (dy > 4 && !hiding) {
        // Scrolling down past threshold → hide
        tb.classList.add('hidden');
        hiding = true;
      }
      lastY = y;
      // Restart "scroll-stopped" timer with the slower restoreMs duration
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        tb.style.transition = `transform ${c.restoreMs}ms cubic-bezier(.2,.8,.2,1)`;
        tb.classList.remove('hidden');
        hiding = false;
        // restore the standard transition for next hide
        setTimeout(applyTransition, c.restoreMs + 50);
      }, c.restoreMs);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    // expose the configurator
    window.AA_HEADER = {
      get: cfg,
      set (k, v) {
        if (!['hideMs','restoreMs','threshold'].includes(k)) return;
        localStorage.setItem('aa.header.' + k, String(v));
        applyTransition();
      }
    };
  }

  // ---------- 2. mobile menu pop-up + favorites mosaic ------------------
  // The bottombar's leftmost button (the menu-toggle equivalent). On mobile/
  // tablet the rail is collapsed; tapping the menu opens a full-screen
  // overlay with rail-items as square tiles + favorites mosaic underneath.
  const rail = document.getElementById('rail');
  if (!rail) return;

  function getRailItems () {
    return Array.from(rail.querySelectorAll('.rail-item, a.rail-item'));
  }

  function ensureMobileMenu () {
    let m = document.getElementById('aa-mobile-menu');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'aa-mobile-menu';
    m.className = 'aa-mobile-menu';
    m.innerHTML = `
      <div class="aa-mm-grid" id="aa-mm-grid"></div>
      <div class="aa-mm-favs-head">
        <span>Your favourites</span>
        <span class="mono" id="aa-mm-fav-count" style="opacity:.6"></span>
      </div>
      <div class="aa-mm-favs" id="aa-mm-favs"></div>
    `;
    document.body.appendChild(m);
    m.addEventListener('click', e => {
      // close when a tile is picked
      const tile = e.target.closest('.aa-mm-tile');
      if (tile) closeMenu();
      const fav = e.target.closest('.aa-mm-fav');
      if (fav) closeMenu();
    });
    return m;
  }

  function tileForRailItem (it) {
    const label = it.querySelector('.label')?.textContent?.trim() || '';
    const glyph = it.querySelector('.glyph')?.innerHTML || '';
    const tab   = it.dataset.tab;
    const view  = it.dataset.view;
    const href  = it.getAttribute('href');
    const a = document.createElement('a');
    a.className = 'aa-mm-tile';
    a.href = href || (tab ? '#' + tab : '#');
    if (tab)  a.dataset.tab  = tab;
    if (view) a.dataset.view = view;
    a.innerHTML = `<span class="aa-mm-tile-glyph">${glyph}</span><span class="aa-mm-tile-label">${label}</span>`;
    a.addEventListener('click', e => {
      // route the click to the original rail-item so existing tab logic fires
      if (it.tagName === 'BUTTON') {
        e.preventDefault();
        it.click();
      }
    });
    return a;
  }

  function renderFavs () {
    const host = document.getElementById('aa-mm-favs'); if (!host) return;
    const list = (window.AA?.wishlist?.list?.() || []);
    document.getElementById('aa-mm-fav-count').textContent = list.length ? `${list.length}` : '';
    if (!list.length) {
      host.innerHTML = `
        <div class="aa-mm-empty">
          <span class="aa-mm-empty-heart" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.65 12 21 12 21z" stroke-linejoin="round"/></svg>
          </span>
          <p>Tap any <span class="aa-mm-empty-inline-heart">♥</span> across the platform to save it here.</p>
        </div>`;
      return;
    }
    host.innerHTML = list.map(x => {
      const url = x.item?.image
        ? `url("${(x.item.image||'').replace(/"/g,'%22')}")`
        : '';
      return `<a class="aa-mm-fav" href="item.html?type=${encodeURIComponent(x.type)}&id=${encodeURIComponent(x.id)}" data-wish-id="${x.id}" data-wish-type="${x.type}" style="background-image:${url}">
        <span class="aa-mm-fav-label">${(x.item?.title || x.id).toString().replace(/</g,'&lt;')}</span>
      </a>`;
    }).join('');
  }

  function openMenu () {
    const m = ensureMobileMenu();
    const grid = m.querySelector('#aa-mm-grid');
    grid.innerHTML = '';
    getRailItems().forEach(it => grid.appendChild(tileForRailItem(it)));
    renderFavs();
    m.classList.add('open');
    document.body.classList.add('aa-mm-open');
  }
  function closeMenu () {
    document.getElementById('aa-mobile-menu')?.classList.remove('open');
    document.body.classList.remove('aa-mm-open');
  }

  // The bottombar logo button opens the mobile menu. The desktop topbar
  // #menu-toggle button toggles the side rail (handled in app.js). We only
  // intercept on REAL mobile (<= 768px - the breakpoint where the rail goes
  // away). At >= 769px the rail is the menu, so let app.js handle the click.
  function isMobile () { return window.innerWidth <= 768; }
  document.querySelectorAll('[data-bbar="menu"]').forEach(b => {
    b.addEventListener('click', e => {
      if (isMobile()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const m = document.getElementById('aa-mobile-menu');
        if (m && m.classList.contains('open')) closeMenu(); else openMenu();
      }
    }, true);
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // Rail tooltips: hide native browser tooltips when the rail is EXPANDED
  // (labels are already visible next to each icon, so the title=... tooltip
  // is redundant + covers the label). Restore when the rail collapses back
  // to the icon-only strip — that's when the tooltip is actually useful.
  // We stash the original title on data-aa-title and swap it in/out so the
  // source of truth stays intact.
  (function () {
    const rail = document.getElementById('rail') || document.querySelector('.rail');
    if (!rail) return;
    const items = () => rail.querySelectorAll('[title], [data-aa-title]');
    function stash () {
      items().forEach(el => {
        const t = el.getAttribute('title');
        if (t) { el.setAttribute('data-aa-title', t); el.removeAttribute('title'); }
      });
    }
    function restore () {
      items().forEach(el => {
        const t = el.getAttribute('data-aa-title');
        if (t && !el.hasAttribute('title')) el.setAttribute('title', t);
      });
    }
    function sync () {
      if (rail.classList.contains('expanded')) stash();
      else restore();
    }
    // Watch class-attribute changes on the rail. Cheap — only fires when the
    // 'expanded' class is added/removed.
    new MutationObserver(sync).observe(rail, { attributes: true, attributeFilter: ['class'] });
    sync();
  })();

  // Re-render favorites whenever the wishlist changes
  document.addEventListener('aa:wishlist:change', () => {
    if (document.getElementById('aa-mobile-menu')?.classList.contains('open')) renderFavs();
  });
})();
