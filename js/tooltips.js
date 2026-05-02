/* ANARCHISM.AFRICA - hover tooltip surfacer
 *
 * Native title="..." tooltips are slow (~2s delay), small, and ugly. Rather
 * than rebuild every existing accessible label, this script:
 *   1. Walks the DOM for buttons/links/rail-items/bottombar buttons that
 *      already carry title or aria-label (or whose first label-span text)
 *      and copies that label into a data-aa-tooltip attribute.
 *   2. CSS in styles.css renders the bubble on hover.
 *   3. We KEEP the original title/aria-label so screen readers still see it.
 *      For mouse users we strip title= (so no native + custom double-tip).
 *
 * Re-runs on a MutationObserver so dynamically added buttons (rail switcher,
 * install pill, role-switcher cards, etc.) get tooltips too.
 */
(function () {
  if (typeof document === 'undefined') return;

  const SELECTORS = [
    '.rail .rail-item',
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
    // Priority: explicit data-tooltip, then title, then aria-label, then last
    // span's textContent (rail items render "<glyph><label>" so the label is
    // the second/last span).
    const dt = el.getAttribute('data-tooltip');
    if (dt) return dt.trim();
    const t = el.getAttribute('title');
    if (t) return t.trim();
    const al = el.getAttribute('aria-label');
    if (al) return al.trim();
    const span = el.querySelector('span:last-child:not(.glyph):not(.logo)');
    if (span && span.textContent.trim()) return span.textContent.trim();
    return '';
  }

  function decorate (el) {
    if (el.dataset.aaTooltip != null) return;
    const label = labelFor(el);
    if (!label) return;
    el.setAttribute('data-aa-tooltip', label);
    // Prevent double-tip from the browser's native popup
    if (el.hasAttribute('title')) {
      el.dataset.aaTitleBackup = el.getAttribute('title');
      el.removeAttribute('title');
    }
  }

  function scan (root) {
    (root || document).querySelectorAll(SELECTORS).forEach(decorate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan());
  } else {
    scan();
  }

  // Watch for dynamically inserted buttons (rail switcher injects, install
  // pill appears, role-switch sheet builds, etc.)
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
  window.AA.tooltips = { rescan: scan };
})();
