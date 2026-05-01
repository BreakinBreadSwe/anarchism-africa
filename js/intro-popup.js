/* ANARCHISM.AFRICA — first-load intro + theme picker
 * Strips legacy gold accent on every load and shows a Dark/Light/System picker
 * on first visit. State key: localStorage['aa.intro.v1'].
 * Public API: AA.intro.open(), AA.intro.reset(), AA.intro.applyTheme(t)
 */
(function () {
  const KEY = 'aa.intro.v1';
  const THEME_KEY = 'aa.theme';

  function killGold () {
    try {
      const root = document.documentElement;
      const t = (localStorage.getItem(THEME_KEY) || 'system').toLowerCase();
      const dark = (t === 'dark') || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      root.style.setProperty('--accent', dark ? '#ffffff' : '#000000');
      document.querySelectorAll('[style*="#FFD700"], [style*="#ffd700"]').forEach(el => {
        el.style.cssText = el.style.cssText.replace(/#FFD700/gi, dark ? '#ffffff' : '#000000');
      });
    } catch {}
  }
  function applyTheme (t) {
    const choice = (t || 'system').toLowerCase();
    localStorage.setItem(THEME_KEY, choice);
    const root = document.documentElement;
    if (choice === 'system') {
      root.removeAttribute('data-theme');
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      root.style.setProperty('--accent', dark ? '#ffffff' : '#000000');
    } else {
      root.setAttribute('data-theme', choice);
      root.style.setProperty('--accent', choice === 'dark' ? '#ffffff' : '#000000');
    }
    document.dispatchEvent(new CustomEvent('aa:theme:change', { detail: { theme: choice } }));
  }
  function get () { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
  function set (v) { try { localStorage.setItem(KEY, JSON.stringify({ ...get(), ...v })); } catch {} }
  function reset () { try { localStorage.removeItem(KEY); } catch {} }

  function open (force) {
    if (!force && get().done) return;
    let m = document.getElementById('aa-intro-modal');
    if (m) { m.classList.add('open'); return; }
    m = document.createElement('div');
    m.id = 'aa-intro-modal';
    m.className = 'modal aa-intro-modal open';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-labelledby', 'aa-intro-title');
    m.innerHTML = `
      <div class="panel" style="max-width:560px;width:calc(100% - 32px)">
        <div class="panel-body" style="padding:34px 30px">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
            <span class="aa-intro-mark">
              <svg viewBox="0 0 192 192" width="56" height="56" aria-hidden="true">
                <rect width="192" height="192" rx="24" fill="#000"/>
                <path d="M 78 28 Q 100 22 124 28 Q 146 36 156 54 Q 162 70 158 84 Q 154 96 144 104 Q 142 116 138 130 Q 134 144 126 154 Q 116 162 106 158 Q 98 150 92 138 Q 84 122 76 108 Q 66 92 58 78 Q 52 64 56 50 Q 64 34 78 28 Z" fill="none" stroke="#fff" stroke-width="3"/>
                <ellipse cx="160" cy="118" rx="4.5" ry="11" fill="none" stroke="#fff" stroke-width="2"/>
                <clipPath id="aa-intro-africa"><path d="M 78 28 Q 100 22 124 28 Q 146 36 156 54 Q 162 70 158 84 Q 154 96 144 104 Q 142 116 138 130 Q 134 144 126 154 Q 116 162 106 158 Q 98 150 92 138 Q 84 122 76 108 Q 66 92 58 78 Q 52 64 56 50 Q 64 34 78 28 Z"/></clipPath>
                <g clip-path="url(#aa-intro-africa)">
                  <polygon points="62,160 96,30 110,30 84,160" fill="#fff"/>
                  <polygon points="98,30 112,30 142,160 128,160" fill="#fff"/>
                  <rect x="40" y="100" width="120" height="14" fill="#fff"/>
                  <polygon points="92,100 116,100 110,114 96,114" fill="#000"/>
                </g>
              </svg>
            </span>
            <div>
              <h2 id="aa-intro-title" style="margin:0;font-family:'Bebas Neue',sans-serif;letter-spacing:.04em;font-size:1.6rem;line-height:1">ANARCHISM<span style="opacity:.5">.</span>AFRICA</h2>
              <p class="mono" style="margin:4px 0 0;font-size:.7rem;color:var(--muted);letter-spacing:.14em">BETA &middot; IN PROGRESS</p>
            </div>
          </div>
          <p style="color:var(--fg-dim);margin:0 0 14px;line-height:1.55;font-size:.95rem">
            An afrofuturist 360&deg; on afro-anarchism &mdash; Africa &amp; diaspora.
            Films, sound, books, events, community. Curated by COOLHUNTPARIS,
            stewarded by LUVLAB. Every &hearts; you save and every word you send
            shapes what ships next.
          </p>
          <h3 style="margin:18px 0 10px;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-dim)">Pick a theme</h3>
          <div class="aa-intro-themes">
            <button class="aa-intro-theme" data-theme="dark"><span class="aa-intro-swatch" style="background:#000;color:#fff">A</span><b>Dark</b><span>black canvas, white type</span></button>
            <button class="aa-intro-theme" data-theme="light"><span class="aa-intro-swatch" style="background:#fff;color:#000;border:1px solid #000">A</span><b>Light</b><span>cream canvas, black type</span></button>
            <button class="aa-intro-theme" data-theme="system"><span class="aa-intro-swatch" style="background:linear-gradient(90deg,#000 50%,#fff 50%);color:#888">A</span><b>System</b><span>follow your device</span></button>
          </div>
          <p class="mono" style="font-size:.7rem;color:var(--muted);margin:18px 0 0;line-height:1.5">
            Full customization &mdash; colors, fonts, layout, accent &mdash;
            lives in your <b>profile &middot; settings</b> later.
          </p>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
            <button class="btn ghost" data-intro-skip>Skip</button>
            <button class="btn primary" data-intro-continue>Continue &rarr;</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);
    let chosen = (get().theme) || 'system';
    paintChoice();
    function paintChoice () {
      m.querySelectorAll('.aa-intro-theme').forEach(b => b.classList.toggle('active', b.dataset.theme === chosen));
    }
    function close (saved) {
      m.classList.remove('open');
      set({ done: true, theme: saved ? chosen : (get().theme || 'system') });
    }
    m.addEventListener('click', e => {
      if (e.target === m) close(false);
      const b = e.target.closest('.aa-intro-theme');
      if (b) { chosen = b.dataset.theme; paintChoice(); applyTheme(chosen); return; }
      if (e.target.closest('[data-intro-skip]')) return close(false);
      if (e.target.closest('[data-intro-continue]')) { applyTheme(chosen); close(true); }
    });
    document.addEventListener('keydown', function onEsc (e) {
      if (e.key === 'Escape' && m.classList.contains('open')) {
        close(false); document.removeEventListener('keydown', onEsc);
      }
    });
  }

  function init () {
    killGold();
    const cur = (localStorage.getItem(THEME_KEY) || 'system').toLowerCase();
    applyTheme(cur);
    if (!get().done) setTimeout(() => open(false), 350);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  killGold();

  window.AA = window.AA || {};
  window.AA.intro = { open: () => open(true), reset, applyTheme };
})();
