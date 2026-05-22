/* ANARCHISM.AFRICA — Role Switcher
 *
 * Lets you jump between role pages (admin / publisher / editor / journalist /
 * market / partner / anarchist) without going through Public site + PIN entry
 * each time. Built for design iteration: see how each role page looks side-by-
 * side, sign out cleanly, hop to another.
 *
 * Click "Switch role" in the topbar of any role page → sheet opens with:
 *   - Current role (with a Sign-out button that clears its session + sends you home)
 *   - Every other role as a card; "Go" sets the session-auth marker for that role
 *     so the destination page's pin-gate lets you straight in
 *
 * Wired into every role HTML via a single <script src="js/role-switcher.js">.
 */
(function () {
  const ROLES = [
    { id: 'admin',      label: 'Admin',      who: 'LUVLAB',          href: 'admin.html',      icon: '✶' },
    { id: 'publisher',  label: 'Publisher',  who: 'COOLHUNTPARIS',   href: 'publisher.html',  icon: '✎' },
    { id: 'editor',     label: 'Editor',     who: 'Desk',            href: 'editor.html',     icon: '⌥' },
    { id: 'journalist', label: 'Journalist', who: 'Bureau',          href: 'journalist.html', icon: '✑' },
    { id: 'market',     label: 'Market',     who: 'Merch',           href: 'market.html',     icon: '◇' },
    { id: 'partner',    label: 'Partner',    who: 'Collaborators',   href: 'partner.html',    icon: '⊕' },
    { id: 'anarchist',  label: 'Anarchist (consumer)',  who: 'Default access for any signed-in user', href: 'anarchist.html',  icon: 'Ⓐ' }
  ];

  // Mirrors pin-gate.js defaults; allows runtime override via window.AA_PIN_DEFAULTS.
  const DEFAULTS = (window.AA_PIN_DEFAULTS && Object.keys(window.AA_PIN_DEFAULTS).length)
    ? window.AA_PIN_DEFAULTS
    : { admin: '1791', publisher: '1968', editor: '1972', journalist: '1979', market: '1959', partner: '1804' };

  function expectedPin (roleId) {
    return localStorage.getItem('aa.pin.' + roleId) || DEFAULTS[roleId] || '';
  }
  function isAuthed (roleId) {
    return sessionStorage.getItem('aa.session.' + roleId) === 'ok';
  }

  function injectButton () {
    const tb = document.querySelector('.topbar');
    if (!tb || tb.querySelector('.role-switch-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost role-switch-btn';
    btn.title = 'Switch between role pages';
    btn.innerHTML = '<span class="role-switch-dot"></span><span>Switch</span>';
    btn.addEventListener('click', openSheet);
    // place before the "Public site" / "Studio" CTA (last child)
    const last = tb.lastElementChild;
    if (last) tb.insertBefore(btn, last); else tb.appendChild(btn);
  }

  function escapeHTML (s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }

  function openSheet () {
    const currentRole = document.body.dataset.role || '';
    let m = document.getElementById('role-switch-sheet');
    if (m) { m.classList.add('open'); return; }
    m = document.createElement('div');
    m.id = 'role-switch-sheet';
    m.className = 'modal open';
    m.innerHTML = `
      <div class="panel" style="max-width:640px;width:calc(100% - 32px);max-height:88vh;display:flex;flex-direction:column">
        <div class="panel-body" style="padding:22px 24px;overflow-y:auto">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            <h2 style="margin:0;font-family:'Bebas Neue',sans-serif;letter-spacing:.04em">Switch role</h2>
            <button class="btn ghost" data-rs-close>Close</button>
          </div>

          ${currentRole ? `
            <div class="rs-current">
              <div class="rs-current-meta">
                <span class="rs-icon">${ROLES.find(r => r.id === currentRole)?.icon || '·'}</span>
                <div>
                  <b>Currently in: ${escapeHTML((ROLES.find(r => r.id === currentRole)?.label || currentRole))}</b>
                  <div class="mono" style="font-size:.7rem;color:var(--muted)">
                    ${escapeHTML((ROLES.find(r => r.id === currentRole)?.who || ''))}
                  </div>
                </div>
              </div>
              <button class="btn ghost rs-signout" data-rs-signout>Sign out → Public</button>
            </div>` : ''}

          <p style="color:var(--fg-dim);max-width:60ch;margin:14px 0 12px;font-size:.85rem;line-height:1.5">
            Each role has its own page and PIN. "Go" pre-authorises the session so the destination
            page lets you straight in — handy when you're iterating on layout and want to compare.
          </p>

          <div class="rs-grid">
            ${ROLES.filter(r => r.id !== currentRole).map(r => `
              <div class="rs-card${isAuthed(r.id) ? ' authed' : ''}" data-rs-go="${r.id}">
                <div class="rs-card-icon">${r.icon}</div>
                <div class="rs-card-body">
                  <b>${escapeHTML(r.label)}</b>
                  <div class="mono" style="font-size:.7rem;color:var(--muted)">${escapeHTML(r.who)} · ${escapeHTML(r.href)}</div>
                  <div class="rs-pin-line">
                    PIN: <span class="mono" data-rs-pin="${r.id}">${expectedPin(r.id) || '—'}</span>
                    ${isAuthed(r.id) ? '<span class="rs-authed-badge">already signed in</span>' : ''}
                  </div>
                </div>
                <button class="btn primary rs-go-btn">Go →</button>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);

    m.addEventListener('click', e => {
      if (e.target === m)             return closeSheet();
      if (e.target.closest('[data-rs-close]'))    return closeSheet();
      if (e.target.closest('[data-rs-signout]'))  return signOutCurrent();
      const card = e.target.closest('[data-rs-go]');
      if (card) goTo(card.dataset.rsGo);
    });
    document.addEventListener('keydown', escClose);
  }

  function escClose (e) {
    if (e.key === 'Escape') {
      const sheet = document.getElementById('role-switch-sheet');
      if (sheet && sheet.classList.contains('open')) closeSheet();
    }
  }
  function closeSheet () {
    document.getElementById('role-switch-sheet')?.classList.remove('open');
    document.removeEventListener('keydown', escClose);
  }

  function signOutCurrent () {
    const r = document.body.dataset.role;
    if (!r) return;
    sessionStorage.removeItem('aa.session.' + r);
    location.href = 'index.html';
  }

  function goTo (roleId) {
    const role = ROLES.find(r => r.id === roleId);
    if (!role) return;
    // Pre-authorize the destination so its pin-gate lets us in.
    // (anarchist has no gate — this is harmless on it.)
    sessionStorage.setItem('aa.session.' + roleId, 'ok');
    location.href = role.href;
  }

  function init () {
    // Only show on role pages (skip the public site and embed views).
    if (!document.body.dataset.role) return;
    injectButton();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AA = window.AA || {};
  window.AA.roleSwitch = { open: openSheet, signOut: signOutCurrent, goTo };
})();
