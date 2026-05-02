/* PIN gate — applied to admin/publisher/market/partner pages.
 * Demo-grade: client-side 4-digit PIN stored in localStorage.
 * Production: replace with Supabase Auth, Auth.js, or Clerk.
 *
 * Default PINs (set via window.AA_PIN_DEFAULTS or admin Studio):
 *   admin:     1791  (Haitian Revolution)
 *   publisher: 1968  (Tlatelolco / global '68)
 *   market:    1959  (Cuban Revolution)
 *   partner:   1804  (Haitian independence)
 *
 * Users can change their pin via /admin → Settings or via the gate's "set new pin"
 */
(function () {
  const role = document.body.dataset.role || (location.pathname.includes('admin') ? 'admin' : null);
  if (!role || role === 'anarchist') return; // anarchist = consumer access level (any signed-in user); no PIN gate

  const DEFAULTS = window.AA_PIN_DEFAULTS || {
    admin:      '1791',  // Haitian Revolution
    publisher:  '1968',  // global '68
    editor:     '1972',  // Rodney's "How Europe Underdeveloped Africa"
    journalist: '1979',  // Ervin's "Anarchism and the Black Revolution"
    market:     '1959',  // Cuban Revolution
    partner:    '1804'   // Haitian independence
  };
  const KEY = 'aa.pin.' + role;
  const SESSION_KEY = 'aa.session.' + role;

  // Already authed for this session?
  if (sessionStorage.getItem(SESSION_KEY) === 'ok') return;

  // Stored pin or fallback to default
  const expected = localStorage.getItem(KEY) || DEFAULTS[role];

  // Block the page until auth
  const gate = document.createElement('div');
  gate.className = 'pin-gate';
  gate.innerHTML = `
    <div class="panel">
      <h2>${role.toUpperCase()} · LOCK</h2>
      <p>Enter the 4-digit PIN to access the ${role} page.</p>
      <input id="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off"/>
      <p style="margin-top:14px"><a href="index.html" style="color:var(--accent);text-decoration:none;font-size:.85rem">← back to public site</a></p>
      <p style="margin-top:8px;font-size:.7rem;color:var(--muted)">Default PIN hint: a year of liberation. Change it in admin → Settings.</p>
    </div>`;
  document.body.appendChild(gate);
  document.body.style.overflow = 'hidden';
  const inp = gate.querySelector('#pin');
  setTimeout(() => inp.focus(), 100);
  inp.addEventListener('input', () => {
    if (inp.value.length === 4) {
      if (inp.value === expected) {
        sessionStorage.setItem(SESSION_KEY, 'ok');
        gate.remove();
        document.body.style.overflow = '';
      } else {
        gate.classList.add('bad');
        setTimeout(() => { gate.classList.remove('bad'); inp.value = ''; inp.focus(); }, 600);
      }
    }
  });
})();
