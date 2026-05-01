/* ANARCHISM.AFRICA — logo source resolver
 *
 * If you drop your hi-fi PNG at /icons/aa-logo.png, this module discovers it
 * on first load and points every logo surface at it (topbar mark, intro popup
 * inline svg, favicon, og:image). Otherwise everything keeps using the SVG
 * fallback at /icons/icon-192.svg.
 *
 * No code changes needed when you swap — drop the PNG in, hard-refresh, done.
 *
 * Public API: window.AA.logo = { src(), useSvg(), usePng() }
 */
(function () {
  const PNG = '/icons/aa-logo.png';
  const SVG = '/icons/icon-192.svg';

  function setMarkBackground (url) {
    document.querySelectorAll('.brand .logo').forEach(el => {
      // Don't override an admin-uploaded custom-logo — only the default mark
      if (el.classList.contains('custom')) return;
      el.style.backgroundImage = `url('${url}')`;
    });
  }
  function setFavicon (url) {
    const links = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
    links.forEach(l => { l.href = url; });
    // og:image too
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(m => m.setAttribute('content', url));
  }

  async function check (url) {
    try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; }
    catch { return false; }
  }

  async function init () {
    // probe for the PNG; if found, prefer it everywhere
    if (await check(PNG)) {
      setMarkBackground(PNG);
      setFavicon(PNG);
      window.AA = window.AA || {}; window.AA.logo = { src: () => PNG, useSvg: () => { setMarkBackground(SVG); setFavicon(SVG); }, usePng: () => { setMarkBackground(PNG); setFavicon(PNG); } };
    } else {
      window.AA = window.AA || {}; window.AA.logo = { src: () => SVG, useSvg: () => { setMarkBackground(SVG); setFavicon(SVG); }, usePng: () => { setMarkBackground(PNG); setFavicon(PNG); } };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
