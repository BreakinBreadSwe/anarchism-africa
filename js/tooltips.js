/* ANARCHISM.AFRICA — hover tooltips, top-layer + auto-hide
 *
 * One floating tooltip element appended to <body> at z-index:10000 so it
 * renders ABOVE every header/rail/footer/modal stacking context. Position
 * is recomputed at hover-time so it never gets covered.
 *
 * Auto-hide: the bubble lingers for the time it takes a typical reader to
 * read the label — ~70ms per character, clamped to [1.4s, 5s]. Hovering
 * a different button instantly swaps the bubble; clicking dismisses.
 *
 * Selectors covered: .rail .rail-item, .rail .rail-menu-toggle,
 * .bottombar button, .topbar button, .topbar a.btn, .menu-toggle,
 * .logo-shuffle, .role-switch-btn, .aa-install-pill, [data-tooltip].
 *
 * Each host gets a `data-aa-tooltip` attribute (label) and its native
 * `title=` is moved to `data-aa-title-backup` so the browser's slow native
 * tooltip never appears alongside ours.
 */
(function () {
  if (typeof document === 'undefined') return;

  const SELECTORS = [
    '.rail .rail-item',
    '.rail .rail-menu-toggle',
    '.bottombar button',
    '.topbar button',
    '.topbar a.btn',
    '.menu-toggle',
    '.logo-shuffle',
    '.logo-lock',
    '.role-switch-btn',
    '.aa-install-pill',
    '[data-tooltip]'
  ].join(',');

  function labelFor (el) {
    const dt = el.getAttribute('data-tooltip');           if (dt) return dt.trim();
    const t  = el.getAttribute('title');                  if (t)  return t.trim();
    const al = el.getAttribute('aria-label');             if (al) return al.trim();
    const span = el.querySelector('span:last-child:not(.glyph):not(.logo):not(.dot)');
    if (span && span.textContent.trim()) return span.textContent.trim();
    return '';
  }

  function decorate (el) {
    if (el.dataset.aaTooltip != null) return;
    const label = labelFor(el);
    if (!label) return;
    el.setAttribute('data-aa-tooltip', label);
    if (el.hasAttribute('title')) {
      el.dataset.aaTitleBackup = el.getAttribute('title');
      el.removeAttribute('title');
    }
  }

  function scan (root) { (root || document).querySelectorAll(SELECTORS).forEach(decorate); }

  // ---- floating bubble ------------------------------------------------
  let bubble = null;
  let hideTimer = null;
  let currentHost = null;

  function ensureBubble () {
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.id = 'aa-tip';
    bubble.setAttribute('role', 'tooltip');
    bubble.setAttribute('aria-hidden', 'true');
    bubble.style.cssText = [
      'position:fixed',
      'z-index:10000',                  // above EVERYTHING
      'pointer-events:none',
      'opacity:0',
      'transform:translateY(2px)',
      'transition:opacity .14s ease, transform .14s ease',
      'background:var(--fg, #fff)',
      'color:var(--bg, #0a0a0a)',
      'border:1px solid var(--fg, #fff)',
      'padding:6px 10px',
      'font:600 .68rem JetBrains Mono, ui-monospace, monospace',
      'letter-spacing:.08em',
      'text-transform:uppercase',
      'white-space:nowrap',
      'max-width:min(60vw, 320px)',
      'box-shadow:2px 2px 0 0 rgba(0,0,0,.25)'
    ].join(';');
    document.body.appendChild(bubble);
    return bubble;
  }

  // Reading-time formula: average ~3.5 chars per word, ~250 wpm casual
  // reading → ~70ms/char. Clamp to a comfortable [1.4s, 5s] window.
  function readMs (text) {
    const ms = (text || '').length * 70;
    return Math.max(1400, Math.min(5000, ms));
  }

  function place (host) {
    if (!bubble) return;
    const r = host.getBoundingClientRect();
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const margin = 8;
    const vw = window.innerWidth, vh = window.innerHeight;

    // Heuristics:
    //  - rail items: prefer right of the button (the rail hugs left)
    //  - bottombar items: prefer above (footer hugs bottom)
    //  - topbar items: prefer below
    //  - everything else: try below, then above, then right, then left
    let x, y, side = 'below';
    const isRail   = !!host.closest('.rail');
    const isFooter = !!host.closest('.bottombar');
    const isHeader = !!host.closest('.topbar');

    if (isRail)        side = 'right';
    else if (isFooter) side = 'above';
    else if (isHeader) side = 'below';

    function tryPlace (s) {
      switch (s) {
        case 'right': return { x: r.right + margin, y: r.top + r.height/2 - bh/2 };
        case 'left':  return { x: r.left - bw - margin, y: r.top + r.height/2 - bh/2 };
        case 'above': return { x: r.left + r.width/2 - bw/2, y: r.top - bh - margin };
        case 'below': return { x: r.left + r.width/2 - bw/2, y: r.bottom + margin };
      }
    }
    const order = side === 'right' ? ['right','below','above','left']
                : side === 'above' ? ['above','below','right','left']
                : side === 'below' ? ['below','above','right','left']
                : ['left','below','above','right'];
    for (const s of order) {
      const p = tryPlace(s);
      if (p.x >= 4 && p.x + bw <= vw - 4 && p.y >= 4 && p.y + bh <= vh - 4) {
        x = p.x; y = p.y; break;
      }
    }
    if (x == null) { const p = tryPlace(side); x = p.x; y = p.y; }
    bubble.style.left = Math.round(x) + 'px';
    bubble.style.top  = Math.round(y) + 'px';
  }

  function show (host) {
    const label = host.dataset.aaTooltip;
    if (!label) return;
    ensureBubble();
    if (hideTimer) clearTimeout(hideTimer);
    currentHost = host;
    bubble.textContent = label;
    bubble.setAttribute('aria-hidden', 'false');
    // first place after layout settles so width/height are known
    bubble.style.opacity = '0';
    requestAnimationFrame(() => {
      place(host);
      bubble.style.opacity = '1';
      bubble.style.transform = 'translateY(0)';
    });
    hideTimer = setTimeout(() => hide(host), readMs(label));
  }
  function hide (host) {
    if (host && currentHost !== host) return;
    if (!bubble) return;
    bubble.style.opacity = '0';
    bubble.style.transform = 'translateY(2px)';
    bubble.setAttribute('aria-hidden', 'true');
    currentHost = null;
  }

  // Pointer events — hover for mice, focus for keyboards
  document.addEventListener('mouseover', e => {
    const host = e.target.closest?.('[data-aa-tooltip]');
    if (host && host !== currentHost) show(host);
  });
  document.addEventListener('mouseout', e => {
    const host = e.target.closest?.('[data-aa-tooltip]');
    if (host) hide(host);
  });
  document.addEventListener('focusin', e => {
    const host = e.target.closest?.('[data-aa-tooltip]');
    if (host) show(host);
  });
  document.addEventListener('focusout', e => {
    const host = e.target.closest?.('[data-aa-tooltip]');
    if (host) hide(host);
  });
  document.addEventListener('click', e => {
    if (currentHost && !e.target.closest?.('[data-aa-tooltip]')) hide();
  }, true);
  // Hide on scroll/resize so it doesn't drift away from its host
  window.addEventListener('scroll', () => hide(), { passive: true, capture: true });
  window.addEventListener('resize', () => hide());

  // ---- bootstrap + observer -------------------------------------------
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan());
  else scan();

  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(n => {
        if (!(n instanceof Element)) return;
        if (n.matches?.(SELECTORS)) decorate(n);
        scan(n);
      });
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  window.AA = window.AA || {};
  window.AA.tooltips = { rescan: scan, hide };
})();
