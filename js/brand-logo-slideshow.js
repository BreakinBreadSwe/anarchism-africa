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
      // App logo has its OWN slide list — cms.appLogo.slides — so admin
      // can curate the tiny 40x40 rotation independently of the fullscreen
      // hero. Falls back to cms.slides (share with hero) when the app-logo
      // list is empty, so nobody's stuck with a blank icon on first setup.
      const r = await fetch('/api/africa-slides', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      const own    = Array.isArray(d?.appLogo?.slides) ? d.appLogo.slides : [];
      const shared = Array.isArray(d?.slides)          ? d.slides          : [];
      const pool   = own.length ? own : shared;
      files = pool
        .filter(s => s && s.src && (s.type === 'image' || s.type === 'gif'))
        .map(s => ({ url: s.src, type: s.type }));
      if (d?.appLogo?.rotateMs) intervalOverride = Math.max(1000, Math.min(60000, Number(d.appLogo.rotateMs)));
    } catch {}
  }
  let intervalOverride = null;

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
      timer = setInterval(tick, intervalOverride || INTERVAL_MS);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AA = window.AA || {};
  window.AA.brandLogo = { reload: () => load().then(tick) };
})();
