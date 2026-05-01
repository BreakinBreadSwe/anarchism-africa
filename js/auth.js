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
    let sheet = document.getElementById('aa-auth-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'aa-auth-sheet';
      sheet.className = 'modal';
      sheet.innerHTML = `
        <div class="panel" style="max-width:440px;width:calc(100% - 32px)">
          <div class="panel-body" style="padding:28px 26px">
            <h2 style="margin:0 0 6px;font-family:'Bebas Neue',sans-serif;letter-spacing:.04em">Join ANARCHISM.AFRICA</h2>
            <p style="color:var(--fg-dim);margin:0 0 18px;line-height:1.5">
              Sign up to save a wishlist, follow ambassadors, get the newsletter, and shape the platform with us.
            </p>
            <div id="aa-auth-google" style="display:flex;justify-content:center;margin-bottom:14px"></div>
            <p class="mono" style="color:var(--muted);font-size:.7rem;line-height:1.5;margin:6px 0 14px">
              More options coming soon: Apple, GitHub, email magic-link.
            </p>
            <div style="display:flex;justify-content:flex-end">
              <button class="btn ghost" id="aa-auth-close">Close</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(sheet);
      sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
      sheet.querySelector('#aa-auth-close').addEventListener('click', closeSheet);
    }
    sheet.classList.add('open');
    mountSignInButton(sheet.querySelector('#aa-auth-google'));
  }
  function closeSheet () {
    document.getElementById('aa-auth-sheet')?.classList.remove('open');
  }

  function signOut () { writeUser(null); }

  function paintHeaderState () {
    const u = readUser();
    document.body.classList.toggle('aa-signed-in', !!u);
    // top-bar avatar pill (creates one if there's a topbar and no .aa-account yet)
    const tb = document.querySelector('.topbar');
    if (!tb) return;
    let pill = tb.querySelector('.aa-account');
    if (!u) {
      // signed-out: make sure a sign-in pill exists if not on an admin/role page
      if (document.body.dataset.role) return;     // role pages have their own header
      if (!pill) {
        pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'btn ghost aa-account';
        pill.style.marginLeft = '4px';
        pill.textContent = 'Sign in';
        pill.addEventListener('click', openSheet);
        // place before the last topbar child (Studio button)
        tb.insertBefore(pill, tb.lastElementChild);
      } else {
        pill.textContent = 'Sign in';
        pill.onclick = openSheet;
      }
      return;
    }
    // signed-in: show avatar + name
    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'btn ghost aa-account';
      pill.style.marginLeft = '4px';
      tb.insertBefore(pill, tb.lastElementChild);
    }
    const initials = (u.name || u.email || '?').split(/\s+/).map(p => p[0]).slice(0,2).join('').toUpperCase();
    pill.innerHTML = `<span class="aa-account-avatar" style="background-image:url('${u.picture || ''}')">${u.picture ? '' : initials}</span><span class="aa-account-name">${(u.name || u.email).slice(0, 18)}</span>`;
    pill.onclick = () => { if (confirm('Sign out?')) signOut(); };
  }

  // boot
  document.addEventListener('DOMContentLoaded', paintHeaderState);

  window.AA = window.AA || {};
  window.AA.auth = {
    user: readUser,
    signOut, openSheet, closeSheet,
    mountSignInButton
  };
})();
