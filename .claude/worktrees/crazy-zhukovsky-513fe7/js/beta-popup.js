/* ANARCHISM.AFRICA — beta-popup.js (retired)
 *
 * The "BETA" framing was a leftover concept from a different project. Punk,
 * anarchism, afro-funk — they're constant betas in themselves; the platform
 * doesn't need a chrome label to say so. The concept lives on merch.
 *
 * We keep this file as a stub so any old <script src="js/beta-popup.js">
 * include doesn't 404, and so any code calling AA.beta.* is a safe no-op.
 */
(function () {
  // also clean any stale DOM that earlier versions injected
  function purge () {
    document.querySelectorAll('.beta-pill, #beta-modal').forEach(el => el.remove());
    try { localStorage.removeItem('aa.beta.v1'); } catch {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', purge);
  else purge();

  window.AA = window.AA || {};
  window.AA.beta = { open: () => {}, reset: () => {}, _retired: true };
})();
