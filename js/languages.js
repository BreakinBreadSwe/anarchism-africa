/* ANARCHISM.AFRICA — African languages directory + picker
 *
 * Data source: data/african-languages.json (curated reference set covering
 * every African country, every major family, plus diaspora creoles).
 *
 * Public API:
 *   AA.languages.all()                      -> [{code, name, native, family, region, countries, ...}]
 *   AA.languages.byCode(code)               -> entry | null
 *   AA.languages.search(q)                  -> array (matches name/native/code/country)
 *   AA.languages.byRegion(regionId)         -> array
 *   AA.languages.byFamily(familyId)         -> array
 *   AA.languages.byCountry(iso2)            -> array
 *   AA.languages.regions()  / .families()   -> metadata arrays
 *   AA.languages.renderDirectory()          -> HTML string of the full directory
 *   AA.languages.openPicker(opts)           -> Promise<entry|null>   (modal picker)
 *
 * Browser data is fetched once and cached.
 */
(function () {
  let dataPromise = null;
  function load () {
    if (!dataPromise) {
      dataPromise = fetch('data/african-languages.json', { cache: 'force-cache' })
        .then(r => r.ok ? r.json() : { languages: [], regions: [], families: [] })
        .catch(() => ({ languages: [], regions: [], families: [] }));
    }
    return dataPromise;
  }

  const norm = s => (s || '').toLowerCase();

  const API = {
    async all ()       { return (await load()).languages || []; },
    async regions ()   { return (await load()).regions   || []; },
    async families ()  { return (await load()).families  || []; },
    async byCode (c)   { return (await API.all()).find(x => x.code === c) || null; },
    async byRegion (r) { return (await API.all()).filter(x => x.region === r); },
    async byFamily (f) { return (await API.all()).filter(x => x.family === f); },
    async byCountry (iso2) {
      const u = (iso2 || '').toUpperCase();
      return (await API.all()).filter(x => Array.isArray(x.countries) && x.countries.includes(u));
    },
    async search (q) {
      const f = norm(q).trim();
      const list = await API.all();
      if (!f) return list;
      return list.filter(x =>
        norm(x.name).includes(f) ||
        norm(x.native).includes(f) ||
        norm(x.code).includes(f) ||
        (x.countries || []).some(c => norm(c).includes(f)) ||
        norm(x.family).includes(f) ||
        norm(x.subfamily || '').includes(f) ||
        norm(x.script || '').includes(f)
      );
    },
    async renderDirectory () {
      const data = await load();
      const langs    = data.languages || [];
      const regions  = data.regions   || [];
      const families = data.families  || [];
      const total    = langs.length;
      return `
        <div class="panel" style="margin-bottom:14px">
          <h2 style="margin:0 0 6px">African languages — directory</h2>
          <p style="color:var(--fg-dim);max-width:65ch;margin:0 0 10px">
            ${total}+ languages across ${regions.length} regions and ${families.length} families,
            plus diaspora creoles. Search by name, native autonym, country, family or script.
            Speaker counts are approximations — verify before citation.
          </p>
          <input id="lang-search" type="search" placeholder="Search — try 'wolof', 'kenya', 'bantu', 'arabic', 'kreyòl'…"
            style="width:100%;padding:12px 16px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit;font-size:1rem"/>
          <div id="lang-filter-row" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
            <button class="lang-chip active" data-filter="all" data-kind="all">All</button>
            ${regions.map(r => `<button class="lang-chip" data-filter="region:${r.id}">${r.label}</button>`).join('')}
            ${families.map(f => `<button class="lang-chip" data-filter="family:${f.id}">${f.label}</button>`).join('')}
          </div>
        </div>
        <div id="lang-grid" class="lang-grid"></div>
      `;
    },
    openPicker (opts = {}) {
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal open';
        overlay.id = 'lang-picker';
        overlay.innerHTML = `
          <div class="panel" style="max-width:760px;width:calc(100% - 32px);max-height:86vh;display:flex;flex-direction:column">
            <div style="padding:16px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">
              <input id="lang-pick-q" placeholder="${opts.placeholder || 'Pick a language…'}" style="flex:1;padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/>
              <button class="btn ghost" id="lang-pick-close">Close</button>
            </div>
            <div id="lang-pick-results" style="flex:1;overflow-y:auto;padding:10px"></div>
          </div>`;
        document.body.appendChild(overlay);
        const close = (val) => { overlay.remove(); resolve(val || null); };
        overlay.querySelector('#lang-pick-close').addEventListener('click', () => close(null));
        overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
        const input = overlay.querySelector('#lang-pick-q');
        const out   = overlay.querySelector('#lang-pick-results');
        async function paint (q) {
          const list = await API.search(q);
          out.innerHTML = list.length
            ? list.map(l => `
                <div class="lang-pick-row" data-code="${l.code}">
                  <div style="flex:1;min-width:0">
                    <b>${l.name}</b>
                    <span style="color:var(--fg-dim);margin-left:6px">${l.native || ''}</span>
                    <div class="mono" style="font-size:.7rem;color:var(--muted)">${l.code} · ${l.family}${l.subfamily ? ' / ' + l.subfamily : ''} · ${(l.countries||[]).join(' ')}</div>
                  </div>
                  <button class="btn primary" data-pick>Pick</button>
                </div>`).join('')
            : '<div style="color:var(--muted);padding:20px;text-align:center">No matches.</div>';
        }
        out.addEventListener('click', e => {
          const row = e.target.closest('.lang-pick-row'); if (!row) return;
          if (e.target.closest('[data-pick]')) {
            API.byCode(row.dataset.code).then(close);
          }
        });
        input.addEventListener('input', () => paint(input.value));
        setTimeout(() => input.focus(), 50);
        paint('');
      });
    }
  };

  // Render the public-site Languages view: bind the search + filters once.
  function bindDirectoryView (root) {
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';
    let activeFilter = 'all';
    let activeQuery  = '';

    async function paintGrid () {
      const list = activeQuery ? await API.search(activeQuery) : await API.all();
      const filtered = list.filter(l => {
        if (activeFilter === 'all') return true;
        if (activeFilter.startsWith('region:'))  return l.region === activeFilter.slice(7);
        if (activeFilter.startsWith('family:'))  return l.family === activeFilter.slice(7);
        return true;
      });
      const grid = root.querySelector('#lang-grid');
      if (!grid) return;
      grid.innerHTML = filtered.length
        ? filtered.map(cardHTML).join('')
        : '<div class="panel" style="grid-column:1/-1;color:var(--muted)">No languages match.</div>';
    }
    function cardHTML (l) {
      return `
        <div class="lang-card" data-code="${l.code}">
          <div class="lang-card-head">
            <h3>${l.name}</h3>
            <span class="lang-native">${l.native || ''}</span>
          </div>
          <div class="lang-meta">${l.family}${l.subfamily ? ' / ' + l.subfamily : ''}</div>
          <div class="lang-meta">${(l.countries || []).join(' · ')}</div>
          <div class="lang-meta">${l.speakers ? l.speakers + ' speakers' : ''}${l.script ? ' · ' + l.script : ''}</div>
          ${l.notes ? `<p class="lang-note">${l.notes}</p>` : ''}
          ${(l.official_in || []).length ? `<div class="lang-official">official in: ${l.official_in.join(', ')}</div>` : ''}
        </div>`;
    }
    root.querySelector('#lang-search').addEventListener('input', e => {
      activeQuery = e.target.value;
      paintGrid();
    });
    root.querySelector('#lang-filter-row').addEventListener('click', e => {
      const b = e.target.closest('.lang-chip'); if (!b) return;
      root.querySelectorAll('.lang-chip').forEach(x => x.classList.toggle('active', x === b));
      activeFilter = b.dataset.filter;
      paintGrid();
    });
    paintGrid();
  }
  API.bindDirectoryView = bindDirectoryView;

  window.AA = window.AA || {};
  window.AA.languages = API;
})();
