/* ANARCHISM.AFRICA — theme controller (dark / light / system) */
(function () {
  const KEY = 'aa.themeMode';

  function apply (mode) {
    // mode = 'dark' | 'light' | 'system'
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(KEY, mode);
    // sync header buttons
    document.querySelectorAll('.theme-toggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    // update browser theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const isLight = mode === 'light' || (mode === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
      meta.setAttribute('content', isLight ? '#f5f1ea' : '#0a0a0a');
    }
    // notify listeners
    window.dispatchEvent(new CustomEvent('aa:theme', { detail: { mode } }));
  }

  function init () {
    const saved = localStorage.getItem(KEY) || 'dark';
    apply(saved);
    document.querySelectorAll('.theme-toggle button').forEach(b => {
      b.addEventListener('click', () => apply(b.dataset.mode));
    });
    // react to OS change while in system mode
    matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
      if (localStorage.getItem(KEY) === 'system') apply('system');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AA_THEME = { apply };
})();
