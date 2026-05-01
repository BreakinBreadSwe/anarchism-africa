/* ANARCHISM.AFRICA — Auth rail item
 * Top-of-rail button. Shows "Sign in" when signed-out, the user's name when
 * signed-in. Click → opens the auth sheet (or confirms sign-out when signed in).
 * Listens for AA's aa:auth:change event to live-update.
 */
(function () {
  function paint () {
    const u = window.AA?.auth?.user?.();
    const label = document.querySelector('[data-auth-label]'); if (!label) return;
    const btn   = label.closest('[data-rail-auth]');
    if (u) {
      const name = (u.name || u.email || 'You').split(' ')[0];
      label.textContent = name.length > 18 ? name.slice(0,18)+'…' : name;
      btn?.classList.add('signed-in');
      btn?.setAttribute('title', `Signed in as ${u.name || u.email}`);
    } else {
      label.textContent = 'Sign in';
      btn?.classList.remove('signed-in');
      btn?.setAttribute('title', 'Sign in to save favourites and buy merch');
    }
  }
  function bind () {
    document.querySelectorAll('[data-rail-auth]').forEach(btn => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const u = window.AA?.auth?.user?.();
        if (u) {
          if (confirm('Sign out?')) window.AA.auth.signOut();
        } else if (window.AA?.auth?.openSheet) {
          window.AA.auth.openSheet();
        }
      });
    });
  }
  function init () { bind(); paint(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('aa:auth:change', paint);
})();
