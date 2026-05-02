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
              <img src="/icons/favicon.svg" alt="ANARCHISM.AFRICA" width="96" height="96" decoding="async" />
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
            <p class="aa-auth-form-sub">Pick the method you prefer. Each one drops you in as a consumer.</p>

            <div class="aa-auth-method">
              <div class="aa-auth-method-label mono">Google</div>
              <div id="aa-auth-google" class="aa-auth-google"></div>
            </div>

            <div class="aa-auth-divider mono"><span>or</span></div>

            <form class="aa-auth-method aa-auth-email" id="aa-auth-email-form" novalidate>
              <div class="aa-auth-method-label mono">Email · magic link</div>
              <div class="aa-auth-row">
                <input type="email" id="aa-auth-email-input" placeholder="you@diaspora.world" autocomplete="email" required/>
                <button type="submit" class="btn primary" id="aa-auth-email-btn">Send link</button>
              </div>
              <p class="aa-auth-status mono" id="aa-auth-email-status"></p>
            </form>

            <div class="aa-auth-divider mono"><span>or</span></div>

            <form class="aa-auth-method aa-auth-phone" id="aa-auth-phone-form" novalidate>
              <div class="aa-auth-method-label mono">Phone · SMS code</div>
              <div class="aa-auth-row">
                <input type="tel" id="aa-auth-phone-input" placeholder="+33 6 12 34 56 78" autocomplete="tel" required/>
                <button type="submit" class="btn primary" id="aa-auth-phone-btn">Send code</button>
              </div>
              <div class="aa-auth-row" id="aa-auth-phone-code-row" style="display:none;margin-top:8px">
                <input type="text" id="aa-auth-phone-code" inputmode="numeric" maxlength="6" placeholder="6-digit code"/>
                <button type="button" class="btn primary" id="aa-auth-phone-verify-btn">Verify</button>
              </div>
              <p class="aa-auth-status mono" id="aa-auth-phone-status"></p>
            </form>

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
    wireEmailForm(page);
    wirePhoneForm(page);
  }

  function wireEmailForm (page) {
    const form   = page.querySelector('#aa-auth-email-form');
    const input  = page.querySelector('#aa-auth-email-input');
    const btn    = page.querySelector('#aa-auth-email-btn');
    const status = page.querySelector('#aa-auth-email-status');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = input.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = 'Please enter a valid email.'; status.style.color = 'var(--red)'; return;
      }
      btn.disabled = true; status.style.color = 'var(--muted)'; status.textContent = 'Sending magic link...';
      try {
        const r = await fetch('/api/auth/email/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await r.json();
        if (!r.ok) { status.textContent = 'Error: ' + (data.error || r.status); status.style.color = 'var(--red)'; }
        else       { status.textContent = 'Check your inbox. Link is good for 15 minutes.'; status.style.color = 'var(--green)'; }
      } catch (err) {
        status.textContent = 'Network error: ' + err.message; status.style.color = 'var(--red)';
      } finally { btn.disabled = false; }
    });
  }

  function wirePhoneForm (page) {
    const form   = page.querySelector('#aa-auth-phone-form');
    const input  = page.querySelector('#aa-auth-phone-input');
    const btn    = page.querySelector('#aa-auth-phone-btn');
    const codeRow= page.querySelector('#aa-auth-phone-code-row');
    const codeIn = page.querySelector('#aa-auth-phone-code');
    const verify = page.querySelector('#aa-auth-phone-verify-btn');
    const status = page.querySelector('#aa-auth-phone-status');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const phone = input.value.trim().replace(/[^\d+]/g, '');
      if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
        status.textContent = 'Please use international format, e.g. +33612345678.';
        status.style.color = 'var(--red)'; return;
      }
      btn.disabled = true; status.style.color = 'var(--muted)'; status.textContent = 'Sending SMS code...';
      try {
        const r = await fetch('/api/auth/phone/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await r.json();
        if (!r.ok) { status.textContent = 'Error: ' + (data.error || r.status); status.style.color = 'var(--red)'; }
        else {
          status.textContent = 'Code sent. Enter the 6-digit code below.'; status.style.color = 'var(--green)';
          codeRow.style.display = ''; codeIn.focus();
        }
      } catch (err) {
        status.textContent = 'Network error: ' + err.message; status.style.color = 'var(--red)';
      } finally { btn.disabled = false; }
    });

    verify.addEventListener('click', async () => {
      const phone = input.value.trim().replace(/[^\d+]/g, '');
      const code  = codeIn.value.trim();
      if (!/^\d{6}$/.test(code)) {
        status.textContent = 'Code must be 6 digits.'; status.style.color = 'var(--red)'; return;
      }
      verify.disabled = true; status.style.color = 'var(--muted)'; status.textContent = 'Verifying...';
      try {
        const r = await fetch('/api/auth/phone/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code })
        });
        const data = await r.json();
        if (!r.ok) {
          status.textContent = 'Error: ' + (data.error || r.status) + (typeof data.remaining === 'number' ? ` (${data.remaining} attempts left)` : '');
          status.style.color = 'var(--red)';
        } else {
          writeUser(data.user); status.textContent = 'Signed in.'; status.style.color = 'var(--green)';
          setTimeout(closeSheet, 600);
        }
      } catch (err) {
        status.textContent = 'Network error: ' + err.message; status.style.color = 'var(--red)';
      } finally { verify.disabled = false; }
    });
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
