/* ANARCHISM.AFRICA — Open Archive (text library)
 *
 * Fetches CC/public-domain texts from /api/text/list (Vercel Blob manifest)
 * and renders a searchable, filterable list below the curated book grid.
 *
 * Renders into:
 *   #tl-types    — type-filter chips
 *   #tl-meta     — "N texts · updated …" line
 *   #tl-list     — text rows
 *   #tl-search   — search input
 *   #tl-more     — load-more button
 */
(function () {
  'use strict';

  const PAGE_SIZE = 30;

  const TYPES = [
    { value: 'all',        label: 'All'         },
    { value: 'book',       label: 'Books'        },
    { value: 'pamphlet',   label: 'Pamphlets'    },
    { value: 'speech',     label: 'Speeches'     },
    { value: 'periodical', label: 'Periodicals'  },
    { value: 'thesis',     label: 'Theses'       },
  ];

  const TYPE_ICON = {
    book:       '📖',
    pamphlet:   '📄',
    speech:     '🎙',
    periodical: '📰',
    thesis:     '🎓',
  };

  let allTexts    = [];
  let filtered    = [];
  let page        = 0;
  let activeType  = 'all';
  let searchTerm  = '';

  // ── DOM ──────────────────────────────────────────────────────────────────────
  const $types    = document.getElementById('tl-types');
  const $meta     = document.getElementById('tl-meta');
  const $list     = document.getElementById('tl-list');
  const $search   = document.getElementById('tl-search');
  const $more     = document.getElementById('tl-more');

  if (!$list) return; // not on this page

  // ── Load ─────────────────────────────────────────────────────────────────────
  async function load () {
    $list.innerHTML = '<p style="color:var(--fg-dim);font-size:0.85rem">Loading open archive…</p>';
    try {
      const res  = await fetch('/api/text/list');
      const data = await res.json();
      allTexts = (data.texts || []).sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
      if ($meta) {
        const total = allTexts.length;
        $meta.textContent = `${total} open-access text${total !== 1 ? 's' : ''}${data.updated ? ' · updated ' + fmtDate(data.updated) : ''}`;
      }
    } catch (e) {
      allTexts = [];
      $list.innerHTML = '<p style="color:var(--fg-dim);font-size:0.85rem">Archive not yet seeded — check back after the next daily scrape.</p>';
      return;
    }
    buildTypeChips();
    applyFilters();
  }

  // ── Type chips ────────────────────────────────────────────────────────────────
  function buildTypeChips () {
    if (!$types) return;
    $types.innerHTML = '';
    TYPES.forEach(t => {
      const count = t.value === 'all' ? allTexts.length : allTexts.filter(x => x.type === t.value).length;
      if (count === 0 && t.value !== 'all') return;
      const btn = document.createElement('button');
      btn.className = 'sound-cat-pill' + (t.value === activeType ? ' active' : '');
      btn.textContent = `${t.label} (${count})`;
      btn.style.cssText = 'padding:4px 12px;border-radius:99px;border:1px solid var(--border);background:transparent;color:var(--fg);cursor:pointer;font-size:0.8rem;transition:background 0.15s';
      btn.onclick = () => { activeType = t.value; page = 0; buildTypeChips(); applyFilters(); };
      $types.appendChild(btn);
    });
  }

  // ── Filter & render ───────────────────────────────────────────────────────────
  function applyFilters () {
    filtered = allTexts.filter(t => {
      if (activeType !== 'all' && t.type !== activeType) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          (t.title  || '').toLowerCase().includes(q) ||
          (t.author || '').toLowerCase().includes(q) ||
          (t.tags   || []).some(tag => tag.includes(q))
        );
      }
      return true;
    });
    page = 0;
    renderPage(true);
  }

  function renderPage (reset = false) {
    if (reset) $list.innerHTML = '';

    const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    if (slice.length === 0 && filtered.length === 0) {
      $list.innerHTML = '<p style="color:var(--fg-dim);font-size:0.85rem">No texts match.</p>';
      if ($more) $more.hidden = true;
      return;
    }

    slice.forEach(t => $list.appendChild(textRow(t)));

    const shown = (page + 1) * PAGE_SIZE;
    if ($more) $more.hidden = shown >= filtered.length;
  }

  function textRow (t) {
    const row = document.createElement('div');
    row.className = 'vault-row';
    row.style.cssText = 'display:flex;align-items:flex-start;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)';

    const icon = TYPE_ICON[t.type] || '📄';
    const year = t.year ? ` · ${t.year}` : '';
    const lang = t.language && t.language !== 'en' ? ` · ${t.language.toUpperCase()}` : '';
    const lic  = t.license ? `<span style="font-size:0.72rem;padding:2px 6px;border:1px solid var(--border);border-radius:4px;color:var(--fg-dim)">${t.license}</span>` : '';
    const tags = (t.tags || []).slice(0, 4).map(tag =>
      `<span style="font-size:0.7rem;color:var(--fg-dim);padding:1px 5px;border:1px solid var(--border);border-radius:3px">${tag}</span>`
    ).join('');

    const pdfBtn  = t.pdf  ? `<a href="${t.pdf}"  target="_blank" rel="noopener" style="font-size:0.78rem;padding:4px 10px;border:1px solid var(--border);border-radius:5px;color:var(--fg);text-decoration:none">↓ PDF</a>`  : '';
    const epubBtn = t.epub ? `<a href="${t.epub}" target="_blank" rel="noopener" style="font-size:0.78rem;padding:4px 10px;border:1px solid var(--border);border-radius:5px;color:var(--fg);text-decoration:none">↓ EPUB</a>` : '';
    const readBtn = `<a href="${t.page}" target="_blank" rel="noopener" style="font-size:0.78rem;padding:4px 10px;border:1px solid var(--border);border-radius:5px;color:var(--fg);text-decoration:none">↗ Archive</a>`;

    row.innerHTML = `
      <div style="font-size:1.6rem;line-height:1;padding-top:2px;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:0.92rem;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div>
        <div style="font-size:0.8rem;color:var(--fg-dim);margin-bottom:6px">${esc(t.author)}${year}${lang}</div>
        ${t.description ? `<p style="font-size:0.8rem;color:var(--fg-dim);margin:0 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(t.description)}</p>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${pdfBtn}${epubBtn}${readBtn}
          ${lic}
        </div>
        ${tags ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${tags}</div>` : ''}
      </div>`;

    return row;
  }

  // ── Utilities ──────────────────────────────────────────────────────────────────
  function esc (s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtDate (iso) {
    try { return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); }
    catch { return ''; }
  }

  // ── Events ────────────────────────────────────────────────────────────────────
  if ($search) {
    $search.addEventListener('input', () => {
      searchTerm = $search.value.trim();
      page = 0;
      applyFilters();
    });
  }

  if ($more) {
    $more.addEventListener('click', () => {
      page++;
      renderPage(false);
    });
  }

  // ── Boot — wait for books view to become active, then load once ───────────────
  let loaded = false;
  function maybeLoad () {
    if (loaded) return;
    const sec = document.getElementById('view-books');
    if (sec && !sec.hidden && sec.offsetParent !== null) {
      loaded = true;
      load();
    }
  }

  // Observe visibility changes on the section (tab switches)
  const target = document.getElementById('view-books');
  if (target) {
    const obs = new MutationObserver(maybeLoad);
    obs.observe(target, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  }

  // Also try on DOMContentLoaded and after a short delay
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeLoad);
  } else {
    maybeLoad();
  }
  setTimeout(maybeLoad, 1500);

})();
