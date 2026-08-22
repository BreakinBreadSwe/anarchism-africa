/* ANARCHISM.AFRICA — share + QR code utility
 *
 * One-stop shareable actions for every item on the site (articles,
 * sound tracks, films, events, campaigns, anything with a shareable URL).
 *
 * Public API — window.AA.share:
 *   .open({ url, title, text })
 *     → opens a share sheet: native navigator.share when available
 *       (mobile), else a fallback overlay with QR code + copy-link.
 *   .qr({ url, title })
 *     → always shows the QR overlay (skipping native share).
 *   .buttonHtml({ url, title, kind })
 *     → returns HTML for a small share button. `kind` is 'icon'
 *       (default) or 'chip' (with 'Share' label).
 *
 * DOM delegation: any element with [data-aa-share] attributes automatically
 * opens the sheet on click. Attrs:
 *   data-aa-share       — anything truthy
 *   data-aa-share-url   — full URL to share (defaults to location.href)
 *   data-aa-share-title — display title (defaults to document.title)
 *   data-aa-share-text  — extra description
 *   data-aa-share-mode  — 'qr' to skip native share, 'auto' (default)
 *
 * QR image: uses the api.qrserver.com free service (no signup, no
 * tracking cookies). Swap QR_URL below to self-host if needed.
 */
(function () {
  'use strict';

  const QR_URL = (data, size = 320) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&format=png&data=${encodeURIComponent(data)}`;

  const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9"/></svg>`;

  const CSS = `
    .aa-share-btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 6px;
      width: 32px; height: 32px;
      background: transparent;
      border: 1px solid var(--line, #333);
      color: var(--fg, #eee);
      cursor: pointer;
      padding: 0;
      border-radius: 6px;
      transition: background .12s, color .12s, border-color .12s;
    }
    .aa-share-btn:hover { background: var(--fg, #eee); color: var(--bg, #000); border-color: var(--fg, #eee); }
    .aa-share-btn svg { width: 15px; height: 15px; }
    .aa-share-btn.chip { width: auto; padding: 0 10px; height: 30px;
      font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .06em;
      text-transform: uppercase;
    }

    .aa-share-sheet {
      position: fixed; inset: 0;
      z-index: 9500;
      display: none;
      align-items: center; justify-content: center;
      background: rgba(0, 0, 0, .78);
      backdrop-filter: blur(6px);
      padding: 16px;
    }
    .aa-share-sheet.open { display: flex; animation: aa-share-in .2s ease-out; }
    @keyframes aa-share-in { from { opacity: 0; } to { opacity: 1; } }
    .aa-share-card {
      background: var(--bg, #0a0a0a);
      color: var(--fg, #eee);
      border: 1px solid var(--line, #333);
      max-width: 380px; width: 100%;
      padding: 20px;
      display: flex; flex-direction: column; gap: 14px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
    }
    .aa-share-card h3 {
      margin: 0; font: 700 .95rem 'Space Grotesk', sans-serif;
      display: flex; justify-content: space-between; align-items: center;
    }
    .aa-share-card h3 button {
      background: transparent; border: 0; color: var(--fg, #eee);
      cursor: pointer; font: 400 1.4rem/1 'Space Grotesk', sans-serif; padding: 0 4px;
    }
    .aa-share-card .aa-share-title {
      font: 500 .82rem/1.35 'Space Grotesk', sans-serif;
      color: var(--fg-dim, #999);
      margin: 0;
      overflow-wrap: anywhere;
    }
    .aa-share-card img.aa-share-qr {
      width: 100%; max-width: 260px; height: auto; align-self: center;
      background: #fff; padding: 4px; box-sizing: border-box;
      image-rendering: pixelated;
      border: 1px solid var(--line, #333);
    }
    .aa-share-card .aa-share-url {
      font: 500 .68rem/1.4 'JetBrains Mono', monospace;
      color: var(--fg-dim, #999);
      background: var(--bg-2, rgba(255,255,255,.04));
      border: 1px solid var(--line, #333);
      padding: 8px 10px;
      overflow-wrap: anywhere;
      user-select: all;
    }
    .aa-share-card .aa-share-actions {
      display: flex; gap: 8px; flex-wrap: wrap;
    }
    .aa-share-card .aa-share-actions button {
      flex: 1 1 auto;
      background: transparent;
      border: 1px solid var(--line, #333);
      color: var(--fg, #eee);
      font: 500 .72rem 'JetBrains Mono', monospace;
      letter-spacing: .06em;
      text-transform: uppercase;
      padding: 10px 12px;
      cursor: pointer;
      transition: background .12s, color .12s;
    }
    .aa-share-card .aa-share-actions button:hover { background: var(--fg, #eee); color: var(--bg, #000); }
    .aa-share-card .aa-share-actions button.copied { background: #22c55e; color: #000; border-color: #22c55e; }
  `;

  function esc (s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  function ensureStyles () {
    if (document.getElementById('aa-share-styles')) return;
    const s = document.createElement('style');
    s.id = 'aa-share-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function ensureSheet () {
    let el = document.getElementById('aa-share-sheet');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'aa-share-sheet';
    el.className = 'aa-share-sheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Share');
    el.innerHTML = `
      <div class="aa-share-card">
        <h3>Share <button type="button" data-aa-share-close aria-label="Close">×</button></h3>
        <p class="aa-share-title" data-aa-share-title>—</p>
        <img class="aa-share-qr" data-aa-share-qr alt="QR code" />
        <div class="aa-share-url" data-aa-share-url>—</div>
        <div class="aa-share-actions">
          <button type="button" data-aa-share-copy>Copy link</button>
          <button type="button" data-aa-share-native>Share via…</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) closeSheet(); });
    el.querySelector('[data-aa-share-close]').addEventListener('click', closeSheet);
    el.querySelector('[data-aa-share-copy]').addEventListener('click', async e => {
      const url = el.dataset.currentUrl || '';
      try { await navigator.clipboard.writeText(url); } catch { fallbackCopy(url); }
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.textContent = 'Copied ✓'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1600);
    });
    el.querySelector('[data-aa-share-native]').addEventListener('click', async () => {
      const url = el.dataset.currentUrl || '';
      const title = el.querySelector('[data-aa-share-title]').textContent || '';
      try {
        if (navigator.share) await navigator.share({ title, url });
        else { await navigator.clipboard.writeText(url); }
      } catch {}
    });
    return el;
  }

  function fallbackCopy (str) {
    try {
      const ta = document.createElement('textarea');
      ta.value = str;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch {}
  }

  function closeSheet () {
    const el = document.getElementById('aa-share-sheet');
    if (el) el.classList.remove('open');
  }

  function openSheet ({ url, title, text }) {
    ensureStyles();
    const el = ensureSheet();
    const u = url || location.href;
    const t = title || document.title || '';
    el.dataset.currentUrl = u;
    el.querySelector('[data-aa-share-title]').textContent = t + (text ? ' — ' + text : '');
    el.querySelector('[data-aa-share-url]').textContent = u;
    el.querySelector('[data-aa-share-qr]').src = QR_URL(u);
    el.classList.add('open');
  }

  async function open ({ url, title, text, mode }) {
    const u = url || location.href;
    const t = title || document.title || '';
    // 'qr' mode → always show the sheet.
    // 'auto' → try native share first on mobile; fall back to sheet.
    if (mode !== 'qr' && navigator.share && /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title: t, text, url: u });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return; // user cancelled
        // fall through to sheet on any other failure
      }
    }
    openSheet({ url: u, title: t, text });
  }

  function qr (opts) { openSheet(opts || {}); }

  function buttonHtml (opts = {}) {
    const { url = '', title = '', text = '', kind = 'icon', className = '' } = opts;
    const label = kind === 'chip' ? `${ICON_SHARE}<span>Share</span>` : ICON_SHARE;
    // Route every share URL through /api/share so link previewers
    // (WhatsApp, Signal, Telegram, iMessage, Slack, X, IG, FB) get
    // per-item OG tags — real title, real description, real thumbnail.
    // Humans redirect to the SPA page in 0ms.
    const routed = toShareUrl(url);
    return `<button type="button" class="aa-share-btn ${kind === 'chip' ? 'chip' : ''} ${className}"
      data-aa-share
      data-aa-share-url="${esc(routed)}"
      data-aa-share-title="${esc(title)}"
      data-aa-share-text="${esc(text)}"
      title="Share"
      aria-label="Share">${label}</button>`;
  }

  // Rewrite /item.html?type=X&id=Y and /sound-library.html?track=Z into
  // /api/share?kind=X&id=Y so previewers see per-item OG metadata.
  // Other URLs (external, unknown routes) pass through unchanged.
  function toShareUrl (raw) {
    try {
      const u = new URL(raw, location.origin);
      if (u.origin !== location.origin) return raw;
      if (u.pathname === '/item.html') {
        const kind = u.searchParams.get('type') || 'article';
        const id   = u.searchParams.get('id')   || '';
        if (id) return `${u.origin}/api/share?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
      }
      if (u.pathname === '/sound-library.html') {
        const id = u.searchParams.get('track') || u.searchParams.get('id') || '';
        if (id) return `${u.origin}/api/share?kind=song&id=${encodeURIComponent(id)}`;
      }
      return raw;
    } catch {
      return raw;
    }
  }

  // Global click delegation — any [data-aa-share] element opens the sheet.
  function bindDelegation () {
    document.addEventListener('click', e => {
      const t = e.target?.closest?.('[data-aa-share]');
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      open({
        url:   t.dataset.aaShareUrl,
        title: t.dataset.aaShareTitle,
        text:  t.dataset.aaShareText,
        mode:  t.dataset.aaShareMode
      });
    }, true);   // capture-phase so this fires BEFORE card-body click handlers
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSheet();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindDelegation);
  else bindDelegation();

  window.AA = window.AA || {};
  window.AA.share = { open, qr, buttonHtml };
})();
