/* ANARCHISM.AFRICA - PWA install prompt
 *
 * Captures the beforeinstallprompt event Chrome fires when the site meets
 * installability criteria, then exposes it via window.AA.pwaInstall and
 * surfaces a discoverable "Install app" pill in the rail menu (or as a
 * floating CTA on first eligible session).
 *
 * Public API: window.AA.pwaInstall
 *   .available()  -> bool, the prompt has fired and not been used yet
 *   .show()       -> trigger the native install dialog
 *   .dismiss()    -> hide the pill until next session
 *
 * Visibility rules:
 *   - Pill shows when prompt is captured AND user hasn't dismissed permanently.
 *   - Auto-hides if the app is already running standalone (display-mode).
 *   - On iOS Safari (no beforeinstallprompt) we still surface a pill that
 *     opens an instructions sheet because iOS install is manual ("Add to
 *     Home Screen" from the share sheet).
 */
(function () {
  if (typeof window === 'undefined') return;

  const KEY_DISMISSED = 'aa.pwa.dismissed';   // 'never' or epoch ms

  let deferred = null;            // beforeinstallprompt event
  let installed = isStandalone();

  function isStandalone () {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: window-controls-overlay)').matches
        || window.navigator.standalone === true;     // iOS Safari
  }

  function isIOSSafari () {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  }

  function dismissed () {
    const v = localStorage.getItem(KEY_DISMISSED);
    if (v === 'never') return true;
    if (!v) return false;
    // Soft dismiss expires after 7 days
    return (Date.now() - parseInt(v, 10)) < 7 * 24 * 3600 * 1000;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    paintPill();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    document.querySelectorAll('.aa-install-pill').forEach(el => el.remove());
  });

  function paintPill () {
    if (installed) return;
    if (dismissed()) return;
    if (!deferred && !isIOSSafari()) return;
    if (document.querySelector('.aa-install-pill')) return;

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'aa-install-pill';
    pill.setAttribute('aria-label', 'Install ANARCHISM.AFRICA as an app');
    pill.innerHTML = `
      <span class="aa-ip-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="aa-ip-label">Install app</span>
      <span class="aa-ip-close" aria-label="Dismiss" title="Dismiss">&times;</span>
    `;
    document.body.appendChild(pill);

    pill.addEventListener('click', async (e) => {
      if (e.target.classList.contains('aa-ip-close')) {
        localStorage.setItem(KEY_DISMISSED, String(Date.now()));
        pill.remove();
        return;
      }
      if (deferred) {
        try {
          deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice && choice.outcome === 'accepted') {
            installed = true; pill.remove();
          } else {
            // soft dismiss
            localStorage.setItem(KEY_DISMISSED, String(Date.now()));
          }
        } catch {}
        deferred = null;
      } else if (isIOSSafari()) {
        showIOSSheet();
      }
    });
  }

  function showIOSSheet () {
    let sheet = document.getElementById('aa-ios-install');
    if (sheet) { sheet.classList.add('open'); return; }
    sheet = document.createElement('div');
    sheet.id = 'aa-ios-install';
    sheet.className = 'aa-ios-install open';
    sheet.innerHTML = `
      <div class="aa-iosi-card">
        <button class="aa-iosi-close" aria-label="Close">&times;</button>
        <h3>Install ANARCHISM.AFRICA</h3>
        <p>iOS doesn't offer a one-tap install. Add the app manually:</p>
        <ol>
          <li>Tap the <b>Share</b> icon at the bottom of Safari (square + arrow).</li>
          <li>Scroll and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b> in the top-right corner.</li>
        </ol>
        <p class="mono" style="font-size:.7rem;color:var(--muted)">Works the same on iPad. Use Safari, not Chrome.</p>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet || e.target.classList.contains('aa-iosi-close')) {
        sheet.classList.remove('open');
        setTimeout(() => sheet.remove(), 200);
      }
    });
  }

  // Wire to a Rail menu item if present (#rail-install)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pwa-install]');
    if (!btn) return;
    if (deferred) deferred.prompt().then(() => deferred = null).catch(() => {});
    else if (isIOSSafari()) showIOSSheet();
    else alert('App is already installed (or your browser does not support PWA install).');
  });

  // Initial paint after DOM ready - covers the iOS case where there is
  // no beforeinstallprompt event but we still want a discoverable entry.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paintPill);
  } else {
    paintPill();
  }

  window.AA = window.AA || {};
  window.AA.pwaInstall = {
    available: () => !!deferred || isIOSSafari(),
    show: () => deferred ? deferred.prompt() : (isIOSSafari() ? showIOSSheet() : null),
    dismiss: () => { localStorage.setItem(KEY_DISMISSED, String(Date.now())); document.querySelectorAll('.aa-install-pill').forEach(el => el.remove()); },
    installed: () => installed
  };
})();
