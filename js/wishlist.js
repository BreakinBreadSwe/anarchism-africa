/* ANARCHISM.AFRICA — universal wishlist
 * Available on every page (public site + every role: admin / publisher / market /
 * partner / anarchist / consumer / event / agency).
 *
 * Storage: localStorage['aa.wishlist.v1'] = { 'type:id': { item, type, addedAt } }
 *
 * Public API: window.AA.wishlist (also window.Wishlist)
 *   .add(item, type)   .remove(item|id, type)   .toggle(item, type)
 *   .has(id, type)     .list()                  .clear()
 *   .attachHearts(scope=document)               .renderView()
 *
 * Auto-behaviour:
 *   - Watches the DOM with a MutationObserver and decorates any element that
 *     has [data-wish-id] + [data-wish-type] with a heart toggle button.
 *   - Injects a "Wishlist" entry into the public site's rail + tabs and into
 *     every role page's rail, so no HTML edits are required across pages.
 *   - When the public-site URL hash is #wishlist, renders into #view-wishlist.
 *   - When a role page's view is "wishlist", role-shared's view fn returns the
 *     same renderView() HTML.
 */
(function () {
  const KEY = 'aa.wishlist.v1';
  const $$  = (s, r=document) => Array.from(r.querySelectorAll(s));
  const read  = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const write = (m) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch {} };
  const k = (type, id) => `${type}:${id}`;
  const emit = () => document.dispatchEvent(new CustomEvent('aa:wishlist:change'));

  // Returns true if signed in. If not, opens the auth sheet and shows a tiny
  // toast so the user knows why the action didn't happen.
  function signedInOrPrompt () {
    if (window.AA?.auth?.user?.()) return true;
    if (window.AA?.auth?.openSheet) window.AA.auth.openSheet();
    if (window.AA_LIVE?.toast) window.AA_LIVE.toast('Sign in to save favourites', 'idle');
    return false;
  }

  const TYPE_LABELS = {
    film:'Films', article:'Library', event:'Events', song:'Music',
    book:'Books', merch:'Marketplace', shop:'Shops', service:'Services',
    seminar:'Seminars', job:'Jobs', amb:'Ambassadors', grant:'Grants'
  };

  const W = {
    has (id, type) { return !!read()[k(type, id)]; },
    list () {
      const m = read();
      return Object.entries(m).map(([key, v]) => ({
        key,
        type: key.split(':')[0],
        id:   key.split(':').slice(1).join(':'),
        ...v
      })).sort((a, b) => (b.addedAt||0) - (a.addedAt||0));
    },
    add (item, type) {
      if (!item || !item.id) return false;
      // Gate likes/favorites on sign-in (unless already in the list — allow read/refresh)
      if (!read()[k(type, item.id)] && !signedInOrPrompt()) return false;
      const m = read();
      m[k(type, item.id)] = { item, type, addedAt: Date.now() };
      write(m); emit(); return true;
    },
    remove (itemOrId, type) {
      const id = (typeof itemOrId === 'object') ? itemOrId.id : itemOrId;
      const m = read(); delete m[k(type, id)]; write(m); emit(); return true;
    },
    toggle (item, type) {
      // Gate likes/favorites on sign-in
      if (!W.has(item.id, type) && !signedInOrPrompt()) return false;
      return W.has(item.id, type)
        ? (W.remove(item, type), false)
        : (W.add(item, type),    true);
    },
    clear () { write({}); emit(); },

    // Decorate every [data-wish-id][data-wish-type] target with a heart button.
    // Idempotent — safe to call repeatedly.
    attachHearts (scope) {
      scope = scope || document;
      const targets = scope.querySelectorAll('[data-wish-id][data-wish-type]:not([data-wish-bound])');
      targets.forEach(el => {
        el.setAttribute('data-wish-bound', '1');
        const id   = el.dataset.wishId;
        const type = el.dataset.wishType;
        const btn  = document.createElement('button');
        btn.className = 'wish-heart';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Save to wishlist');
        btn.title = 'Save to wishlist';
        btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg>';
        const sync = () => btn.classList.toggle('is-on', W.has(id, type));
        sync();
        btn.addEventListener('click', e => {
          e.stopPropagation(); e.preventDefault();
          let item = null;
          try { item = JSON.parse(el.dataset.wishItem || 'null'); } catch {}
          if (!item) {
            const thumb = el.querySelector('.thumb');
            const bg = thumb && thumb.style && thumb.style.backgroundImage || '';
            item = {
              id,
              title: el.querySelector('h3,h2,h4,.title')?.textContent?.trim() || id,
              image: bg.replace(/^url\("?|"?\)$/g, '')
            };
          }
          W.toggle(item, type);
        });
        el.appendChild(btn);
        document.addEventListener('aa:wishlist:change', sync);
      });
    },

    renderView () {
      const items = W.list();
      if (!items.length) {
        return `<div class="panel" data-view-name="wishlist">
          <h2 style="margin:0 0 8px">Your wishlist</h2>
          <p style="color:var(--fg-dim);max-width:65ch;margin:0">
            Nothing saved yet. Tap the <span class="wish-heart-inline">♥</span> on any film,
            article, event, song, book, or item in the marketplace to keep it here.
          </p>
        </div>`;
      }
      const groups = items.reduce((acc, x) => ((acc[x.type] = acc[x.type] || []).push(x), acc), {});
      const total = items.length;
      const groupHTML = Object.entries(groups).map(([type, list]) => `
        <div class="panel">
          <h3 style="margin:0 0 12px">${TYPE_LABELS[type] || type}</h3>
          <div class="wishlist-grid">
            ${list.map(x => `
              <div class="wish-card" data-wish-key="${x.key}">
                ${x.item.image
                  ? `<div class="wish-thumb" style="background-image:url('${String(x.item.image).replace(/'/g,"%27")}')"></div>`
                  : `<div class="wish-thumb wish-thumb--blank"></div>`}
                <div class="wish-body">
                  <h4>${(x.item.title || x.id).toString().replace(/</g,'&lt;')}</h4>
                  <div class="meta">saved ${new Date(x.addedAt).toLocaleDateString()}</div>
                  <button class="btn ghost wish-remove" data-wish-id="${x.id}" data-wish-type="${type}">Remove</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('');

      return `<div class="panel" data-view-name="wishlist">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <h2 style="margin:0">Your wishlist <span style="color:var(--muted);font-weight:400">· ${total} item${total===1?'':'s'}</span></h2>
          <button class="btn ghost" data-wish-clear>Clear all</button>
        </div>
      </div>${groupHTML}`;
    }
  };

  // ---- DOM auto-decoration --------------------------------------------------
  function init () {
    W.attachHearts(document);

    new MutationObserver(muts => {
      let touched = false;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches?.('[data-wish-id][data-wish-type]') ||
              n.querySelector?.('[data-wish-id][data-wish-type]')) {
            touched = true; break;
          }
        }
        if (touched) break;
      }
      if (touched) W.attachHearts(document);
    }).observe(document.body, { childList: true, subtree: true });

    // Inject Wishlist nav entry on every page (if not already there).
    injectNav();

    // Public-site hash routing for #wishlist
    const view = document.getElementById('view-wishlist');
    if (view && location.hash === '#wishlist') renderPublicView();
    window.addEventListener('hashchange', () => {
      if (location.hash === '#wishlist') renderPublicView();
    });

    // Delegate clicks for remove + clear-all
    document.addEventListener('click', e => {
      const rm = e.target.closest('.wish-remove');
      if (rm) {
        W.remove(rm.dataset.wishId, rm.dataset.wishType);
        rerender(rm);
        return;
      }
      const cl = e.target.closest('[data-wish-clear]');
      if (cl) {
        if (confirm('Clear your entire wishlist?')) {
          W.clear();
          rerender(cl);
        }
      }
    });

    // Rerender wishlist views when storage changes (e.g. from another tab)
    window.addEventListener('storage', e => {
      if (e.key === KEY) document.dispatchEvent(new CustomEvent('aa:wishlist:change'));
    });
    document.addEventListener('aa:wishlist:change', () => {
      $$('[data-view-name="wishlist"]').forEach(host => {
        const container = host.closest('#view-wishlist') || host.closest('#role-views') || host.parentElement;
        if (container) container.innerHTML = W.renderView();
      });
    });
  }

  function rerender (anchor) {
    const container = anchor.closest('#view-wishlist')
                   || anchor.closest('#role-views')
                   || anchor.closest('[data-view-name="wishlist"]')?.parentElement;
    if (container) container.innerHTML = W.renderView();
  }

  function renderPublicView () {
    const view = document.getElementById('view-wishlist');
    if (!view) return;
    view.innerHTML = W.renderView();
    document.querySelectorAll('section.view').forEach(s => s.classList.toggle('active', s.id === 'view-wishlist'));
    document.querySelectorAll('.tab,.rail-item').forEach(t => t.classList.toggle('active', t.dataset.tab === 'wishlist'));
  }

  // ---- Inject Wishlist navigation everywhere -------------------------------
  function injectNav () {
    const isPublic = !!document.getElementById('view-home');

    // 1) Public-site rail: add a Wishlist rail item if missing
    const rail = document.getElementById('rail');
    if (rail && !rail.querySelector('[data-tab="wishlist"]') && !rail.querySelector('[data-view="wishlist"]')) {
      const btn = document.createElement('button');
      btn.className = 'rail-item';
      if (isPublic) btn.dataset.tab = 'wishlist';
      else btn.dataset.view = 'wishlist';
      btn.innerHTML = `<span class="glyph"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6c-2.5 4.5-9.5 9-9.5 9z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg></span><span class="label">Wishlist</span>`;
      rail.appendChild(btn);
    }

    // 2) Public-site horizontal tabs row: add a Wishlist tab if missing
    const tabs = document.getElementById('tabs');
    if (tabs && !tabs.querySelector('[data-tab="wishlist"]')) {
      const tab = document.createElement('div');
      tab.className = 'tab';
      tab.dataset.tab = 'wishlist';
      tab.innerHTML = `<span class="glyph"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6c-2.5 4.5-9.5 9-9.5 9z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg></span>Wishlist`;
      tabs.appendChild(tab);
    }

    // 3) Public-site: ensure a #view-wishlist section exists
    if (isPublic && !document.getElementById('view-wishlist')) {
      const sec = document.createElement('section');
      sec.className = 'view';
      sec.id = 'view-wishlist';
      sec.style.padding = '18px var(--content-pad-x, 16px)';
      sec.innerHTML = '';
      // place after the last existing view section
      const last = document.querySelector('section.view:last-of-type');
      (last?.parentNode || document.body).insertBefore(sec, last?.nextSibling || null);
    }

    // 4) Role pages: register the wishlist view function on RoleShared (if loaded)
    if (window.RoleShared) {
      window.RoleShared.views = window.RoleShared.views || {};
      if (!window.RoleShared.views.wishlist) {
        window.RoleShared.views.wishlist = async () => W.renderView();
      }
    }

    // 5) Public-site click-routing: app.js setTab() already toggles section
    //    .active and rail/tab .active. We just need to populate the
    //    view-wishlist content when it activates. We hook into setTab via
    //    a hashchange + DOM polling fallback. NO capture-phase hijack — that
    //    used to desync section visibility with the SPA's state machine and
    //    broke navigation back to other tabs.
    if (isPublic) {
      const populate = () => {
        const v = document.getElementById('view-wishlist');
        if (v && v.classList.contains('active')) v.innerHTML = W.renderView();
      };
      window.addEventListener('hashchange', populate);
      // Also react to programmatic .active toggles (setTab may run before
      // hashchange in some races) — observe the section directly.
      const v = document.getElementById('view-wishlist');
      if (v && 'MutationObserver' in window) {
        new MutationObserver(populate).observe(v, { attributes: true, attributeFilter: ['class'] });
      }
      // Initial paint if the user lands on /#wishlist directly.
      if (location.hash === '#wishlist') populate();
    }
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();

  // expose
  window.AA = window.AA || {};
  window.AA.wishlist = W;
  window.Wishlist = W;
})();
