/* ANARCHISM.AFRICA — afro-anarchist books search ("afro-anarchist Google" for books)
 *
 * Loads data/afro-books.json (57+ curated titles across 9 categories) and
 * exposes:
 *   AA.books.all()                  → array of all entries
 *   AA.books.search(q, category?)   → fuzzy match on title/author/summary
 *   AA.books.byCategory(id)         → filter by category id
 *   AA.books.categories()           → category metadata
 *   AA.books.buyLinks(book)         → array of {label,url} buy/find links
 *
 * Buy-links are deterministic search URLs across multiple sources so they
 * keep working when individual product pages move:
 *   - Bookshop.org (supports indie booksellers)
 *   - AK Press (worker-run publisher)
 *   - PM Press
 *   - Verso Books
 *   - Publisher's own search if known
 *   - OpenLibrary (free where in PD)
 *   - Internet Archive
 *   - Worldcat (find a library copy)
 */
(function () {
  let promise;
  function load () {
    if (!promise) {
      promise = fetch('data/afro-books.json', { cache: 'force-cache' })
        .then(r => r.ok ? r.json() : { books: [], categories: [] })
        .catch(() => ({ books: [], categories: [] }));
    }
    return promise;
  }
  const norm = s => (s || '').toLowerCase();
  const enc = s => encodeURIComponent(s || '');

  function buyLinks (b) {
    const q = (b.title || '') + ' ' + (b.author || '');
    const isbn = b.isbn || '';
    const links = [];
    if (b.publisher) {
      const pubMap = {
        'Verso': 'https://www.versobooks.com/search?q=',
        'Verso (2018 ed.)': 'https://www.versobooks.com/search?q=',
        'AK Press': 'https://www.akpress.org/catalogsearch/result/?q=',
        'PM Press': 'https://www.pmpress.org/index.php?l=search_query&search=',
        'Pluto Press': 'https://www.plutobooks.com/search/?search=',
        'Daraja Press / On Our Own Authority!': 'https://darajapress.com/?s=',
        'Duke University Press': 'https://www.dukeupress.edu/Search?type=All&q=',
        'Monthly Review Press': 'https://monthlyreview.org/?s=',
        'Seven Stories Press': 'https://sevenstories.com/search?q=',
        'Tor.com': 'https://www.tor.com/?s='
      };
      const found = Object.keys(pubMap).find(k => b.publisher.includes(k));
      if (found) links.push({ label: 'Publisher', url: pubMap[found] + enc(q) });
    }
    links.push({ label: 'AK Press',   url: 'https://www.akpress.org/catalogsearch/result/?q=' + enc(q) });
    links.push({ label: 'PM Press',   url: 'https://www.pmpress.org/index.php?l=search_query&search=' + enc(q) });
    links.push({ label: 'Verso',      url: 'https://www.versobooks.com/search?q=' + enc(q) });
    links.push({ label: 'Bookshop.org', url: 'https://bookshop.org/search?keywords=' + enc(q) });
    links.push({ label: 'OpenLibrary', url: 'https://openlibrary.org/search?q=' + enc(q) });
    links.push({ label: 'Archive.org', url: 'https://archive.org/search?query=' + enc(q) });
    links.push({ label: 'Worldcat',   url: 'https://search.worldcat.org/search?q=' + enc(q) });
    if (isbn) links.unshift({ label: 'By ISBN', url: 'https://search.worldcat.org/search?q=isbn%3A' + enc(isbn) });
    // de-dupe by label, keep first
    const seen = new Set();
    return links.filter(l => seen.has(l.label) ? false : (seen.add(l.label), true));
  }

  const API = {
    async all ()        { return (await load()).books || []; },
    async categories () { return (await load()).categories || []; },
    async byCategory (id) {
      const books = await API.all();
      return books.filter(b => b.category === id);
    },
    async search (q, category) {
      const f = norm(q).trim();
      let books = await API.all();
      if (category && category !== 'all') books = books.filter(b => b.category === category);
      if (!f) return books;
      return books.filter(b =>
        norm(b.title).includes(f) ||
        norm(b.author).includes(f) ||
        norm(b.summary).includes(f) ||
        norm(b.publisher).includes(f) ||
        String(b.year).includes(f) ||
        norm(b.category).includes(f)
      );
    },
    buyLinks,
    async renderView () {
      const data = await load();
      const books = data.books || [];
      const cats = data.categories || [];
      return `
        <div class="panel" style="margin-bottom:14px">
          <h2 style="margin:0 0 6px">Afro-anarchist books — find &amp; buy</h2>
          <p style="color:var(--fg-dim);max-width:65ch;margin:0 0 10px">
            ${books.length}+ titles across ${cats.length} categories — anarchism, decolonial theory,
            afrofuturism, afrofunk, afropunk, art, abolition, feminism, science. Every entry links
            to multiple sources (publisher direct, AK Press, PM Press, Verso, Bookshop.org, OpenLibrary,
            Archive.org, Worldcat) so you can buy from the ethical seller closest to you.
          </p>
          <input id="abx-search" type="search" placeholder="Search title, author, year, theme…"
            style="width:100%;padding:12px 16px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit;font-size:1rem"/>
          <div id="abx-cats" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
            <button class="lang-chip active" data-cat="all">All</button>
            ${cats.map(c => `<button class="lang-chip" data-cat="${c.id}">${c.label}</button>`).join('')}
          </div>
        </div>
        <div id="abx-grid" class="abx-grid"></div>
      `;
    },
    async bindView (root) {
      if (!root || root.dataset.abxBound === '1') return;
      root.dataset.abxBound = '1';
      let cat = 'all';
      let q = '';
      async function paint () {
        const list = await API.search(q, cat);
        const grid = root.querySelector('#abx-grid');
        if (!grid) return;
        grid.innerHTML = list.length ? list.map(b => `
          <div class="abx-card" data-wish-id="${b.id}" data-wish-type="book">
            <div class="abx-head">
              <h3>${b.title.replace(/</g,'&lt;')}</h3>
              <div class="abx-meta">${b.author}${b.year?' &middot; '+b.year:''}${b.publisher?' &middot; '+b.publisher:''}</div>
            </div>
            <p class="abx-summary">${(b.summary||'').replace(/</g,'&lt;')}</p>
            <div class="abx-buys">${API.buyLinks(b).map(l =>
              `<a class="abx-buy" href="${l.url}" target="_blank" rel="noopener nofollow">${l.label} &rarr;</a>`).join('')}</div>
          </div>`).join('') : '<div class="panel" style="grid-column:1/-1;color:var(--muted)">No books match.</div>';
      }
      root.querySelector('#abx-search').addEventListener('input', e => { q = e.target.value; paint(); });
      root.querySelector('#abx-cats').addEventListener('click', e => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        root.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('active', x === b));
        cat = b.dataset.cat; paint();
      });
      paint();
    }
  };
  window.AA = window.AA || {};
  window.AA.books = API;
})();
