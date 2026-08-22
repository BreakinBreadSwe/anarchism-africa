/* ANARCHISM.AFRICA — Now Playing fullscreen page
 *
 * Tap the mini-player's artwork thumbnail OR the track title/artist to open
 * a fullscreen "Now Playing" page. It covers the viewport EXCEPT for the
 * mini-player (which stays docked as transport) and the mobile footer menu
 * (which stays visible for navigation). Close with X, Esc, or by swiping down.
 *
 * Purely a presentation layer — the actual playback state lives in
 * window.MP (js/mini-player.js).
 */
(function () {
  'use strict';

  const CSS = `
    .aa-np {
      position: fixed;
      inset: 0;
      /* Leave room at the bottom for the mini-player (56) + footer menu
         (68 + safe-area). On desktop the footer menu is hidden while
         mp-active, so only reserve for the player. */
      bottom: calc(56px + 68px + env(safe-area-inset-bottom, 0px));
      z-index: 40;
      display: none;
      background: var(--bg);
      color: var(--fg);
      overflow: hidden;
      animation: aa-np-in .3s cubic-bezier(.2,.7,.2,1);
    }
    .aa-np.open { display: flex; flex-direction: column; }
    @media (min-width: 769px) {
      body.mp-active .aa-np { bottom: 56px; }
    }
    @keyframes aa-np-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: none; }
    }

    .aa-np-close {
      position: absolute;
      top: calc(12px + env(safe-area-inset-top, 0px));
      right: 14px;
      width: 40px; height: 40px;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--fg);
      font: 400 1.6rem/1 'Space Grotesk', sans-serif;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 2;
      transition: background .15s, color .15s;
    }
    .aa-np-close:hover { background: var(--fg); color: var(--bg); }

    .aa-np-body {
      flex: 1 1 auto;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      gap: 16px;
      padding: calc(24px + env(safe-area-inset-top, 0px)) 20px 20px;
      max-width: 720px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }

    .aa-np-art {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }
    .aa-np-art-inner {
      width: min(80vmin, 100%, 500px);
      aspect-ratio: 1;
      background: var(--bg-2) center / cover no-repeat;
      border: 1px solid var(--line);
      box-shadow: 0 6px 40px rgba(0,0,0,.4);
    }

    .aa-np-meta {
      text-align: center;
      display: flex; flex-direction: column; gap: 6px;
      padding: 0 4px;
    }
    .aa-np-title {
      font: 700 clamp(1.2rem, 4vw, 1.8rem)/1.15 'Space Grotesk', sans-serif;
      margin: 0;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .aa-np-artist {
      font: 500 .95rem/1.3 'JetBrains Mono', monospace;
      color: var(--fg-dim);
      letter-spacing: .04em;
      margin: 0;
    }
    .aa-np-actions {
      display: flex; gap: 10px; justify-content: center;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .aa-np-actions button {
      background: transparent;
      border: 1px solid var(--line);
      color: var(--fg);
      font: 500 .75rem 'JetBrains Mono', monospace;
      letter-spacing: .08em;
      text-transform: uppercase;
      padding: 8px 14px;
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    .aa-np-actions button:hover { background: var(--fg); color: var(--bg); }
    .aa-np-actions button.is-on { background: var(--accent); color: #000; border-color: var(--accent); }

    .aa-np-details {
      display: grid; grid-template-columns: max-content 1fr;
      gap: 2px 12px;
      margin: 8px 0 0;
      font: 500 .75rem/1.5 'JetBrains Mono', monospace;
      color: var(--fg-dim, #999);
      text-align: left;
    }
    .aa-np-details > div { display: contents; }
    .aa-np-details dt { text-transform: uppercase; letter-spacing: .08em; opacity: .7; }
    .aa-np-details dd { margin: 0; color: var(--fg, #eee); overflow-wrap: anywhere; }
    .aa-np-desc {
      font: 400 .82rem/1.5 'Space Grotesk', sans-serif;
      color: var(--fg, #eee);
      margin: 10px 0 0;
      max-height: 30vh;
      overflow-y: auto;
      text-align: left;
    }
    .aa-np-ext {
      display: inline-block; margin-top: 8px;
      font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .06em;
      color: var(--accent, #ffd700);
      text-decoration: none;
      border-bottom: 1px solid currentColor;
    }
    .aa-np-ext:hover { color: var(--fg, #eee); }

    @media (max-width: 480px) {
      .aa-np-body { padding-top: calc(56px + env(safe-area-inset-top, 0px)); }
    }
  `;

  function esc (s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  function ensureStyles () {
    if (document.getElementById('aa-np-styles')) return;
    const s = document.createElement('style');
    s.id = 'aa-np-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function ensureDom () {
    let el = document.getElementById('aa-np');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'aa-np';
    el.className = 'aa-np';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Now playing');
    el.innerHTML = `
      <button class="aa-np-close" type="button" aria-label="Close">×</button>
      <div class="aa-np-body">
        <div class="aa-np-art"><div class="aa-np-art-inner" id="aa-np-art"></div></div>
        <div class="aa-np-meta">
          <p class="aa-np-title"  id="aa-np-title">—</p>
          <p class="aa-np-artist" id="aa-np-artist">—</p>
          <div id="aa-np-meta-rich"></div>
          <div class="aa-np-actions">
            <button type="button" id="aa-np-like">Like</button>
            <button type="button" id="aa-np-share">Share · QR</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('.aa-np-close').addEventListener('click', close);
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelector('#aa-np-like')?.addEventListener('click', onLike);
    el.querySelector('#aa-np-share')?.addEventListener('click', onShare);
    return el;
  }

  function paint () {
    const el = document.getElementById('aa-np');
    if (!el) return;
    const cur = window.MP?.current || {};
    const artSrc = document.getElementById('mp-art')?.style?.backgroundImage || '';
    el.querySelector('#aa-np-art').style.backgroundImage = artSrc;
    el.querySelector('#aa-np-title').textContent  = cur.title  || '—';
    el.querySelector('#aa-np-artist').textContent = cur.artist || cur.author || '';
    // Rich metadata block — populate from whatever's on MP.current.
    // slToSong / random-radio both spread the raw track record now, so
    // fields like description, year, category, duration, source,
    // external url, tags, publishedAt are all available.
    const meta = el.querySelector('#aa-np-meta-rich');
    if (meta) {
      const rows = [];
      if (cur.year)         rows.push(['Year',        cur.year]);
      if (cur.category)     rows.push(['Category',    cur.category]);
      if (cur.duration && typeof cur.duration === 'number') {
        const m = Math.floor(cur.duration / 60), s = Math.floor(cur.duration % 60);
        rows.push(['Duration', `${m}:${String(s).padStart(2,'0')}`]);
      }
      if (cur.source_name || cur.source) rows.push(['Source', cur.source_name || cur.source]);
      if (cur.publishedAt || cur.published_at) rows.push(['Published', String(cur.publishedAt || cur.published_at).slice(0, 10)]);
      if (Array.isArray(cur.tags) && cur.tags.length) rows.push(['Tags', cur.tags.slice(0, 8).join(' · ')]);
      const desc = cur.description || cur.summary || cur.notes;
      const extUrl = cur.external_url || cur.url || cur.sourceUrl;
      meta.innerHTML = `
        ${rows.length ? `<dl class="aa-np-details">${rows.map(([k, v]) => `<div><dt>${escHTML(k)}</dt><dd>${escHTML(v)}</dd></div>`).join('')}</dl>` : ''}
        ${desc ? `<p class="aa-np-desc">${escHTML(desc)}</p>` : ''}
        ${extUrl ? `<a class="aa-np-ext" href="${escHTML(extUrl)}" target="_blank" rel="noopener">Open source ↗</a>` : ''}
      `;
    }
    syncLike();
  }
  function escHTML (s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  function syncLike () {
    const btn = document.getElementById('aa-np-like');
    if (!btn) return;
    const cur = window.MP?.current;
    const on = !!(cur && window.AA?.wishlist?.has?.(cur.id, 'song'));
    btn.classList.toggle('is-on', on);
    btn.textContent = on ? 'Liked' : 'Like';
  }
  function onLike () {
    const cur = window.MP?.current;
    const W = window.AA?.wishlist;
    if (!cur || !W) return;
    if (W.has?.(cur.id, 'song')) W.remove?.(cur.id, 'song');
    else W.add?.({ id: cur.id, title: cur.title, image: cur.image }, 'song');
    syncLike();
  }
  async function onShare () {
    const cur = window.MP?.current; if (!cur) return;
    const url = location.origin + '/sound-library.html?track=' + encodeURIComponent(cur.id);
    if (window.AA?.share) {
      window.AA.share.open({ url, title: cur.title || 'Track', text: cur.artist || cur.author || '' });
      return;
    }
    try {
      if (navigator.share) await navigator.share({ title: cur.title, text: `${cur.title} — ${cur.artist || ''}`, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  }

  function open () {
    ensureStyles();
    const el = ensureDom();
    paint();
    el.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
  }
  function close () {
    const el = document.getElementById('aa-np');
    if (!el) return;
    el.classList.remove('open');
    document.documentElement.style.overflow = '';
  }
  function toggle () {
    const el = document.getElementById('aa-np');
    if (el?.classList.contains('open')) close(); else open();
  }

  function bindTriggers () {
    // Delegate on document so clicks on future mini-player instances still open.
    document.addEventListener('click', e => {
      const t = e.target?.closest?.('#mp-art, #mp-title, #mp-artist, #mp-info, .mp-info');
      if (!t) return;
      if (!window.MP?.current) return;   // nothing playing → do nothing
      e.stopPropagation();
      open();
    });
    // Esc to close, tap on backdrop already handled via container click.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('aa-np')?.classList.contains('open')) close();
    });
    // Repaint when the track changes (title/artist DOM update happens
    // synchronously in MP.play, so a next-tick paint is enough).
    const t = document.getElementById('mp-title');
    if (t) {
      const mo = new MutationObserver(() => {
        if (document.getElementById('aa-np')?.classList.contains('open')) paint();
      });
      mo.observe(t, { childList: true, characterData: true, subtree: true });
    }
    // Make the title/artist look tappable.
    const info = document.querySelector('#mp-info, .mini-player .mp-info');
    if (info) info.style.cursor = 'pointer';
    const art = document.getElementById('mp-art');
    if (art) art.style.cursor = 'pointer';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindTriggers);
  else bindTriggers();

  window.AA = window.AA || {};
  window.AA.nowPlaying = { open, close, toggle };
})();
