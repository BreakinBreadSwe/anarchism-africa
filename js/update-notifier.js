/* ANARCHISM.AFRICA — update notifier
 *
 * Polls /api/system/version every 5 minutes. When the deployment SHA changes
 * (= a new build is live), shows a small toast at the bottom of the screen
 * with a Refresh button. Dismissing the toast suppresses it for THIS
 * version only — the next deploy after dismissing re-prompts.
 *
 * No service worker required — survives across all tabs because each one
 * polls independently. The 5-min cadence keeps server load trivial while
 * still catching new deploys within a few minutes.
 *
 * Mounted from every page. Self-contained — no AA_CONFIG / AA dependencies.
 */
(function () {
  const ENDPOINT = '/api/system/version';
  const POLL_MS  = 5 * 60 * 1000;      // 5 min
  const DISMISS_KEY = 'aa.update-dismissed';

  let initialVersion = null;

  async function fetchVersion () {
    try {
      const r = await fetch(ENDPOINT, { cache: 'no-store' });
      if (!r.ok) return null;
      const d = await r.json();
      return d && d.version ? d : null;
    } catch { return null; }
  }

  function showToast (newVersion) {
    if (document.getElementById('aa-update-toast')) return; // already shown
    // Don't pester the user if they dismissed this specific version already.
    try {
      if (localStorage.getItem(DISMISS_KEY) === newVersion.version) return;
    } catch {}

    const toast = document.createElement('div');
    toast.id = 'aa-update-toast';
    toast.setAttribute('role', 'alert');
    toast.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
      'background:#0a0a0a', 'color:#fff',
      'border:1px solid rgba(255,255,255,.15)', 'border-radius:14px',
      'padding:12px 14px 12px 18px', 'display:flex', 'align-items:center', 'gap:10px',
      'font-family:"Space Grotesk",ui-sans-serif,system-ui,sans-serif',
      'font-size:.85rem', 'z-index:9999',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)',
      'animation:aa-toast-in .35s cubic-bezier(.2,.8,.2,1)',
      // Stay clear of the mobile bottom-bar
      'max-width:calc(100vw - 32px)'
    ].join(';');
    toast.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:8px;line-height:1.3">
        <span aria-hidden="true" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;animation:aa-toast-pulse 1.6s infinite"></span>
        <span><b>New update available</b><br><span style="color:#aaa;font-size:.74rem;font-family:'JetBrains Mono',monospace">${newVersion.short || newVersion.version.slice(0, 7)}</span></span>
      </span>
      <button type="button" id="aa-update-refresh" style="background:#fff;color:#0a0a0a;border:0;border-radius:99px;padding:7px 14px;font:600 .8rem/'Space Grotesk',sans-serif;cursor:pointer">Refresh ↻</button>
      <button type="button" id="aa-update-dismiss" aria-label="Dismiss" style="background:none;color:#888;border:0;font:1.1rem/1 sans-serif;cursor:pointer;padding:4px 6px">✕</button>
    `;

    // Inject the toast-only @keyframes once (idempotent — guard by id)
    if (!document.getElementById('aa-update-toast-style')) {
      const s = document.createElement('style');
      s.id = 'aa-update-toast-style';
      s.textContent = `
        @keyframes aa-toast-in     { from { opacity:0; transform:translate(-50%, 16px); } to { opacity:1; transform:translate(-50%, 0); } }
        @keyframes aa-toast-pulse  { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        @keyframes aa-toast-out    { to { opacity:0; transform:translate(-50%, 16px); } }
        .aa-toast-leaving { animation: aa-toast-out .25s cubic-bezier(.4,0,1,1) forwards; }
      `;
      document.head.appendChild(s);
    }

    document.body.appendChild(toast);

    document.getElementById('aa-update-refresh').addEventListener('click', () => {
      // Hard reload — bypasses HTTP cache, picks up new JS/CSS/HTML.
      try { localStorage.removeItem(DISMISS_KEY); } catch {}
      window.location.reload();
    });
    document.getElementById('aa-update-dismiss').addEventListener('click', () => {
      try { localStorage.setItem(DISMISS_KEY, newVersion.version); } catch {}
      toast.classList.add('aa-toast-leaving');
      setTimeout(() => toast.remove(), 260);
    });
  }

  async function poll () {
    const cur = await fetchVersion();
    if (!cur || !initialVersion) return;
    if (cur.version !== initialVersion && cur.version !== 'dev') {
      showToast(cur);
    }
  }

  async function init () {
    const v = await fetchVersion();
    if (!v) return;
    initialVersion = v.version;
    // Poll every POLL_MS. Also poll once when the tab regains focus so
    // long-idle tabs catch up immediately without waiting for the cadence.
    setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') poll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
