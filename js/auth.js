/* ANARCHISM.AFRICA — consumer auth (Google Sign-In, more providers later)
 *
 * Uses Google's "Sign in with Google" (GIS) — client gets an ID token,
 * sends it to /api/auth/google for verification, server returns user
 * profile + sets HttpOnly session cookie.
 *
 * Configuration:
 *   - Set window.AA_GOOGLE_CLIENT_ID (e.g. injected by config.js) OR
 *     edit the GOOGLE_CLIENT_ID constant below.
 *   - The Vercel project must have GOOGLE_CLIENT_ID + AUTH_SECRET env vars.
 *
 * Public API:
 *   AA.auth.user()              — current user object or null
 *   AA.auth.signOut()           — clears local profile (cookie cleared on next /api/auth/google call)
 *   AA.auth.openSheet()         — opens the sign-in sheet
 *   AA.auth.mountSignInButton(el)  — places a Google button into el
 *   event 'aa:auth:change' on document with detail = user|null
 */
(function () {
  const PROFILE_KEY = 'aa.user';
  const GIS_SCRIPT  = 'https://accounts.google.com/gsi/client';

  function readUser () {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch { return null; }
  }
  function writeUser (u) {
    if (u) localStorage.setItem(PROFILE_KEY, JSON.stringify(u));
    else   localStorage.removeItem(PROFILE_KEY);
    document.dispatchEvent(new CustomEvent('aa:auth:change', { detail: u }));
    paintHeaderState();
  }
  function clientId () {
    return window.AA_GOOGLE_CLIENT_ID
        || (window.AA_CONFIG && window.AA_CONFIG.googleClientId)
        || '';
  }

  // Load Google Identity Services script once.
  let gisReady = null;
  function loadGIS () {
    if (gisReady) return gisReady;
    gisReady = new Promise((resolve, reject) => {
      if (window.google && window.google.accounts) return resolve();
      const s = document.createElement('script');
      s.src = GIS_SCRIPT; s.async = true; s.defer = true;
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error('Could not load Google Sign-In'));
      document.head.appendChild(s);
    });
    return gisReady;
  }

  async function handleCredential (response) {
    if (!response || !response.credential) return;
    try {
      const r = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      writeUser(data.user);
      closeSheet();
    } catch (e) {
      alert('Sign-in failed: ' + e.message);
    }
  }

  async function mountSignInButton (host, options = {}) {
    const cid = clientId();
    if (!cid) {
      host.innerHTML = `<p style="color:var(--muted);font-size:.8rem;margin:0">
        Sign-in not configured yet. Set <code>GOOGLE_CLIENT_ID</code> in Vercel and
        <code>window.AA_GOOGLE_CLIENT_ID</code> in <code>js/config.js</code>.
      </p>`;
      return;
    }
    await loadGIS();
    google.accounts.id.initialize({
      client_id: cid,
      callback:  handleCredential,
      ux_mode:   'popup',
      auto_select: false,
      itp_support: true
    });
    host.innerHTML = '';
    google.accounts.id.renderButton(host, {
      type:  'standard',
      theme: options.theme || 'filled_black',
      size:  options.size  || 'large',
      text:  options.text  || 'signup_with',
      shape: 'pill',
      logo_alignment: 'left',
      width: options.width || 280
    });
  }

  function openSheet () {
    let page = document.getElementById('aa-auth-page');
    if (!page) {
      page = document.createElement('div');
      page.id = 'aa-auth-page';
      page.className = 'aa-auth-page';
      page.setAttribute('role', 'dialog');
      page.setAttribute('aria-modal', 'true');
      page.setAttribute('aria-labelledby', 'aa-auth-title');
      page.innerHTML = `
        <button class="aa-auth-close" id="aa-auth-close" aria-label="Close" type="button">&times;</button>
        <div class="aa-auth-grid">
          <div class="aa-auth-pitch">
            <div class="aa-auth-mark">
              <svg viewBox="0 0 192 192" width="64" height="64" aria-hidden="true">
                <rect width="192" height="192" rx="20" fill="#000"/>
                <path d="M 78 28 Q 100 22 124 28 Q 146 36 156 54 Q 162 70 158 84 Q 154 96 144 104 Q 142 116 138 130 Q 134 144 126 154 Q 116 162 106 158 Q 98 150 92 138 Q 84 122 76 108 Q 66 92 58 78 Q 52 64 56 50 Q 64 34 78 28 Z" fill="none" stroke="#fff" stroke-width="3"/>
                <ellipse cx="160" cy="118" rx="4.5" ry="11" fill="none" stroke="#fff" stroke-width="2"/>
                <clipPath id="aa-auth-africa"><path d="M 78 28 Q 100 22 124 28 Q 146 36 156 54 Q 162 70 158 84 Q 154 96 144 104 Q 142 116 138 130 Q 134 144 126 154 Q 116 162 106 158 Q 98 150 92 138 Q 84 122 76 108 Q 66 92 58 78 Q 52 64 56 50 Q 64 34 78 28 Z"/></clipPath>
                <g clip-path="url(#aa-auth-africa)">
                  <polygon points="62,160 96,30 110,30 84,160" fill="#fff"/>
                  <polygon points="98,30 112,30 142,160 128,160" fill="#fff"/>
                  <rect x="40" y="100" width="120" height="14" fill="#fff"/>
                  <polygon points="92,100 116,100 110,114 96,114" fill="#000"/>
                </g>
              </svg>
            </div>
            <h1 id="aa-auth-title">Join the platform.</h1>
            <p class="aa-auth-lede">An afrofuturist 360&deg; on afro-anarchism. Sign up to save what catches you, follow ambassadors, submit events, order merch, shape what ships next.</p>
            <ul class="aa-auth-bullets">
              <li>♥ Save films, articles, books, music, events, merch</li>
              <li>✍︎ Submit events &amp; suggest content</li>
              <li>◇ Order merch (T-shirts, posters, zines)</li>
              <li>✦ Get the weekly digest only when something real ships</li>
            </ul>
          </div>
          <div class="aa-auth-form">
            <h2 class="aa-auth-form-title">Sign in</h2>
            <p class="aa-auth-form-sub">One tap with Google. More options coming soon.</p>
            <div id="aa-auth-google" class="aa-auth-google"></div>
            <p class="aa-auth-fineprint mono">
              By signing in you agree to be a participant, not a customer. We don't sell data, don't run ads, don't pretend.
              See <a href="#about">about</a> for the boring details.
            </p>
          </div>
        </div>`;
      document.body.appendChild(page);
      page.querySelector('#aa-auth-close').addEventListener('click', closeSheet);
      // Esc closes
      document.addEventListener('keydown', function onEsc (e) {
        if (e.key === 'Escape' && page.classList.contains('open')) {
          closeSheet(); document.removeEventListener('keydown', onEsc);
        }
      });
    }
    page.classList.add('open');
    document.body.classList.add('aa-auth-open');
    mountSignInButton(page.querySelector('#aa-auth-google'));
  }
  function closeSheet () {
    document.getElementById('aa-auth-page')?.classList.remove('open');
    document.body.classList.remove('aa-auth-open');
  }

  function signOut () { writeUser(null); }

  function paintHeaderState () {
    // The sign-in lives in the rail menu now, not the topbar.
    // We just clean up any old .aa-account pill earlier versions injected.
    document.querySelectorAll('.topbar .aa-account').forEach(el => el.remove());
    document.body.classList.toggle('aa-signed-in', !!readUser());
  }

  // boot
  document.addEventListener('DOMContentLoaded', paintHeaderState);

  window.AA = window.AA || {};
  window.AA.auth = {
    user: readUser,
    signedIn: () => !!readUser(),
    signOut, openSheet, closeSheet,
    mountSignInButton
  };
})();
