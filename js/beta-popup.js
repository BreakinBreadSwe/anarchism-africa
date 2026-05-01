/* ANARCHISM.AFRICA — Beta announcement popup
 *
 * Shows on first visit (anywhere the script is loaded). Sign-up routes to the
 * existing AA.subscribe() endpoint. Captures intended account-type:
 * consumer / event / agency / publisher / merch / partner. Stores the full
 * sign-up locally so admin can review them under aa.beta.signups.
 *
 * State key: localStorage['aa.beta.v1'] = { dismissed?, signedUp?, openedTs? }
 *
 * Public API:
 *   window.AA.beta.open()   — force-open the popup
 *   window.AA.beta.reset()  — clear local state (so it shows again)
 */
(function () {
  const KEY = 'aa.beta.v1';
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const set = (v) => { try { localStorage.setItem(KEY, JSON.stringify({ ...get(), ...v })); } catch {} };

  function injectPill () {
    if (document.querySelector('.beta-pill')) return;
    const tb = document.querySelector('.topbar');
    if (!tb) return;
    const pill = document.createElement('button');
    pill.className = 'beta-pill';
    pill.type = 'button';
    pill.title = 'Beta — read the announcement';
    pill.textContent = 'BETA';
    pill.addEventListener('click', () => openPopup(true));
    // place just before the last child (typically the Studio / Public-site button)
    const last = tb.lastElementChild;
    if (last) tb.insertBefore(pill, last); else tb.appendChild(pill);
  }

  function openPopup (force) {
    if (!force && get().dismissed) return;
    let m = document.getElementById('beta-modal');
    if (m) { m.classList.add('open'); return; }

    m = document.createElement('div');
    m.id = 'beta-modal';
    m.className = 'modal beta-modal open';
    m.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <div class="beta-mark">BETA &middot; IN PROGRESS</div>
          <div class="beta-grid">
            <div class="beta-grid-text">
              <h2>Welcome &mdash; this is the beta.</h2>
              <p>
                An afrofuturist 360&deg; on afro-anarchism &mdash; Africa &amp; diaspora.
                <strong>Films, articles, sound, books, events, merch, community.</strong>
                Curated by COOLHUNTPARIS, stewarded by LUVLAB. Every &hearts; you save and every word
                you send shapes what ships next.
              </p>
            </div>
            <form id="beta-form" class="beta-grid-form">
              <input name="email" type="email" required placeholder="your@email.com" autocomplete="email"/>
              <input name="name" type="text" placeholder="Your name (optional)" autocomplete="name"/>
              <select name="role">
                <option value="">I'm joining as&hellip; (optional)</option>
                <option value="consumer">Listener / reader / supporter</option>
                <option value="event">Event organiser</option>
                <option value="agency">Agency / collective</option>
                <option value="publisher">Writer / publisher / curator</option>
                <option value="merch">Artist / maker / label</option>
                <option value="partner">Partner / sponsor</option>
                <option value="ambassador">Local ambassador</option>
              </select>
              <textarea name="note" rows="3" placeholder="What would make this perfect for you? (optional)"></textarea>
              <div class="beta-actions">
                <button class="btn primary" type="submit">Count me in</button>
                <button class="btn ghost"   type="button" data-beta-later>Maybe later</button>
              </div>
              <p class="mono beta-finep">No spam &mdash; unsubscribe anytime. We only write when something real ships.</p>
            </form>
          </div>
          <div id="beta-thanks" style="display:none">
            <div class="beta-mark" style="background:var(--green);border-color:var(--green);color:#fff">SIGNED UP</div>
            <h2>Thank you &#9994;&#127998;</h2>
            <p>You're on the list. We'll write when something real ships. Now &mdash; explore the beta and tap the &hearts; to start a wishlist.</p>
            <button class="btn primary" type="button" data-beta-close>Explore the beta</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);

    const close = () => { m.classList.remove('open'); set({ dismissed: true }); };
    m.addEventListener('click', e => { if (e.target === m) close(); });
    m.querySelector('[data-beta-later]').addEventListener('click', close);
    m.querySelector('[data-beta-close]').addEventListener('click', close);
    document.addEventListener('keydown', function onEsc (e) {
      if (e.key === 'Escape' && m.classList.contains('open')) {
        close(); document.removeEventListener('keydown', onEsc);
      }
    });

    m.querySelector('#beta-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      try {
        if (window.AA && typeof window.AA.subscribe === 'function') {
          await window.AA.subscribe(fd.email, fd.name || '');
        }
      } catch {}
      try {
        const list = JSON.parse(localStorage.getItem('aa.beta.signups') || '[]');
        list.unshift({ ...fd, ts: Date.now(), ua: navigator.userAgent.slice(0,120) });
        localStorage.setItem('aa.beta.signups', JSON.stringify(list.slice(0, 500)));
      } catch {}
      set({ signedUp: true, dismissed: true });
      e.target.style.display = 'none';
      m.querySelector('#beta-thanks').style.display = 'block';
    });
  }

  function init () {
    injectPill();
    set({ openedTs: get().openedTs || Date.now() });
    if (!get().dismissed) setTimeout(() => openPopup(false), 700);
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();

  window.AA = window.AA || {};
  window.AA.beta = {
    open:  () => openPopup(true),
    reset: () => { try { localStorage.removeItem(KEY); } catch {} }
  };
})();
