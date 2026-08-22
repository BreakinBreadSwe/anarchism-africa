/* ANARCHISM.AFRICA — header brand logo mini-slideshow
 *
 * Cycles through /media/ files behind the africa outline in the .brand
 * .logo element. Same source of truth (GET /api/media/list) as the
 * fullscreen home hero, so any file the user drops into media/ shows up
 * here too.
 *
 * The logo itself is CSS-only (mask + outline layers in css/styles.css).
 * This module only mutates a CSS variable — --brand-logo-media — on
 * every .brand .logo element every N seconds.
 */
(function () {
  'use strict';

  const INTERVAL_MS = 4500;
  let files = [];
  let idx = 0;
  let timer = null;

  async function load () {
    try {
      const r = await fetch('/api/media/list', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      // Only image / gif for the mini logo — mp4 doesn't play as a
      // background-image, and animated gifs cycle on their own.
      files = (d.files || []).filter(f => f && (f.type === 'image' || f.type === 'gif'));
    } catch {}
  }

  function tick () {
    if (!files.length) return;
    const src = files[idx].url;
    document.querySelectorAll('.brand .logo').forEach(el => {
      el.style.setProperty('--brand-logo-media', `url("${src}")`);
    });
    idx = (idx + 1) % files.length;
  }

  async function boot () {
    await load();
    if (files.length) {
      tick();
      timer = setInterval(tick, INTERVAL_MS);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AA = window.AA || {};
  window.AA.brandLogo = { reload: () => load().then(tick) };
})();
