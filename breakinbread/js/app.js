/* ════════════════════════════════════════════════════════
   BREAKIN BREAD — Free Cinema · SPA controller (vanilla JS)
   ════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const CATALOG = (window.BB_CATALOG || []).slice();
  const byId = Object.fromEntries(CATALOG.map(f => [f.id, f]));

  /* ── multi-source media layer (Archive · YouTube · Vimeo · link-out) ── */
  const SRC = {
    label: { archive: "Internet Archive", youtube: "YouTube", vimeo: "Vimeo", external: "the web" },
    poster(f) {
      if (f.poster) return f.poster;
      const s = f.source || {};
      if (s.kind === "archive") return `https://archive.org/services/img/${s.id}`;
      if (s.kind === "youtube") return `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`;
      return ""; // vimeo / external without poster → text fallback card
    },
    embed(f) {
      const s = f.source || {};
      if (s.kind === "archive") return `https://archive.org/embed/${s.id}`;
      if (s.kind === "youtube") return `https://www.youtube-nocookie.com/embed/${s.id}?rel=0&modestbranding=1&playsinline=1`;
      if (s.kind === "vimeo")   return `https://player.vimeo.com/video/${s.id}`;
      return ""; // external → no inline embed
    },
    embeddable(f) { const k = (f.source || {}).kind; return k === "archive" || k === "youtube" || k === "vimeo"; },
    url(f) {
      const s = f.source || {};
      if (s.kind === "archive")  return `https://archive.org/details/${s.id}`;
      if (s.kind === "youtube")  return `https://www.youtube.com/watch?v=${s.id}`;
      if (s.kind === "vimeo")    return `https://vimeo.com/${s.id}`;
      if (s.kind === "external") return s.url;
      return "#";
    },
    platform(f) { const s = f.source || {}; return s.kind === "external" ? (s.platform || "the web") : (this.label[s.kind] || "the web"); },
    rights(f)   { return (f.source || {}).kind === "archive" ? "Public domain" : "Free to watch"; },
    search(f)   { return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${f.title} ${f.year} full film`)}`; }
  };

  /* ── localStorage (watchlist + continue watching) ─────── */
  const STORE = {
    listKey: "bb.list", progKey: "bb.progress",
    list()        { try { return JSON.parse(localStorage.getItem(this.listKey)) || []; } catch { return []; } },
    inList(id)    { return this.list().includes(id); },
    toggle(id)    {
      const l = this.list(); const i = l.indexOf(id);
      i === -1 ? l.unshift(id) : l.splice(i, 1);
      localStorage.setItem(this.listKey, JSON.stringify(l));
      return i === -1;
    },
    progress()    { try { return JSON.parse(localStorage.getItem(this.progKey)) || {}; } catch { return {}; } },
    markPlayed(id){
      const p = this.progress();
      p[id] = { at: Date.now() };
      localStorage.setItem(this.progKey, JSON.stringify(p));
    },
    recent()      {
      const p = this.progress();
      return Object.keys(p).sort((a, b) => (p[b].at || 0) - (p[a].at || 0)).filter(id => byId[id]);
    }
  };

  /* ── tiny DOM helper ──────────────────────────────────── */
  const el = (tag, attrs = {}, html) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtRuntime = m => m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : "";

  /* ── genres ───────────────────────────────────────────── */
  const GENRES = (() => {
    const set = new Set();
    CATALOG.forEach(f => (f.genres || []).forEach(g => set.add(g)));
    return [...set].sort();
  })();

  /* ── languages (primary label, parentheticals stripped) ── */
  const langBase = f => String(f.language || "").replace(/\s*\(.*?\)\s*/g, "").trim() || "Other";
  CATALOG.forEach(f => { f._lang = langBase(f); });
  const LANGS = (() => {
    const count = {};
    CATALOG.forEach(f => { count[f._lang] = (count[f._lang] || 0) + 1; });
    return Object.keys(count).sort((a, b) => count[b] - count[a] || a.localeCompare(b))
      .map(name => ({ name, count: count[name] }));
  })();

  const PLAY_SVG  = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const PLUS_SVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 12 10 18 20 6"/></svg>';

  /* ── card ─────────────────────────────────────────────── */
  function card(f, opts = {}) {
    const c = el("article", { class: "bb-card", role: "button", tabindex: "0", "aria-label": `${f.title} (${f.year})` });
    const badge = f._lang ? `<span class="bb-card-badge">${esc(f._lang)}</span>` : "";
    const progress = opts.progress ? `<div class="bb-card-progress"><span style="width:100%"></span></div>` : "";
    const posterUrl = SRC.poster(f);
    const posterInner = posterUrl
      ? `<img src="${posterUrl}" alt="" loading="lazy" data-t="${esc(f.title)}" data-y="${f.year}" onerror="BB._posterFail(this)" />`
      : `<div class="bb-card-fallback-title">${esc(f.title)}</div><div class="bb-card-fallback-year">${f.year}</div>`;
    const sub = `${f.year} · ${esc(f.country || f.director)}`;
    c.innerHTML = `
      <div class="bb-card-poster${posterUrl ? "" : " is-fallback"}">
        ${posterInner}
        ${badge}
        <div class="bb-card-play">${PLAY_SVG}</div>
        ${progress}
      </div>
      <div class="bb-card-body">
        <h3 class="bb-card-title">${esc(f.title)}</h3>
        <p class="bb-card-sub">${sub}</p>
      </div>`;
    const open = () => location.hash = `#/film/${f.id}`;
    c.addEventListener("click", open);
    c.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    return c;
  }
  // poster fallback (referenced from inline onerror) — derives text from data-* attrs
  window.BB = window.BB || {};
  window.BB._posterFail = function (img) {
    const wrap = img.closest(".bb-card-poster");
    if (wrap) wrap.classList.add("is-fallback");
    const node = el("div", { html: `<div class="bb-card-fallback-title">${esc(img.dataset.t || "")}</div><div class="bb-card-fallback-year">${esc(img.dataset.y || "")}</div>` });
    img.replaceWith(node);
  };

  function rail(title, films, opts = {}) {
    const row = el("section", { class: "bb-row" });
    const head = el("div", { class: "bb-row-head" });
    head.innerHTML = `<h2 class="bb-row-title">${esc(title)}</h2><span class="bb-row-count">${films.length}</span>`;
    const track = el("div", { class: "bb-rail" });
    films.forEach(f => track.appendChild(card(f, opts)));
    row.append(head, track);
    return row;
  }

  /* ── views ────────────────────────────────────────────── */
  const main = document.getElementById("bbMain");

  function viewHome() {
    main.innerHTML = "";
    const featured = CATALOG.filter(f => f.featured);
    const pool = featured.filter(f => SRC.poster(f));   // prefer featured titles with artwork
    const hero = (pool.length ? pool : featured)[Math.floor(Math.random() * (pool.length || featured.length))] || CATALOG[0];
    main.appendChild(heroBlock(hero));

    const wrap = el("div", { class: "bb-section" });

    const recent = STORE.recent().map(id => byId[id]).slice(0, 12);
    if (recent.length) wrap.appendChild(rail("Continue Watching", recent, { progress: true }));

    const list = STORE.list().map(id => byId[id]).filter(Boolean);
    if (list.length) wrap.appendChild(rail("My List", list));

    wrap.appendChild(rail("Fresh from the Oven", CATALOG.filter(f => f.featured)));
    wrap.appendChild(langStrip());

    // a few marquee language rails (biggest collections first), then genre rails
    LANGS.filter(l => l.count >= 3).slice(0, 4).forEach(l => {
      wrap.appendChild(rail(`${l.name} Cinema`, CATALOG.filter(f => f._lang === l.name)));
    });
    GENRES.forEach(g => {
      const films = CATALOG.filter(f => (f.genres || []).includes(g));
      if (films.length) wrap.appendChild(rail(g, films));
    });
    main.appendChild(wrap);
    setActiveNav(null);
    window.scrollTo(0, 0);
  }

  // horizontal strip of language pills → language pages
  function langStrip() {
    const sec = el("section", { class: "bb-row" });
    sec.innerHTML = `<div class="bb-row-head"><h2 class="bb-row-title">Around the World</h2><span class="bb-row-count">${LANGS.length} languages</span></div>`;
    const bar = el("div", { class: "bb-langbar" });
    LANGS.forEach(l => {
      const a = el("a", { class: "bb-langpill", href: `#/lang/${encodeURIComponent(l.name)}` });
      a.innerHTML = `${esc(l.name)} <span class="bb-langpill-n">${l.count}</span>`;
      bar.appendChild(a);
    });
    sec.appendChild(bar);
    return sec;
  }

  function heroBlock(f) {
    const h = el("section", { class: "bb-hero" });
    const inList = STORE.inList(f.id);
    const heroPoster = SRC.poster(f);
    h.innerHTML = `
      <div class="bb-hero-bg">${heroPoster ? `<img src="${heroPoster}" alt="" />` : ""}</div>
      <div class="bb-hero-inner">
        <span class="bb-hero-kicker">Free · ${esc(f.country || "World cinema")}</span>
        <h1 class="bb-hero-title">${esc(f.title)}</h1>
        <div class="bb-hero-meta">
          <span>${f.year}</span><span class="dot"></span>
          <span>${esc(f._lang)}</span><span class="dot"></span>
          <span>${esc(f.director)}</span>
          ${f.runtime ? '<span class="dot"></span><span>' + fmtRuntime(f.runtime) + "</span>" : ""}
        </div>
        <p class="bb-hero-blurb">${esc(f.blurb)}</p>
        <div class="bb-hero-actions">
          <button class="bb-btn bb-btn--play" data-play>${PLAY_SVG} Watch free</button>
          <button class="bb-btn bb-btn--ghost" data-list aria-pressed="${inList}">
            ${inList ? CHECK_SVG + " In your list" : PLUS_SVG + " My list"}
          </button>
        </div>
      </div>`;
    h.querySelector("[data-play]").addEventListener("click", () => location.hash = `#/film/${f.id}`);
    h.querySelector("[data-list]").addEventListener("click", e => {
      const added = STORE.toggle(f.id);
      const b = e.currentTarget;
      b.setAttribute("aria-pressed", added);
      b.innerHTML = added ? CHECK_SVG + " In your list" : PLUS_SVG + " My list";
    });
    return h;
  }

  function viewGenre(genre) {
    main.innerHTML = "";
    const films = CATALOG.filter(f => (f.genres || []).includes(genre));
    main.appendChild(el("header", { class: "bb-grid-head" },
      `<div class="bb-grid-kicker">Genre</div><h1 class="bb-grid-h1">${esc(genre)}</h1>`));
    const grid = el("div", { class: "bb-grid" });
    films.forEach(f => grid.appendChild(card(f)));
    main.appendChild(grid);
    setActiveNav(genre);
    window.scrollTo(0, 0);
  }

  function viewLanguage(lang) {
    main.innerHTML = "";
    const films = CATALOG.filter(f => f._lang === lang);
    const countries = [...new Set(films.map(f => f.country))].join(" · ");
    main.appendChild(el("header", { class: "bb-grid-head" },
      `<div class="bb-grid-kicker">Language</div><h1 class="bb-grid-h1">${esc(lang)}</h1>` +
      (countries ? `<p class="bb-grid-note">${esc(countries)}</p>` : "")));
    if (!films.length) {
      main.appendChild(el("div", { class: "bb-empty" }, "<p>No films in this language yet.</p>"));
    } else {
      const grid = el("div", { class: "bb-grid" });
      films.forEach(f => grid.appendChild(card(f)));
      main.appendChild(grid);
    }
    setActiveNav(null);
    window.scrollTo(0, 0);
  }

  function viewList() {
    main.innerHTML = "";
    const films = STORE.list().map(id => byId[id]).filter(Boolean);
    main.appendChild(el("header", { class: "bb-grid-head" },
      `<div class="bb-grid-kicker">Saved</div><h1 class="bb-grid-h1">My List</h1>`));
    if (!films.length) {
      main.appendChild(el("div", { class: "bb-empty" },
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18l7-5 7 5V3z"/></svg><p>Nothing saved yet. Tap “My list” on any film to keep it here.</p>'));
    } else {
      const grid = el("div", { class: "bb-grid" });
      films.forEach(f => grid.appendChild(card(f)));
      main.appendChild(grid);
    }
    setActiveNav(null);
    window.scrollTo(0, 0);
  }

  /* ── film detail + player (modal) ─────────────────────── */
  const modal = document.getElementById("bbModal");
  const modalBody = document.getElementById("bbModalBody");

  function openFilm(id) {
    const f = byId[id];
    if (!f) { closeModal(); return; }
    const inList = STORE.inList(f.id);
    const embeddable = SRC.embeddable(f);
    const platform = SRC.platform(f);
    const posterUrl = SRC.poster(f);
    const posterBg = posterUrl
      ? `<img src="${posterUrl}" alt="" />`
      : `<div class="bb-player-fallback">${esc(f.title)}</div>`;
    const playLabel = embeddable ? "Play free" : `Watch on ${esc(platform)}`;
    const ctaLabel  = embeddable ? "Watch free" : `Watch on ${esc(platform)} ↗`;

    modalBody.innerHTML = `
      <div class="bb-player" id="bbPlayer">
        <a class="bb-player-poster" id="bbPlayerPoster" ${embeddable ? 'role="button" tabindex="0"' : `href="${SRC.url(f)}" target="_blank" rel="noopener"`} aria-label="Play ${esc(f.title)}">
          ${posterBg}
          <div class="bb-player-bigplay">
            <span class="ring">${PLAY_SVG}</span>
            <span class="label">${playLabel}</span>
          </div>
        </a>
      </div>
      <div class="bb-detail">
        <div class="bb-detail-badges">
          <span class="bb-chip bb-chip--free">★ Free to watch</span>
          <span class="bb-chip">${esc(SRC.rights(f))}</span>
          <span class="bb-chip bb-chip--lang">${esc(f._lang)}</span>
          ${f.country ? `<span class="bb-chip">${esc(f.country)}</span>` : ""}
          ${(f.genres || []).map(g => `<span class="bb-chip">${esc(g)}</span>`).join("")}
        </div>
        <h2 class="bb-detail-title" id="bbModalTitle">${esc(f.title)}</h2>
        <div class="bb-detail-meta">
          <span>${f.year}</span><span class="dot"></span>
          <span>Dir. ${esc(f.director)}</span>
          ${f.runtime ? '<span class="dot"></span><span>' + fmtRuntime(f.runtime) + "</span>" : ""}
        </div>
        <p class="bb-detail-blurb">${esc(f.blurb)}</p>
        <div class="bb-detail-actions">
          ${embeddable
            ? `<button class="bb-btn bb-btn--play" id="bbDetailPlay">${PLAY_SVG} ${ctaLabel}</button>`
            : `<a class="bb-btn bb-btn--play" href="${SRC.url(f)}" target="_blank" rel="noopener" id="bbDetailPlay">${PLAY_SVG} ${ctaLabel}</a>`}
          <button class="bb-btn bb-btn--ghost" id="bbDetailList" aria-pressed="${inList}">
            ${inList ? CHECK_SVG + " In your list" : PLUS_SVG + " My list"}
          </button>
        </div>
        <div class="bb-detail-tags">
          ${(f.tags || []).map(t => `<span class="bb-tag">#${esc(t)}</span>`).join("")}
        </div>
        <p class="bb-detail-source">
          Source: <strong>${esc(platform)}</strong> ·
          <a href="${SRC.url(f)}" target="_blank" rel="noopener">Open original ↗</a> ·
          <a href="${SRC.search(f)}" target="_blank" rel="noopener">Find more copies ↗</a>
        </p>
      </div>`;

    const startPlay = () => {
      const src = SRC.embed(f);
      if (!src) { window.open(SRC.url(f), "_blank", "noopener"); STORE.markPlayed(f.id); return; }
      const player = document.getElementById("bbPlayer");
      player.innerHTML = `<iframe src="${src}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
      STORE.markPlayed(f.id);
    };
    const poster = document.getElementById("bbPlayerPoster");
    if (embeddable) {
      poster.addEventListener("click", e => { e.preventDefault(); startPlay(); });
      poster.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startPlay(); } });
      document.getElementById("bbDetailPlay").addEventListener("click", () => {
        startPlay();
        document.getElementById("bbPlayer").scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } else {
      // link-out: just record that the user opened it
      poster.addEventListener("click", () => STORE.markPlayed(f.id));
      document.getElementById("bbDetailPlay").addEventListener("click", () => STORE.markPlayed(f.id));
    }
    document.getElementById("bbDetailList").addEventListener("click", e => {
      const added = STORE.toggle(f.id);
      e.currentTarget.setAttribute("aria-pressed", added);
      e.currentTarget.innerHTML = added ? CHECK_SVG + " In your list" : PLUS_SVG + " My list";
    });

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modalBody.parentElement.scrollTop = 0;
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    modalBody.innerHTML = "";
    document.body.style.overflow = "";
    if (location.hash.startsWith("#/film/")) history.replaceState(null, "", location.pathname + (homeHash() || ""));
  }
  let lastListHash = "#/";
  function homeHash() { return lastListHash; }

  modal.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => { closeModal(); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeSearch(); } });

  /* ── search ───────────────────────────────────────────── */
  const search = document.getElementById("bbSearch");
  const searchInput = document.getElementById("bbSearchInput");
  const searchResults = document.getElementById("bbSearchResults");

  function openSearch() { search.hidden = false; document.body.style.overflow = "hidden"; searchInput.value = ""; renderSearch(""); setTimeout(() => searchInput.focus(), 30); }
  function closeSearch() { if (search.hidden) return; search.hidden = true; document.body.style.overflow = ""; }
  function renderSearch(q) {
    q = q.trim().toLowerCase();
    let films = CATALOG;
    if (q) films = CATALOG.filter(f =>
      [f.title, f.director, f.language, f.country, (f.genres || []).join(" "), (f.tags || []).join(" "), String(f.year)]
        .join(" ").toLowerCase().includes(q));
    if (!films.length) { searchResults.innerHTML = `<p class="bb-search-empty">No films match “${esc(q)}”. Try a language, country, genre, director, or year.</p>`; return; }
    searchResults.innerHTML = "";
    const grid = el("div", { class: "bb-grid" });
    films.forEach(f => grid.appendChild(card(f)));
    searchResults.appendChild(grid);
  }
  document.getElementById("bbSearchBtn").addEventListener("click", openSearch);
  document.getElementById("bbSearchClose").addEventListener("click", closeSearch);
  searchInput.addEventListener("input", e => renderSearch(e.target.value));
  searchResults.addEventListener("click", e => { if (e.target.closest(".bb-card")) closeSearch(); });
  document.getElementById("bbListBtn").addEventListener("click", () => location.hash = "#/list");

  /* ── nav ──────────────────────────────────────────────── */
  const nav = document.getElementById("bbNav");
  nav.innerHTML = `<a href="#/">Home</a>` + GENRES.map(g => `<a href="#/genre/${encodeURIComponent(g)}">${esc(g)}</a>`).join("");
  function setActiveNav(genre) {
    nav.querySelectorAll("a").forEach(a => {
      const href = a.getAttribute("href");
      a.classList.toggle("active", genre ? href === `#/genre/${encodeURIComponent(genre)}` : href === "#/");
    });
  }

  /* ── header scroll state ──────────────────────────────── */
  const header = document.getElementById("bbHeader");
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { header.classList.toggle("scrolled", window.scrollY > 24); ticking = false; });
  }, { passive: true });

  /* ── router ───────────────────────────────────────────── */
  function route() {
    const h = location.hash || "#/";
    const filmMatch = h.match(/^#\/film\/(.+)$/);
    if (filmMatch) { openFilm(decodeURIComponent(filmMatch[1])); return; }
    closeModal();
    const genreMatch = h.match(/^#\/genre\/(.+)$/);
    if (genreMatch) { lastListHash = h; viewGenre(decodeURIComponent(genreMatch[1])); return; }
    const langMatch = h.match(/^#\/lang\/(.+)$/);
    if (langMatch) { lastListHash = h; viewLanguage(decodeURIComponent(langMatch[1])); return; }
    if (h === "#/list") { lastListHash = h; viewList(); return; }
    lastListHash = "#/"; viewHome();
  }
  window.addEventListener("hashchange", route);

  /* ── boot ─────────────────────────────────────────────── */
  route();

  /* ── service worker ───────────────────────────────────── */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  // expose minimal API for debugging
  window.BB.catalog = CATALOG;
  window.BB.go = id => location.hash = `#/film/${id}`;
})();
