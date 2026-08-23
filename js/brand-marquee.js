/* ANARCHISM.AFRICA — topbar wordmark marquee
 *
 * On mobile (<= 768px) the brand wordmark ("ANARCHISM.AFRICA", "PUBLISHER·A.A.",
 * etc.) sometimes overflows the topbar. Instead of a truncating ellipsis
 * the wordmark now slow-scrolls end-to-end every 9 seconds — CSS animation
 * defined in styles.css.
 *
 * This module does two things:
 *   1. Copies the wordmark's text into a data-marquee attribute so the
 *      CSS ::after can render an identical trailing copy (seamless loop).
 *   2. Watches for overflow — if the wordmark actually FITS the container
 *      it adds .no-marquee to the .logoword so the animation is disabled.
 *      Re-runs on window resize + font-load.
 */
(function () {
  'use strict';

  function apply () {
    document.querySelectorAll('.brand .logoword').forEach(box => {
      const word = box.querySelector('.word');
      if (!word) return;
      // Stamp the trailing copy content.
      const txt = (word.textContent || '').trim();
      if (word.dataset.marquee !== txt) word.dataset.marquee = txt;
      // Check overflow — if the raw word width < container width,
      // no scroll needed. Take padding into account by comparing
      // scrollWidth vs offsetWidth.
      const needsMarquee = word.scrollWidth > box.clientWidth + 4;
      box.classList.toggle('no-marquee', !needsMarquee);
    });
  }

  let raf = null;
  function schedule () {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { raf = null; apply(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  window.addEventListener('resize', schedule);
  window.addEventListener('load',   schedule);
  document.fonts?.ready?.then(schedule).catch(() => {});
  // Also re-check periodically in case the wordmark text is swapped by
  // logo-mark's mode cycler (rare, but cheap).
  setInterval(schedule, 4000);

  window.AA = window.AA || {};
  window.AA.brandMarquee = { refresh: apply };
})();
