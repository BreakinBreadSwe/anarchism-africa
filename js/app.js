/* ANARCHISM.AFRICA — front-end controller (single-page app)
 * Tabs, hero slideshow (mixed media types), grids, modal, chat, role strip.
 */
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    tab: 'home',
    hero: [],
    heroIndex: 0,
    heroTimer: null,
    heroPlaying: true,
    chatHistory: []
  };

  // ---- tabs / rail / bottombar ------------------------------------------
  function setTab (name) {
    state.tab = name;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.rail-item').forEach(r => r.classList.toggle('active', r.dataset.tab === name));
    // sync bottombar active highlight for tabs that map to a footer button
    const tabToBbar = { home: 'home', films: 'films', articles: 'library', merch: 'merch' };
    const wanted = tabToBbar[name] || null;
    $$('.bottombar [data-bbar]').forEach(b => b.classList.toggle('active', wanted && b.dataset.bbar === wanted));
    $$('section.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    location.hash = name;
    // close mobile rail drawer after navigation
    if (matchMedia('(max-width: 768px)').matches) closeRail();
    // close the chat panel whenever the user navigates to a section
    document.getElementById('chat-panel')?.classList.remove('open');
  }

  $('#tabs')?.addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) setTab(t.dataset.tab);
  });
  // left rail
  const rail = $('#rail');
  function openRail ()  { rail?.classList.add('expanded'); document.body.classList.add('rail-open'); }
  function closeRail () { rail?.classList.remove('expanded'); document.body.classList.remove('rail-open'); }
  function toggleRail () { rail?.classList.contains('expanded') ? closeRail() : openRail(); }
  $('#menu-toggle')?.addEventListener('click', toggleRail);
  $('#rail-backdrop')?.addEventListener('click', closeRail);
  rail?.addEventListener('click', e => {
    const r = e.target.closest('.rail-item');
    // Only navigate if the rail item maps to a tab. Auth, logo lab, install,
    // studio anchor and the menu-toggle have their own handlers — don't blow
    // away the current view by calling setTab(undefined) on those.
    if (r && r.dataset.tab) { setTab(r.dataset.tab); renderTab(r.dataset.tab); }
  });
  // bottombar
  $('#bottombar')?.addEventListener('click', e => {
    const b = e.target.closest('[data-bbar]'); if (!b) return;
    const k = b.dataset.bbar;
    // Mark the current button active so the visual state matches what the
    // user just tapped (other handlers may set their own active state too).
    $$('#bottombar [data-bbar]').forEach(x => x.classList.toggle('active', x === b));

    if (k === 'home')     { setTab('home'); return; }
    if (k === 'films')    { setTab('films'); renderTab('films'); return; }
    if (k === 'library')  { setTab('articles'); renderTab('articles'); return; }
    if (k === 'search')   { openSearch(); return; }
    if (k === 'merch')    { setTab('merch'); renderTab('merch'); return; }
    if (k === 'chat')     { (window.AA_CHAT?.open || window.AA?.chat?.open || (() => alert('A.A.AI chat is loading...')))(); return; }
    if (k === 'customize') {
      const sheet = $('#customize-sheet');
      if (sheet) { sheet.classList.add('open'); buildCustomize(); return; }
      // Fallback: theme toggle if the customize sheet isn't on this page
      if (window.AA?.theme?.cycle) window.AA.theme.cycle();
      return;
    }
    if (k === 'signin')   {
      // Bottombar "You" icon - open Sign-in sheet, or offer sign-out if signed in
      if (window.AA?.auth) {
        if (window.AA.auth.signedIn && window.AA.auth.signedIn()) {
          if (confirm('Sign out?')) window.AA.auth.signOut();
        } else {
          window.AA.auth.openSheet();
        }
      } else {
        toggleRoleStrip();   // legacy fallback
      }
      return;
    }
    // 'menu' is handled by js/menu-behavior.js (capture phase) - no-op here
  });
  document.addEventListener('click', e => {
    const j = e.target.closest('[data-jump]');
    if (j) setTab(j.dataset.jump);
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#', '');
    if (h && document.getElementById('view-' + h)) setTab(h);
  });

  // ---- hero slideshow ----------------------------------------------------
  function buildHeroDom (items) {
    const hero = $('#hero');
    // remove any existing slides (keep progress + controls children)
    $$('#hero .slide').forEach(s => s.remove());
    items.forEach((it, i) => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.idx = i;
      const media = it.video
        ? `<video src="${it.video}" muted playsinline loop autoplay preload="metadata"></video>`
        : `<img src="${it.image}" alt="${it.title}">`;
      const audio = it.audio ? `<audio src="${it.audio}" preload="metadata"></audio>` : '';
      // Songs get a direct "▶ Play" CTA that fires the footer player immediately.
      // All other types get the standard "Open" tab-switch CTA.
      const isSong = it.type === 'song' && it.audio;
      const primaryCta = isSong
        ? `<button class="btn primary" data-hero-play="${it.id}">▶ Play</button>`
        : `<button class="btn primary" data-hero-go="${it.tab}">Open ${typeLabel(it.type)}</button>`;
      slide.innerHTML = `
        ${media}${audio}
        <div class="hero-overlay">
          <div class="hero-kicker"><span class="dot"></span> ${typeLabel(it.type)} · live</div>
          <h1>${it.title}</h1>
          <p class="hero-sub">${it.summary || it.subtitle || ''}</p>
          <div class="hero-cta">
            ${primaryCta}
            <button class="btn ghost" data-hero-detail="${it.id}">Details</button>
          </div>
        </div>`;
      hero.insertBefore(slide, $('#hero-progress'));
    });
    // progress bars
    const prog = $('#hero-progress');
    prog.innerHTML = items.map(() => '<span></span>').join('');
  }

  function typeLabel (t) {
    return ({ film: 'Film', article: 'Article', event: 'Event',
              song: 'Song', book: 'Book', merch: 'Object' })[t] || t;
  }

  function showHero (idx) {
    const slides = $$('#hero .slide');
    if (!slides.length) return;
    state.heroIndex = (idx + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === state.heroIndex));
    const bars = $$('#hero-progress span');
    bars.forEach((b, i) => {
      b.classList.toggle('active', i === state.heroIndex);
      b.classList.toggle('done',   i <  state.heroIndex);
    });
    bars.forEach(b => {
      const inner = b; // re-trigger CSS animation by clone-replace
      const c = inner.cloneNode(true);
      inner.parentNode.replaceChild(c, inner);
    });
    // re-apply class on the active bar after the swap
    requestAnimationFrame(() => {
      const fresh = $$('#hero-progress span');
      fresh.forEach((b, i) => {
        b.classList.toggle('active', i === state.heroIndex);
        b.classList.toggle('done',   i <  state.heroIndex);
      });
    });
  }

  function startHero () {
    stopHero();
    if (!state.heroPlaying) return;
    const interval = (window.AA_CONFIG?.hero?.interval_ms) || 7000;
    document.documentElement.style.setProperty('--interval', interval + 'ms');
    state.heroTimer = setInterval(() => showHero(state.heroIndex + 1), interval);
  }
  function stopHero () { clearInterval(state.heroTimer); state.heroTimer = null; }

  $('#hero-prev')?.addEventListener('click',  () => { showHero(state.heroIndex - 1); startHero(); });
  $('#hero-next')?.addEventListener('click',  () => { showHero(state.heroIndex + 1); startHero(); });

  // ── Hero mode toggle: random (default) ↔ newest first ─────────────────────
  // Persists in localStorage so the user's choice survives reloads.
  const SHUFFLE_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>';
  const NEWEST_SVG  = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
  function updateHeroModeBtn () {
    const btn = $('#hero-mode'); if (!btn) return;
    const isNewest = state.heroMode === 'newest';
    btn.innerHTML = isNewest ? NEWEST_SVG : SHUFFLE_SVG;
    btn.title = isNewest ? 'Newest first (click for random)' : 'Random across all (click for newest)';
    btn.setAttribute('aria-label', btn.title);
  }
  $('#hero-mode')?.addEventListener('click', async () => {
    state.heroMode = state.heroMode === 'newest' ? 'random' : 'newest';
    try { localStorage.setItem('aa-hero-mode', state.heroMode); } catch {}
    const hero = await AA.getHero(state.heroMode);
    state.hero = hero;
    buildHeroDom(hero);
    showHero(0);
    startHero();
    updateHeroModeBtn();
  });
  $('#hero-toggle')?.addEventListener('click', e => {
    state.heroPlaying = !state.heroPlaying;
    e.currentTarget.textContent = state.heroPlaying ? '⏸' : '▶';
    if (state.heroPlaying) startHero(); else stopHero();
  });

  // hero CTA delegation
  $('#hero')?.addEventListener('click', e => {
    const goTab    = e.target.dataset.heroGo;
    const playId   = e.target.dataset.heroPlay;
    const detailId = e.target.dataset.heroDetail;
    // ▶ Play — fire footer player directly for songs
    if (playId) {
      const item = state.hero.find(h => h.id === playId);
      if (item?.audio) { MP.play(item); return; }
    }
    if (goTab) { setTab(goTab); }
    if (detailId) {
      const item = state.hero.find(h => h.id === detailId);
      if (item) {
        const kind = item.tab || item.kind || (item.audio ? 'music' : item.video ? 'films' : 'articles');
        // Map plural section to singular type used by item.html
        const map = { films:'film', articles:'article', events:'event', music:'song', books:'book', merch:'merch', grants:'grant' };
        location.href = `item.html?type=${encodeURIComponent(map[kind] || kind)}&id=${encodeURIComponent(item.id)}`;
      }
    }
  });

  // ---- modal -------------------------------------------------------------
  const modal = $('#modal');
  const modalHead = $('#modal-head');
  const modalBody = $('#modal-body');
  $('#modal-close')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  function openModal (img, html) {
    modalHead.style.backgroundImage = `url(${img})`;
    modalBody.innerHTML = html;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal () {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    modalBody.innerHTML = '';
  }

  function openModalFromHero (it) {
    openModal(it.image, `
      <h2>${it.title}</h2>
      <p style="color:var(--fg-dim)">${it.subtitle || ''}</p>
      <p>${it.summary || ''}</p>
      ${it.video ? `<video controls style="width:100%;border-radius:12px;margin-top:12px" src="${it.video}"></video>` : ''}
      ${it.audio ? `<audio controls style="width:100%;margin-top:12px" src="${it.audio}"></audio>` : ''}
      <div class="row-flex" style="margin-top:14px"><button class="btn primary" data-jump="${it.tab}">Open in ${it.tab}</button></div>
    `);
  }

  function openFilm (f) {
    openModal(f.image, `
      <h2>${f.title}</h2>
      <p class="meta" style="color:var(--muted)">${f.director} · ${f.duration}min · ${f.language || ''}</p>
      <video controls autoplay style="width:100%;border-radius:12px;margin-top:8px" src="${f.embed}"></video>
      <p style="margin-top:12px">${f.summary}</p>
    `);
  }
  function openArticle (a) {
    const id = (a.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    openModal(a.image, `
      <h2>${a.title}</h2>
      <p class="meta" style="color:var(--muted)">${a.author||''}${a.year?' · '+a.year:''}${a.reading_time?' · '+a.reading_time+' min':''}${a.category?' · '+a.category:''}</p>
      ${a.deck ? `<p style="font-size:1.05rem;color:var(--fg-dim)">${a.deck}</p>` : ''}
      <div style="line-height:1.7;max-width:70ch">${(a.body || a.summary || '').replace(/\n\n/g, '</p><p>').replace(/^/, '<p>') + '</p>'}</div>
      <div class="row-flex" style="margin-top:18px">
        ${a.external_url ? `<a class="btn primary" href="${a.external_url}" target="_blank" rel="noopener">Open source ↗</a>` : ''}
        <button class="btn ghost" onclick="window.AA.wishlist?.add({id:'${id}', title:${JSON.stringify(a.title||'')}, image:'${a.image||''}'},'article')">♥ Save</button>
      </div>
    `);
  }
  function openEvent (ev) {
    const dt = new Date(ev.starts_at);
    const id = (ev.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    openModal(ev.image, `
      <h2>${ev.title}</h2>
      <p class="meta" style="color:var(--muted)">${dt.toLocaleString()} · ${ev.venue||''}, ${ev.city||''}</p>
      <p>${ev.summary || ''}</p>
      <div class="row-flex" style="margin-top:14px">
        <button class="btn primary" onclick="window.AA_LIVE.rsvp('${id}', this)">RSVP</button>
        <button class="btn ghost" onclick="window.AA_LIVE.calendar('${id}')">Add to calendar</button>
        ${ev.external_url ? `<a class="btn ghost" href="${ev.external_url}" target="_blank" rel="noopener">Event page ↗</a>` : ''}
      </div>
    `);
  }
  function openBook (b) {
    const id = (b.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    openModal(b.image, `
      <h2>${b.title}</h2>
      <p class="meta" style="color:var(--muted)">${b.author||''} · ${b.publisher||''}${b.pages?' · '+b.pages+'p':''}${b.year?' · '+b.year:''}</p>
      <p>${b.summary || ''}</p>
      ${b.body ? `<div style="margin-top:14px;line-height:1.7;max-width:70ch">${b.body.replace(/\n\n/g, '</p><p>').replace(/^/, '<p>') + '</p>'}</div>` : ''}
      <div class="row-flex" style="margin-top:14px">
        ${b.external_url ? `<a class="btn primary" href="${b.external_url}" target="_blank" rel="noopener">Read at publisher ↗</a>` : `<button class="btn primary" onclick="window.AA_LIVE.read('${id}', this)">Read full text</button>`}
        <button class="btn ghost" onclick="window.AA.wishlist?.add({id:'${id}', title:${JSON.stringify(b.title||'')}, image:'${b.image||''}'},'book')">♥ Save</button>
      </div>
    `);
  }
  function openMerch (m) {
    const id = (m.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    openModal(m.image, `
      <h2>${m.title}</h2>
      <p class="meta" style="color:var(--muted)">${m.provider||''} · ${(m.eco||[]).join(' · ')}</p>
      <p style="font-size:1.4rem;color:var(--accent);font-weight:700">${m.price_eur ? '€'+m.price_eur : ''}</p>
      <p>${m.summary || ''}</p>
      ${m.carbon_g ? `<p class="mono" style="color:var(--muted);font-size:.8rem">est. ${m.carbon_g}g CO₂ · printed-on-demand · ships in 5–8 days</p>` : ''}
      <div class="row-flex" style="margin-top:14px">
        ${m.external_url ? `<a class="btn primary" href="${m.external_url}" target="_blank" rel="noopener">Buy ↗</a>` : `<button class="btn primary" onclick="window.AA_LIVE.buy('${id}', this)">Order</button>`}
        <button class="btn ghost" onclick="window.AA.wishlist?.add({id:'${id}', title:${JSON.stringify(m.title||'')}, image:'${m.image||''}'},'merch')">♥ Save</button>
      </div>
    `);
  }

  // ---- card factory ------------------------------------------------------
  function card (it, kind) {
    const el = document.createElement('div');
    el.className = 'card' + (kind === 'merch' ? ' merch-card' : '');
    // Universal wishlist hooks — js/wishlist.js will inject a heart toggle.
    if (it && it.id) {
      el.dataset.wishId   = it.id;
      el.dataset.wishType = kind;
      try {
        el.dataset.wishItem = JSON.stringify({
          id: it.id, title: it.title, image: it.image,
          summary: it.summary, kind
        });
      } catch {}
    }
    el.innerHTML = `
      <div class="thumb" style="background-image:url(${it.image})"><span class="badge">${kind}</span></div>
      <div class="body">
        <h3>${it.title}</h3>
        <div class="meta">${secondaryLine(it, kind)}</div>
        ${it.summary ? `<p class="summary">${it.summary}</p>` : ''}
        ${kind === 'merch' ? merchBlock(it) : ''}
        ${sourceChip(it)}
      </div>`;
    return el;
  }
  function sourceChip (it) {
    const url  = it.source_url || it.url || it.external_url || '';
    const name = it.source || '';
    if (!name && !url) return '';
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    const logo = it.source_logo || (domain ? `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}` : '');
    const display = name || domain || url;
    const logoHtml = logo ? `<img src="${logo}" alt="" loading="lazy" onerror="this.style.display='none'">` : '';
    if (url) return `<div class="source-chip">${logoHtml}<a href="${url}" target="_blank" rel="noopener nofollow">${display}</a></div>`;
    return `<div class="source-chip">${logoHtml}<span>${display}</span></div>`;
  }
  function secondaryLine (it, kind) {
    const dateStr = fmtCardDate(it);
    if (kind === 'film')    return `${it.director || ''} · ${it.duration ? it.duration + 'min' : ''} · ${it.language || ''}`;
    if (kind === 'article') return `${it.author || ''} · ${it.reading_time ? it.reading_time + 'min' : ''} · ${dateStr}`;
    if (kind === 'event')   return `${it.starts_at ? new Date(it.starts_at).toLocaleDateString() : ''} · ${it.city || ''}`;
    if (kind === 'book')    return `${it.author || ''} · ${it.pages ? it.pages + 'p' : ''}`;
    if (kind === 'merch')   return `${it.provider || ''}`;
    return '';
  }
  function fmtCardDate (it) {
    const raw = it.published_at || it.scraped_at || it.created_at;
    if (raw) {
      try {
        return new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch {}
    }
    return it.year ? String(it.year) : '';
  }
  function archiveMonthKey (it) {
    const raw = it.published_at || it.scraped_at || it.created_at;
    if (raw) {
      try {
        const d = new Date(raw);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      } catch {}
    }
    return it.year ? `${it.year}-00` : '0000-00';
  }
  function archiveMonthLabel (key) {
    if (!key || key === '0000-00') return 'Archive';
    const [y, m] = key.split('-');
    if (m === '00') return y;
    try {
      return new Date(`${y}-${m}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } catch { return key; }
  }
  function merchBlock (m) {
    const carbonPct = Math.min(100, Math.round(m.carbon_g / 80));
    return `
      <div class="price"><strong>€${m.price_eur}</strong></div>
      <div class="eco-tags">${m.eco.map(t => `<span class="eco-tag">${t}</span>`).join('')}</div>
      <div class="carbon-bar"><i style="width:${carbonPct}%"></i></div>
      <div class="meta mono" style="font-size:.7rem;margin-top:4px">${m.carbon_g}g CO₂ · POD</div>`;
  }

  function attachCardClick (el, handler, item) {
    el.addEventListener('click', e => {
      // Wishlist heart inside the card stays interactive
      if (e.target.closest('.wish-heart')) return;
      // Cards ALWAYS open the full item page - no modals.
      const id   = el.dataset.wishId   || (item && item.id);
      const kind = el.dataset.wishType || (item && item.kind);
      if (id && kind) {
        location.href = `item.html?type=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
        return;
      }
      // No id? Fall back to a slug from the title so navigation still lands.
      if (item && (item.title || item.name)) {
        const slug = String(item.title || item.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
        const inferredKind = kind || (item.duration ? 'film' : item.audio ? 'song' : item.author ? 'book' : item.starts_at ? 'event' : 'article');
        location.href = `item.html?type=${encodeURIComponent(inferredKind)}&id=${encodeURIComponent(slug)}`;
      }
    });
  }

  // ---- render tabs -------------------------------------------------------
  function resetGrid (el) { el.innerHTML = ''; el.classList.add('grid', 'anim-stagger'); el.classList.remove('skeleton-grid'); }

  async function renderHome () {
    const heroMode = (() => {
      try { const v = localStorage.getItem('aa-hero-mode'); return v === 'newest' ? 'newest' : 'random'; }
      catch { return 'random'; }
    })();
    state.heroMode = heroMode;
    const hero = await AA.getHero(heroMode);
    state.hero = hero;
    buildHeroDom(hero);
    showHero(0);
    startHero();
    updateHeroModeBtn();

    const featured = $('#featured-grid'); resetGrid(featured);
    const films = sortNewestFirst(await AA.getByType('film'));
    films.forEach(f => { const c = card(f, 'film'); attachCardClick(c, openFilm, f); featured.appendChild(c); });
    const events = sortNewestFirst(await AA.getByType('event'));
    events.slice(0, 3).forEach(e => { const c = card(e, 'event'); attachCardClick(c, openEvent, e); featured.appendChild(c); });

    const lib = $('#library-grid'); resetGrid(lib);
    const articles = sortNewestFirst(await AA.getByType('article'));
    articles.forEach(a => { const c = card(a, 'article'); attachCardClick(c, openArticle, a); lib.appendChild(c); });
  }

  /* Sort by acquisition recency. scraped_at wins so freshly scraped items
     always lead grids; published_at + year fallback when scraped_at is missing
     (e.g. seed items). Stable for items that share the same timestamp. */
  function sortNewestFirst (arr) {
    if (!Array.isArray(arr)) return [];
    const ts = (x) => {
      const s = Date.parse(x.scraped_at || x.published_at || x.created_at || '');
      if (!isNaN(s)) return s;
      if (x.year) { const y = Date.parse(String(x.year) + '-12-31'); return isNaN(y) ? 0 : y; }
      return 0;
    };
    return arr.slice().sort((a, b) => ts(b) - ts(a));
  }

  async function renderTab (tab) {
    if (tab === 'films') {
      const g = $('#films-grid'); resetGrid(g);
      sortNewestFirst(await AA.getByType('film')).forEach(f => { const c = card(f,'film'); attachCardClick(c, openFilm, f); g.appendChild(c); });
    }
    if (tab === 'articles') {
      const g = $('#articles-grid'); resetGrid(g);
      const arts = await AA.getByType('article');
      // Sort newest first, group by month with archive headers
      arts.sort((a, b) => {
        const da = a.published_at || a.scraped_at || (a.year ? a.year + '-01-01' : '');
        const db = b.published_at || b.scraped_at || (b.year ? b.year + '-01-01' : '');
        return da > db ? -1 : da < db ? 1 : 0;
      });
      let lastMonth = null;
      arts.forEach(a => {
        const mk = archiveMonthKey(a);
        if (mk !== lastMonth) {
          const h = document.createElement('div');
          h.className = 'archive-month-head';
          h.innerHTML = `<span class="kente-pip"></span><span>${archiveMonthLabel(mk)}</span>`;
          g.appendChild(h);
          lastMonth = mk;
        }
        const c = card(a, 'article'); attachCardClick(c, openArticle, a); g.appendChild(c);
      });
    }
    if (tab === 'events') {
      const g = $('#events-grid'); resetGrid(g);
      sortNewestFirst(await AA.getByType('event')).forEach(e => { const c = card(e,'event'); attachCardClick(c, openEvent, e); g.appendChild(c); });
    }
    if (tab === 'music') {
      // ── A.A. Radio: curated live streams ─────────────────────────────────
      // Streams verified 2026-05. audio=null means stream is HTTP-only (browser
      // blocks mixed content on HTTPS pages); those stations get a page link instead.
      const RADIO_STATIONS = [
        { id: 'rs-nts-1',   title: 'NTS Radio 1',              artist: 'London · LA · Shanghai',           audio: 'https://stream-relay-geo.ntslive.net/stream',                             summary: 'Independent community radio. African diaspora, afrofuturist and experimental music around the clock.',        isLive: true },
        { id: 'rs-nts-2',   title: 'NTS Radio 2',              artist: 'NTS · Alternative Stream',          audio: 'https://stream-relay-geo.ntslive.net/stream2',                            summary: 'Second channel — often carries African, Afro-futurist and underground programming from the global south.',    isLive: true },
        { id: 'rs-kpfa',    title: 'KPFA 94.1 FM',             artist: 'Pacifica Network · Berkeley CA',    audio: 'https://streams.kpfa.org/kpfa_128.aac',                                  summary: 'Community-funded, ad-free radical broadcasting. African diaspora, liberation and anti-imperialist politics.', isLive: true },
        { id: 'rs-wbai',    title: 'WBAI 99.5 FM',             artist: 'Pacifica Network · New York City',  audio: null, page: 'https://wbai.org/listen-live/',                              summary: 'NYC Pacifica station. Pan-African, abolitionist and anti-imperialist programming since 1960.',               isLive: true },
        { id: 'rs-resonance', title: 'Resonance FM',           artist: 'Independent · London',              audio: 'https://stream.resonance.fm/resonance',                                  summary: 'Radical arts, experimental music and political commentary from London\'s independent broadcaster.',           isLive: true },
        { id: 'rs-pass',    title: 'Pan African Space Station', artist: 'PASS · Johannesburg',               audio: 'https://pass.out.airtime.pro/pass_a',                                    summary: 'Afrofuturist broadcast collective from Johannesburg — music, sound art and politics from across the continent.', isLive: true },
        { id: 'rs-bbc-af',  title: 'BBC World Service Africa', artist: 'BBC · West Africa',                 audio: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service_west_africa',     summary: 'Africa-focused international news, current affairs and culture from the BBC World Service.',                  isLive: true },
        { id: 'rs-worldwide', title: 'Worldwide FM',           artist: 'Gilles Peterson · Global',          audio: 'https://worldwide-fm.radiocult.fm/stream',                                summary: 'African, Caribbean and diaspora sounds. Deep digs into African jazz, Afrobeat and global underground music.',  isLive: true },
        { id: 'rs-afrique', title: 'Radio Afrique',            artist: 'Continental · Multilingual',        audio: null, page: 'https://radioafrique.com/',                                   summary: 'Pan-African multilingual broadcaster — news, culture and music from across the continent.',                   isLive: true },
      ];

      const stEl = $('#radio-stations');
      if (stEl && !stEl.dataset.rendered) {
        stEl.dataset.rendered = '1';
        const head = document.createElement('div');
        head.className = 'radio-section-head';
        head.innerHTML = '<span class="radio-live-dot"></span> A.A. Radio — Live Streams';
        stEl.appendChild(head);
        const grid = document.createElement('div');
        grid.className = 'radio-stations-grid';
        RADIO_STATIONS.forEach(s => {
          const c = document.createElement('div');
          // Stations without an embeddable audio URL get a page-link style
          const isPageOnly = !s.audio && s.page;
          c.className = 'radio-station-card' + (isPageOnly ? ' page-only' : '');
          c.dataset.stationId = s.id;
          const pill = isPageOnly
            ? `<div class="radio-live-pill page-link-pill">OPEN ↗</div>`
            : `<div class="radio-live-pill"><div class="radio-live-dot"></div>LIVE</div>`;
          c.innerHTML = `
            <div class="radio-station-name">${s.title}</div>
            <div class="radio-station-meta mono">${s.artist}</div>
            <div class="radio-station-desc">${s.summary}</div>
            ${pill}`;
          c.addEventListener('click', () => {
            if (isPageOnly) {
              // Can't embed — open the station's website in a new tab
              window.open(s.page, '_blank', 'noopener');
              return;
            }
            stEl.querySelectorAll('.radio-station-card').forEach(x => x.classList.remove('playing'));
            c.classList.add('playing');
            MP.play(s);
          });
          grid.appendChild(c);
        });
        stEl.appendChild(grid);
      }

      // ── Sound Vault: open-licensed archive tracks ─────────────────────────
      const vaultEl  = $('#sound-vault');
      const catsEl   = $('#sound-cats');
      const soundEl  = $('#sound-list');

      if (vaultEl && !vaultEl.dataset.rendered) {
        vaultEl.dataset.rendered = '1';

        const CATS = [
          { id: 'all',          label: 'All',           icon: '◎' },
          { id: 'music',        label: 'Music',         icon: '♪' },
          { id: 'spoken-word',  label: 'Spoken Word',   icon: '🎙' },
          { id: 'radio',        label: 'Radio',         icon: '📻' },
          { id: 'documentary',  label: 'Documentary',   icon: '🎞' },
          { id: 'field',        label: 'Field Rec.',    icon: '🌍' },
        ];

        let activeCat = 'all';
        let allVaultTracks = [];

        function renderVault (tracks) {
          soundEl.innerHTML = '';
          if (!tracks.length) {
            soundEl.innerHTML = '<p style="color:var(--muted);padding:16px 0">Vault is building — check back soon. The scraper runs daily.</p>';
            return;
          }
          const visible = tracks.slice(0, 80);
          const sectionHead = document.createElement('div');
          sectionHead.className = 'radio-section-head';
          sectionHead.style.marginBottom = '12px';
          sectionHead.innerHTML = `Sound Vault — Open Archive <span style="font-size:.72rem;color:var(--muted);font-family:var(--mono);font-weight:400;margin-left:8px">${tracks.length} recordings · CC licensed · Internet Archive</span>`;
          soundEl.appendChild(sectionHead);
          soundEl.classList.add('anim-stagger');
          visible.forEach(t => soundEl.appendChild(vaultRow(t)));
          if (tracks.length > 80) {
            const more = document.createElement('p');
            more.style.cssText = 'color:var(--muted);font-size:.82rem;padding:12px 0';
            more.textContent = `+ ${tracks.length - 80} more recordings in the vault.`;
            soundEl.appendChild(more);
          }
        }

        function filterAndRender () {
          const filtered = activeCat === 'all'
            ? allVaultTracks
            : allVaultTracks.filter(t => t.category === activeCat);
          renderVault(filtered);
          catsEl.querySelectorAll('.sound-cat-pill').forEach(p => {
            p.classList.toggle('active', p.dataset.cat === activeCat);
          });
        }

        // Build category pills
        CATS.forEach(cat => {
          const pill = document.createElement('button');
          pill.className = 'sound-cat-pill btn ghost' + (cat.id === 'all' ? ' active' : '');
          pill.dataset.cat = cat.id;
          pill.style.cssText = 'font-size:.72rem;padding:4px 12px;border-radius:99px';
          pill.textContent = `${cat.icon} ${cat.label}`;
          pill.addEventListener('click', () => { activeCat = cat.id; filterAndRender(); });
          catsEl.appendChild(pill);
        });

        // Load vault
        soundEl.innerHTML = '<p style="color:var(--muted);padding:12px 0;font-size:.85rem">Loading sound vault…</p>';
        try {
          const r = await fetch('/api/sound/list');
          const data = await r.json();
          allVaultTracks = data.tracks || [];
          filterAndRender();
        } catch {
          soundEl.innerHTML = '<p style="color:var(--muted);padding:12px 0">Could not load vault.</p>';
        }
      }

      // ── Uploaded / DB tracks (legacy Supabase songs) ──────────────────────
      const list = $('#music-list'); list.innerHTML = ''; list.classList.add('anim-stagger');
      const all = sortNewestFirst(await AA.getByType('song'));
      const playable = all.filter(s => s.audio && /^https?:\/\//i.test(s.audio));
      if (playable.length) {
        const tracksHead = document.createElement('div');
        tracksHead.className = 'radio-section-head';
        tracksHead.style.marginTop = '28px';
        tracksHead.innerHTML = 'Tracks &amp; Releases';
        list.appendChild(tracksHead);
        playable.forEach(s => list.appendChild(audioRow(s)));
      }
    }
    if (tab === 'books') {
      const g = $('#books-grid'); resetGrid(g);
      sortNewestFirst(await AA.getByType('book')).forEach(b => { const c = card(b,'book'); attachCardClick(c, openBook, b); g.appendChild(c); });
    }
    if (tab === 'merch') {
      const g = $('#merch-grid'); resetGrid(g);
      sortNewestFirst(await AA.getByType('merch')).forEach(m => { const c = card(m,'merch'); attachCardClick(c, openMerch, m); g.appendChild(c); });
    }
    if (tab === 'community')  renderCommunity();
    if (tab === 'ambassadors') renderAmb();
    if (tab === 'crowdfund')   renderCrowdfund();
    if (tab === 'archive') {
      window.Archive?.render();
      return;
    }
    if (tab === 'languages') {
      let host = document.getElementById('view-languages');
      if (!host) {
        host = document.createElement('section');
        host.className = 'view'; host.id = 'view-languages';
        // No inline padding — body.has-rail .view CSS handles the rail offset.
        document.querySelector('main, body').appendChild(host);
      }
      if (window.AA?.languages) {
        host.innerHTML = await window.AA.languages.renderDirectory();
        window.AA.languages.bindDirectoryView(host);
        // make this section the active one
        document.querySelectorAll('section.view').forEach(s => s.classList.toggle('active', s === host));
      }
    }
  }

  // -------- MINI PLAYER (sticky across tabs, full controls) --------------
  // Mini-player is now in js/mini-player.js (loaded before this script).
  // This alias keeps all existing MP.play(...) calls working unchanged.
  const MP = window.MP;

  // ---- DEAD CODE GUARD — the block below is superseded by mini-player.js
  //      but kept as fallback if mini-player.js fails to load.
  if (!MP) window.MP = (function () {
    let audio = null, current = null, queue = [], queueIndex = -1;
    const ui = {
      bar:    $('#mini-player'),
      art:    $('#mp-art'),
      prev:   $('#mp-prev'),
      play:   $('#mp-play'),
      next:   $('#mp-next'),
      title:  $('#mp-title'),
      artist: $('#mp-artist'),
      cur:    $('#mp-cur'),
      dur:    $('#mp-dur'),
      track:  $('#mp-track'),
      bar2:   $('#mp-bar'),
      buffer: $('#mp-buffer'),
      knob:   $('#mp-knob'),
      like:   $('#mp-like'),
      share:  $('#mp-share'),
      close:  $('#mp-close'),
      iconPlay:   document.querySelector('#mp-play .mp-icon-play'),
      iconPause:  document.querySelector('#mp-play .mp-icon-pause'),
      waveCanvas: document.getElementById('mp-waveform'),
      vuCanvas:   document.getElementById('mp-vu-canvas')
    };

    function fmt (s) {
      if (!Number.isFinite(s) || s < 0) return '0:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ':' + String(sec).padStart(2, '0');
    }

    // ---- waveform + VU meter ------------------------------------------
    let waveData = null;   // Float32Array of bar heights for current song
    let vuRAF    = null;   // requestAnimationFrame handle for VU loop

    function lcg (seed) {
      let s = ((seed ^ 0xdeadbeef) >>> 0) || 1;
      return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0xffffffff;
    }
    function buildWaveData (id) {
      const seed = id
        ? [...String(id)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7)
        : Date.now();
      const rng = lcg(seed >>> 0);
      const n   = 220;
      const d   = new Float32Array(n);
      for (let i = 0; i < n; i++)
        d[i] = Math.sin(i / n * Math.PI) * 0.65 + 0.12 + rng() * 0.48;
      const mx = Math.max(...d);
      for (let i = 0; i < n; i++) d[i] /= mx;
      return d;
    }
    function drawWaveform (playedPct) {
      const cv = ui.waveCanvas;
      if (!cv || !waveData) return;
      const W = cv.offsetWidth, H = cv.offsetHeight;
      if (!W || !H) return;
      if (cv.width !== W)  cv.width  = W;
      if (cv.height !== H) cv.height = H;
      const ctx    = cv.getContext('2d');
      const n      = waveData.length;
      const barW   = W / n;
      const gap    = Math.max(0.4, barW * 0.28);
      const accent = getComputedStyle(document.documentElement)
                       .getPropertyValue('--accent').trim() || '#e04000';
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const x    = i * barW;
        const barH = Math.max(2, waveData[i] * H * 0.84);
        const y    = (H - barH) / 2;
        ctx.fillStyle = (x / W) <= playedPct ? accent : 'rgba(255,255,255,0.17)';
        ctx.fillRect(x + gap / 2, Math.floor(y), Math.max(1, barW - gap), Math.ceil(barH));
      }
    }
    function drawVU () {
      const cv = ui.vuCanvas;
      if (!cv) return;
      const W = cv.offsetWidth || cv.parentElement?.offsetWidth || 0;
      const H = cv.offsetHeight || 12;
      if (!W) { vuRAF = requestAnimationFrame(drawVU); return; }
      if (cv.width !== W)  cv.width  = W;
      if (cv.height !== H) cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      let level = 0;
      if (audio && !audio.paused && audio.currentTime) {
        const t = audio.currentTime;
        level = 0.42
          + 0.24 * Math.sin(t *  7.3)
          + 0.15 * Math.sin(t * 14.7)
          + 0.08 * Math.sin(t *  3.2)
          + 0.07 * Math.sin(t * 29.1)
          + 0.04 * Math.sin(t * 61.3);
        level = Math.max(0.03, Math.min(1, level));
      }
      const stride = 4;
      const nSegs  = Math.floor(W / stride);
      const lit    = Math.floor(level * nSegs);
      for (let i = 0; i < nSegs; i++) {
        ctx.fillStyle = i < lit
          ? `hsl(${(120 - (i / nSegs) * 120).toFixed(0)},88%,52%)`
          : 'rgba(255,255,255,0.06)';
        ctx.fillRect(i * stride, 1, 3, H - 2);
      }
      vuRAF = requestAnimationFrame(drawVU);
    }
    function startVU () {
      if (vuRAF) cancelAnimationFrame(vuRAF);
      vuRAF = null;
      drawVU();
    }
    function stopVU () {
      if (vuRAF) { cancelAnimationFrame(vuRAF); vuRAF = null; }
      try { ui.waveCanvas?.getContext('2d')?.clearRect(0, 0, ui.waveCanvas.width, ui.waveCanvas.height); } catch {}
      try { ui.vuCanvas?.getContext('2d')?.clearRect(0, 0, ui.vuCanvas.width, ui.vuCanvas.height); } catch {}
    }

    function show () { ui.bar?.classList.add('show'); document.body.classList.add('mp-active'); }
    function hide () { ui.bar?.classList.remove('show'); document.body.classList.remove('mp-active'); }

    function setPlayingUI (playing) {
      if (!ui.play) return;
      ui.play.classList.toggle('playing', playing);
      if (ui.iconPlay)  ui.iconPlay.hidden  = playing;
      if (ui.iconPause) ui.iconPause.hidden = !playing;
      ui.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }

    function syncLike () {
      if (!ui.like || !current) return;
      const isOn = !!window.AA?.wishlist?.has?.(current.id, 'song');
      ui.like.classList.toggle('is-on', isOn);
      ui.like.setAttribute('aria-pressed', String(isOn));
    }

    function play (song, list) {
      if (Array.isArray(list)) {
        queue = list.slice();
        queueIndex = queue.findIndex(s => s.id === song.id);
      } else if (queueIndex < 0) {
        queue = [song];
        queueIndex = 0;
      }
      if (audio && current?.id === song.id) {
        if (audio.paused) audio.play(); else audio.pause();
        return;
      }
      if (audio) { audio.pause(); audio.src = ''; }
      audio = new Audio(song.audio);
      current = song;
      if (ui.title)  ui.title.textContent  = song.title;
      if (ui.artist) ui.artist.textContent = song.artist;
      if (ui.art)    ui.art.style.backgroundImage = song.image ? `url("${song.image}")` : '';
      if (ui.cur)    ui.cur.textContent = '0:00';
      if (ui.dur)    ui.dur.textContent = song.duration ? fmt(song.duration) : '0:00';
      if (ui.bar2)   ui.bar2.style.width = '0%';
      if (ui.knob)   ui.knob.style.left  = '0%';
      waveData = buildWaveData(song.id);
      drawWaveform(0);
      startVU();
      // Wire all events BEFORE calling play() so we never miss the 'play'
      // event that drives the icon. Icon starts in play-state (not pause)
      // and only flips to pause when audio actually begins.
      audio.addEventListener('play',  () => setPlayingUI(true));
      audio.addEventListener('pause', () => setPlayingUI(false));
      audio.addEventListener('loadedmetadata', () => {
        if (ui.dur) ui.dur.textContent = fmt(audio.duration);
      });
      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const pct = audio.currentTime / audio.duration * 100;
        if (ui.bar2) ui.bar2.style.width = pct + '%';
        if (ui.knob) ui.knob.style.left  = pct + '%';
        if (ui.cur)  ui.cur.textContent  = fmt(audio.currentTime);
        if (ui.track) ui.track.setAttribute('aria-valuenow', String(Math.round(pct)));
        drawWaveform(pct / 100);
      });
      audio.addEventListener('progress', () => {
        if (!audio.duration || !audio.buffered.length) return;
        const end = audio.buffered.end(audio.buffered.length - 1);
        if (ui.buffer) ui.buffer.style.width = (end / audio.duration * 100) + '%';
      });
      audio.addEventListener('ended', () => {
        if (queueIndex >= 0 && queueIndex < queue.length - 1) next();
        else { setPlayingUI(false); }
      });
      // If the audio URL 404s or refuses to play, surface a clear toast and
      // skip to the next track (or close the player if it's the only one).
      audio.addEventListener('error', () => {
        setPlayingUI(false);
        const msg = `"${song.title}" can't be played — track unavailable.`;
        try {
          const t = document.createElement('div');
          t.textContent = msg;
          t.style.cssText = 'position:fixed;left:50%;bottom:140px;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:10px 16px;font:600 .82rem JetBrains Mono,monospace;letter-spacing:.04em;z-index:10001;box-shadow:2px 2px 0 0 rgba(0,0,0,.25);max-width:80vw;text-align:center';
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 3500);
        } catch {}
        // Skip to next if there's a queue, otherwise stop
        if (queueIndex >= 0 && queueIndex < queue.length - 1) next();
        else { hide(); current = null; }
      });
      show();
      setPlayingUI(false);  // show play icon until browser confirms playback
      audio.play().catch(() => setPlayingUI(false));
      syncLike();
    }

    function next () {
      if (queueIndex < 0 || !queue.length) return;
      const i = (queueIndex + 1) % queue.length;
      queueIndex = i;
      play(queue[i]);
    }
    function prev () {
      if (queueIndex < 0 || !queue.length) return;
      // If we're more than 3 seconds into the track, restart instead of going back
      if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
      const i = (queueIndex - 1 + queue.length) % queue.length;
      queueIndex = i;
      play(queue[i]);
    }

    // ---- timeline scrubbing -------------------------------------------
    if (ui.track) {
      const seekFromEvent = e => {
        if (!audio || !audio.duration) return;
        const rect = ui.track.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        audio.currentTime = pct * audio.duration;
      };
      let dragging = false;
      ui.track.addEventListener('pointerdown', e => {
        dragging = true;
        ui.track.classList.add('scrubbing');
        try { ui.track.setPointerCapture(e.pointerId); } catch {}
        seekFromEvent(e);
      });
      ui.track.addEventListener('pointermove', e => { if (dragging) seekFromEvent(e); });
      ui.track.addEventListener('pointerup',   () => { dragging = false; ui.track.classList.remove('scrubbing'); });
      ui.track.addEventListener('pointercancel', () => { dragging = false; ui.track.classList.remove('scrubbing'); });
      // keyboard a11y
      ui.track.addEventListener('keydown', e => {
        if (!audio || !audio.duration) return;
        const step = e.shiftKey ? 10 : 5;
        if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + step); e.preventDefault(); }
        if (e.key === 'ArrowLeft')  { audio.currentTime = Math.max(0, audio.currentTime - step); e.preventDefault(); }
        if (e.key === ' ')          { (audio.paused ? audio.play() : audio.pause()); e.preventDefault(); }
      });
    }

    // ---- transport buttons --------------------------------------------
    ui.play?.addEventListener('click',  () => { if (audio) (audio.paused ? audio.play() : audio.pause()); });
    ui.next?.addEventListener('click',  next);
    ui.prev?.addEventListener('click',  prev);
    ui.close?.addEventListener('click', () => {
      audio?.pause();
      if (audio) { try { audio.src = ''; } catch {} }
      audio = null; current = null; queueIndex = -1; queue = [];
      waveData = null;
      stopVU();
      hide();
      setPlayingUI(false);
    });

    // ---- like (wishlist) ----------------------------------------------
    ui.like?.addEventListener('click', () => {
      if (!current) return;
      const W = window.AA?.wishlist;
      if (!W) return;
      if (W.has?.(current.id, 'song')) W.remove?.(current.id, 'song');
      else W.add?.({ id: current.id, title: current.title, image: current.image }, 'song');
      syncLike();
    });
    document.addEventListener('aa:wishlist:change', syncLike);

    // ---- share --------------------------------------------------------
    ui.share?.addEventListener('click', async () => {
      if (!current) return;
      const url = location.origin + '/item.html?type=song&id=' + encodeURIComponent(current.id);
      const data = { title: current.title, text: `${current.title} — ${current.artist}`, url };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(url); flashShareCopied(); }
      } catch {}
    });
    function flashShareCopied () {
      if (!ui.share) return;
      const old = ui.share.title;
      ui.share.title = 'Link copied!';
      ui.share.classList.add('is-on');
      setTimeout(() => { ui.share.title = old; ui.share.classList.remove('is-on'); }, 1400);
    }

    return {
      play,
      queue (list, startIndex = 0) {
        queue = list.slice();
        queueIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
        if (queue[queueIndex]) play(queue[queueIndex]);
      },
      next, prev,
      get current () { return current; }
    };
  })() || undefined; // end fallback block

  function audioRow (s) {
    const row = document.createElement('div');
    row.className = 'audio-row';
    row.innerHTML = `
      <button class="play">▶</button>
      <div class="info">
        <h3>${s.title}</h3>
        <div class="meta">${s.artist || ''}${s.duration ? ' · ' + Math.floor(s.duration/60) + ':' + String(s.duration%60).padStart(2,'0') : ''}</div>
      </div>`;
    const btn = row.querySelector('.play');
    btn.addEventListener('click', () => MP.play(s));
    return row;
  }

  // Vault row: richer card for open-archive tracks (Internet Archive etc.)
  function vaultRow (t) {
    const CAT_COLORS = {
      'music':       '#27ae60',
      'spoken-word': '#9b59b6',
      'radio':       '#2980b9',
      'documentary': '#e67e22',
      'field':       '#16a085',
    };
    const col = CAT_COLORS[t.category] || '#888';
    const licBadge = t.license
      ? `<span style="font-size:.65rem;padding:2px 6px;border-radius:4px;background:${col}22;color:${col};border:1px solid ${col}44;margin-left:6px">${t.license}</span>`
      : '';
    const yearTxt = t.year ? ` · ${t.year}` : '';

    const row = document.createElement('div');
    row.className = 'audio-row vault-row';
    row.innerHTML = `
      <img class="vault-art" src="${t.image || ''}" alt="" loading="lazy"
           onerror="this.closest('.vault-row').remove()"
           style="width:48px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0;background:var(--bg-2)"/>
      <button class="play" title="Play">▶</button>
      <div class="info" style="min-width:0;flex:1">
        <h3 style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title}</h3>
        <div class="meta" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">
          <span>${t.artist || 'Unknown'}${yearTxt}</span>
          ${licBadge}
        </div>
        ${t.description ? `<div class="vault-desc">${t.description.slice(0,120)}…</div>` : ''}
      </div>
      <a class="vault-src" href="${t.page || '#'}" target="_blank" rel="noopener noreferrer"
         title="View on Internet Archive" style="flex-shrink:0;opacity:.5;font-size:.75rem;color:var(--fg-dim);text-decoration:none">↗</a>`;
    row.querySelector('.play').addEventListener('click', () => {
      MP.play({ id: t.id, title: t.title, artist: t.artist || '', audio: t.audio, image: t.image });
    });
    return row;
  }

  // ---- community --------------------------------------------------------
  async function renderCommunity () {
    const list = $('#community-list'); list.innerHTML = '';
    const local  = await AA.getLocalPosts();
    const seeded = await AA.getCommunity();
    const composer = document.createElement('div');
    composer.className = 'amb-row';
    composer.innerHTML = `
      <div class="avatar">+</div>
      <div style="flex:1">
        <input id="cm-title" placeholder="Title" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px;margin-bottom:6px"/>
        <textarea id="cm-body" placeholder="Speak your piece…" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px;min-height:60px"></textarea>
        <div style="margin-top:8px"><button class="btn primary" id="cm-post">Post</button></div>
      </div>`;
    list.appendChild(composer);
    composer.querySelector('#cm-post').addEventListener('click', async () => {
      const title = composer.querySelector('#cm-title').value.trim();
      const body  = composer.querySelector('#cm-body').value.trim();
      if (!title || !body) return alert('Title and body, please.');
      await AA.postToCommunity({ title, body, author: 'You', topic: 'general' });
      composer.querySelector('#cm-title').value = '';
      composer.querySelector('#cm-body').value = '';
      renderCommunity();
    });
    [...local, ...seeded].forEach(p => list.appendChild(postRow(p)));
  }
  function postRow (p) {
    const row = document.createElement('div');
    row.className = 'post-row';
    row.innerHTML = `
      <div class="avatar">${(p.author||'A').slice(0,1)}</div>
      <div style="flex:1">
        <h3 style="margin:0 0 4px">${p.title}</h3>
        <div class="meta">${p.author||'Anon'} · #${p.topic||'general'}</div>
        <p style="margin:8px 0 0">${p.body}</p>
        <div style="margin-top:8px"><span class="tag">♥ ${p.likes||0}</span></div>
      </div>`;
    return row;
  }

  // ---- ambassadors ------------------------------------------------------
  async function renderAmb () {
    const list = $('#amb-list'); list.innerHTML = '';
    list.classList.add('anim-stagger');
    const items = await AA.getAmbassadors();
    // try to map ambassadors to their chat user ids by name
    const chatUsers = (window.AA_CHAT_FOLLOW?.users() || []);
    items.forEach(a => {
      const matchUser = chatUsers.find(u => u.name === a.name) || { id: 'amb_' + a.id, name: a.name, city: a.city, role: 'ambassador' };
      const isFollowing = window.AA_CHAT_FOLLOW?.isFollowing(matchUser.id);
      const row = document.createElement('div');
      row.className = 'amb-row';
      row.innerHTML = `
        <div class="avatar">${a.name.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <h3 style="margin:0;font-family:'Space Grotesk',sans-serif;text-transform:none;letter-spacing:0">${a.name}</h3>
            <span class="status-pill ${a.status}">${a.status}</span>
          </div>
          <div class="meta">${a.city}, ${a.country} · reach ~${a.reach||0}</div>
          <p style="margin:8px 0 0">${a.pitch}</p>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="btn ${isFollowing ? 'ghost' : 'primary'}" data-follow="${matchUser.id}">${isFollowing ? '✓ Following' : 'Follow'}</button>
            <button class="btn ghost" data-msg="${matchUser.id}">Message</button>
          </div>
        </div>`;
      row.querySelector('[data-follow]').addEventListener('click', e => {
        const now = window.AA_CHAT_FOLLOW.toggle(matchUser.id);
        e.target.textContent = now ? '✓ Following' : 'Follow';
        e.target.classList.toggle('primary', !now);
        e.target.classList.toggle('ghost', now);
      });
      row.querySelector('[data-msg]').addEventListener('click', () => {
        if (!window.AA_CHAT_FOLLOW.isFollowing(matchUser.id)) window.AA_CHAT_FOLLOW.toggle(matchUser.id);
        window.AA_CHAT?.open();
        // hop to DMs tab
        const dmTab = document.querySelector('.chat-tabs [data-tab="dm"]'); dmTab?.click();
      });
      list.appendChild(row);
    });
  }
  $('#apply-amb')?.addEventListener('click', () => {
    openModal('https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1200&q=80', `
      <h2>Apply to be an ambassador</h2>
      <p>Tell us about your city, your reach, and what you'd bring.</p>
      <form id="amb-form" style="display:grid;gap:8px">
        <input required placeholder="Full name" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px"/>
        <input required placeholder="City, Country" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px"/>
        <input required type="email" placeholder="Email" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px"/>
        <textarea required placeholder="Your pitch — what would you organise locally?" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px;min-height:90px"></textarea>
        <button class="btn primary" type="submit">Send</button>
      </form>
    `);
    document.getElementById('amb-form').addEventListener('submit', async e => {
      e.preventDefault();
      const inputs = e.target.querySelectorAll('input, textarea');
      await AA.applyAmbassador({ name: inputs[0].value, location: inputs[1].value, email: inputs[2].value, pitch: inputs[3].value });
      modalBody.innerHTML = '<h2>Application sent</h2><p>A publisher will be in touch within ~5 days. Thank you for stepping up.</p>';
    });
  });

  // ---- crowdfund --------------------------------------------------------
  async function renderCrowdfund () {
    const list = $('#cf-list'); list.innerHTML = '';
    const items = await AA.getCampaigns();
    items.forEach(c => {
      const pct = Math.min(100, Math.round(c.raised_eur / c.goal_eur * 100));
      const el = document.createElement('div');
      el.className = 'cf-card';
      el.innerHTML = `
        <div class="thumb" style="background-image:url(${c.image})"></div>
        <div style="flex:1;min-width:0">
          <h3 style="margin:0 0 4px;font-family:'Space Grotesk',sans-serif;text-transform:none;letter-spacing:0">${c.title}</h3>
          <div class="meta">€${c.raised_eur.toLocaleString()} of €${c.goal_eur.toLocaleString()} · ${pct}%</div>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <div class="row-flex" style="margin-top:8px">
            <button class="btn primary" data-pledge="${c.id}">Pledge €5</button>
            <button class="btn ghost"   data-pledge25="${c.id}">€25</button>
            <button class="btn ghost"   data-pledge100="${c.id}">€100</button>
          </div>
        </div>`;
      el.addEventListener('click', async ev => {
        const t = ev.target;
        const amt = t.dataset.pledge ? 5 : t.dataset.pledge25 ? 25 : t.dataset.pledge100 ? 100 : null;
        if (!amt) return;
        await AA.pledge(c.id, amt * 100);
        window.AA_LIVE.pledge(amt, c.id, this);
      });
      list.appendChild(el);
    });
  }

  // ---- MARKETPLACE sub-tabs ---------------------------------------------
  function showSub (sub) {
    document.querySelectorAll('#merch-subtabs .subtab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
    const grids = { inhouse:'#merch-grid', allied:'#allied-grid', services:'#services-grid', seminars:'#seminars-grid', jobs:'#jobs-grid' };
    Object.values(grids).forEach(id => { const el = $(id); if (el) el.hidden = true; });
    const target = $(grids[sub]); if (target) { target.hidden = false; target.classList.add('grid', 'anim-stagger'); }
    if (sub === 'allied'   && !$('#allied-grid').children.length)   renderAllied();
    if (sub === 'services' && !$('#services-grid').children.length) renderServices();
    if (sub === 'seminars' && !$('#seminars-grid').children.length) renderSeminars();
    if (sub === 'jobs'     && !$('#jobs-grid').children.length)     renderJobs();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#merch-subtabs .subtab'); if (b) showSub(b.dataset.sub);
  });

  function shopCard (s) {
    const el = document.createElement('div');
    el.className = 'card shop-card';
    el.innerHTML = `
      <div class="thumb" style="background-image:url(${s.image})"><span class="badge">SHOP</span></div>
      <div class="body">
        <span class="city">${s.city}, ${s.country}</span>
        <h3>${s.name}</h3>
        <p class="summary">${s.what}</p>
        <div style="margin-top:10px"><button class="btn primary">Visit shop ↗</button></div>
      </div>`;
    el.addEventListener('click', () => window.open(s.url, '_blank', 'noopener'));
    return el;
  }
  function serviceCard (s) {
    const el = document.createElement('div');
    el.className = 'card service-card';
    el.innerHTML = `
      <div class="thumb" style="background-image:url(${s.image})"><span class="badge">SERVICE</span></div>
      <div class="body">
        <h3>${s.title}</h3>
        <div class="meta">${s.by} · ${s.city} · ${s.category}</div>
        <p class="summary">${s.summary}</p>
        <span class="rate">${s.rate}</span>
      </div>`;
    el.addEventListener('click', () => alert(`Contact ${s.by} via Direct messages — opening chat…`));
    return el;
  }
  function seminarCard (s) {
    const el = document.createElement('div');
    el.className = 'card seminar-card';
    const dt = new Date(s.starts_at);
    el.innerHTML = `
      <div class="thumb" style="background-image:url(${s.image})"><span class="badge">${s.format === 'online' ? 'ONLINE' : s.format.toUpperCase()}</span></div>
      <div class="body">
        <span class="when">${dt.toLocaleDateString(undefined,{ month:'short', day:'numeric'})} · ${dt.toLocaleTimeString(undefined,{hour:'2-digit', minute:'2-digit'})}</span>
        <h3>${s.title}</h3>
        <div class="meta">hosted by ${s.host}</div>
        <p class="summary">${s.summary}</p>
        <span class="fee">${s.fee}</span>
      </div>`;
    el.addEventListener('click', () => window.AA_LIVE.rsvp(s.id, el, s.title));
    return el;
  }
  function jobCard (j) {
    const el = document.createElement('div');
    el.className = 'card job-card';
    el.innerHTML = `
      <div class="thumb" style="background-image:url(${j.image})"><span class="badge">JOB</span></div>
      <div class="body">
        <h3>${j.title}</h3>
        <div class="meta">${j.org} · ${j.city}</div>
        <p class="summary">${j.summary}</p>
        <span class="comp">${j.comp}</span>
      </div>`;
    el.addEventListener('click', () => alert(`Apply at ${j.org} — opening chat to ${j.org}…`));
    return el;
  }
  async function renderAllied () {
    const g = $('#allied-grid'); g.innerHTML = ''; g.classList.add('grid', 'anim-stagger');
    (await AA.getAlliedShops()).forEach(s => g.appendChild(shopCard(s)));
  }
  async function renderServices () {
    const g = $('#services-grid'); g.innerHTML = ''; g.classList.add('grid', 'anim-stagger');
    (await AA.getServices()).forEach(s => g.appendChild(serviceCard(s)));
  }
  async function renderSeminars () {
    const g = $('#seminars-grid'); g.innerHTML = ''; g.classList.add('grid', 'anim-stagger');
    (await AA.getSeminars()).forEach(s => g.appendChild(seminarCard(s)));
  }
  async function renderJobs () {
    const g = $('#jobs-grid'); g.innerHTML = ''; g.classList.add('grid', 'anim-stagger');
    (await AA.getJobs()).forEach(j => g.appendChild(jobCard(j)));
  }

  // ---- POST OFFERING modal ----------------------------------------------
  const postBtn = $('#post-offering');
  if (postBtn) postBtn.addEventListener('click', () => {
    openModal('https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1200&q=80', `
      <h2>Post an offering</h2>
      <p style="color:var(--fg-dim)">Add to the marketplace as a service, seminar, or job. Visible to the whole network.</p>
      <form id="offer-form" style="display:grid;gap:8px;margin-top:10px">
        <select name="kind" required style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px">
          <option value="services">Service</option>
          <option value="seminars">Seminar (online or offline)</option>
          <option value="jobs">Job / gig</option>
        </select>
        <input name="title" required placeholder="Title" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px"/>
        <input name="meta"  required placeholder="Your name / org · city" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px"/>
        <input name="rate"  placeholder="Rate / fee / comp (optional)" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px"/>
        <textarea name="summary" required placeholder="Description" style="padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:8px;min-height:80px"></textarea>
        <button class="btn primary" type="submit">Post</button>
      </form>
    `);
    document.getElementById('offer-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const kind = fd.get('kind');
      const item = {
        title: fd.get('title'),
        summary: fd.get('summary'),
        image: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1200&q=80'
      };
      if (kind === 'services') { item.by = fd.get('meta').split(' · ')[0]; item.city = fd.get('meta').split(' · ')[1] || ''; item.rate = fd.get('rate') || 'Negotiable'; item.category = 'community'; }
      if (kind === 'seminars') { item.host = fd.get('meta').split(' · ')[0]; item.fee = fd.get('rate') || 'Free'; item.format = 'online'; item.starts_at = new Date(Date.now() + 7*86400e3).toISOString(); }
      if (kind === 'jobs')     { item.org = fd.get('meta').split(' · ')[0];  item.city = fd.get('meta').split(' · ')[1] || 'Remote'; item.comp = fd.get('rate') || 'Negotiable'; }
      await AA.postOffering(kind, item);
      // re-render relevant tab
      document.getElementById('modal-body').innerHTML = '<h2>Posted ✓</h2><p>Visible in the marketplace immediately.</p>';
      ['allied','services','seminars','jobs'].forEach(s => { const g = $('#' + s + '-grid'); if (g) g.innerHTML = ''; });
      // bump to the right subtab
      const tab = document.querySelector(`#merch-subtabs .subtab[data-sub="${kind}"]`); tab?.click();
    });
  });

  // ---- CUSTOMIZE THEME SHEET --------------------------------------------
  const TOKENS = ['bg','bg-2','fg','fg-dim','muted','accent','red','green','violet','teal'];
  function getCurrentTheme () {
    const stored = JSON.parse(localStorage.getItem('aa.theme') || 'null');
    if (stored) return stored;
    const cs = getComputedStyle(document.documentElement);
    const out = {}; TOKENS.forEach(t => out[t] = cs.getPropertyValue('--' + t).trim() || '#000');
    return out;
  }
  function applyTheme (tokens) {
    Object.entries(tokens).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
    localStorage.setItem('aa.theme', JSON.stringify(tokens));
  }
  function swatches (tokens) { return ['bg','fg','accent','red','green'].map(k => `<i style="background:${tokens[k] || '#000'}"></i>`).join(''); }

  async function buildCustomize () {
    const cur = getCurrentTheme();
    // tokens
    const tokensHost = $('#customize-tokens');
    tokensHost.innerHTML = TOKENS.map(t => `
      <div class="token-row">
        <label>${t}</label>
        <input type="color" value="${tokens.toHex(cur[t])}" data-tok="${t}"/>
        <input type="text"  value="${cur[t] || ''}" data-tok-text="${t}"/>
      </div>`).join('');
    tokensHost.querySelectorAll('[data-tok]').forEach(inp => inp.addEventListener('input', e => {
      const t = e.target.dataset.tok; const v = e.target.value;
      tokensHost.querySelector(`[data-tok-text="${t}"]`).value = v;
      document.documentElement.style.setProperty('--' + t, v);
    }));
    tokensHost.querySelectorAll('[data-tok-text]').forEach(inp => inp.addEventListener('change', e => {
      const t = e.target.dataset.tokText; const v = e.target.value;
      tokensHost.querySelector(`[data-tok="${t}"]`).value = tokens.toHex(v);
      document.documentElement.style.setProperty('--' + t, v);
    }));
    // admin presets
    const seed = await AA.getSite(); // ensure load
    const seedAll = await AA.loadSeed().catch(() => null);
    const presets = (seedAll && seedAll.theme_presets) || [];
    $('#preset-list').innerHTML = '';
    presets.forEach(p => {
      const c = document.createElement('div');
      c.className = 'preset-card';
      c.innerHTML = `<div class="swatches">${swatches(p.tokens)}</div><div class="meta"><b>${p.name}</b><span>by ${p.by}</span></div>`;
      c.addEventListener('click', () => applyTheme(p.tokens));
      $('#preset-list').appendChild(c);
    });
    // user presets
    renderUserPresets();
  }
  const tokens = {
    toHex (v) {
      v = (v || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) return v;
      // Convert rgb()/rgba() approximately
      const m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (m) return '#' + [m[1],m[2],m[3]].map(n => Number(n).toString(16).padStart(2,'0')).join('');
      return '#000000';
    }
  };
  function renderUserPresets () {
    const list = JSON.parse(localStorage.getItem('aa.userPresets') || '[]');
    const host = $('#user-preset-list'); host.innerHTML = '';
    if (!list.length) { host.innerHTML = '<p style="color:var(--muted);font-size:.8rem;margin:0">Save your first theme below.</p>'; return; }
    list.forEach((p, i) => {
      const c = document.createElement('div');
      c.className = 'preset-card';
      c.innerHTML = `<div class="swatches">${swatches(p.tokens)}</div><div class="meta"><b>${p.name}</b><span>${new Date(p.ts).toLocaleDateString()}</span></div><button class="delete" data-del="${i}">×</button>`;
      c.addEventListener('click', e => {
        if (e.target.dataset.del !== undefined) {
          const arr = JSON.parse(localStorage.getItem('aa.userPresets') || '[]');
          arr.splice(+e.target.dataset.del, 1);
          localStorage.setItem('aa.userPresets', JSON.stringify(arr));
          renderUserPresets();
          return;
        }
        applyTheme(p.tokens);
      });
      host.appendChild(c);
    });
  }
  document.addEventListener('click', e => {
    if (e.target.id === 'customize-open') { $('#customize-sheet')?.classList.add('open'); buildCustomize(); }
    if (e.target.id === 'customize-close') $('#customize-sheet')?.classList.remove('open');
    if (e.target.id === 'customize-reset') {
      localStorage.removeItem('aa.theme'); location.reload();
    }
    if (e.target.id === 'preset-save') {
      const name = $('#preset-name').value.trim() || ('Theme ' + new Date().toLocaleString());
      const t = getCurrentTheme();
      const arr = JSON.parse(localStorage.getItem('aa.userPresets') || '[]');
      arr.unshift({ name, tokens: t, ts: Date.now() });
      localStorage.setItem('aa.userPresets', JSON.stringify(arr));
      $('#preset-name').value = '';
      renderUserPresets();
    }
  });

  // ---- GLOBAL SEARCH ----------------------------------------------------
  async function openSearch () {
    const m = $('#search-modal'); m?.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#search-input')?.focus(), 50);
    runSearch('');
  }
  function closeSearch () { $('#search-modal')?.classList.remove('open'); document.body.style.overflow = ''; }
  $('#search-close')?.addEventListener('click', closeSearch);
  $('#search-modal')?.addEventListener('click', e => { if (e.target.id === 'search-modal') closeSearch(); });
  $('#search-input')?.addEventListener('input', e => runSearch(e.target.value));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });
  async function runSearch (q) {
    const seed = await AA.loadSeed();
    const types = [
      ['film',     seed.films,           x => `${x.director} · ${x.duration}min`,             x => setTab('films')],
      ['article',  seed.articles,        x => `${x.author} · ${x.reading_time}min`,            x => setTab('articles')],
      ['event',    seed.events,          x => `${x.city} · ${new Date(x.starts_at).toLocaleDateString()}`, x => setTab('events')],
      ['song',     seed.music,           x => `${x.artist}`,                                   x => setTab('music')],
      ['book',     seed.books,           x => `${x.author}`,                                   x => setTab('books')],
      ['merch',    seed.merch,           x => `€${x.price_eur} · ${x.provider}`,                x => setTab('merch')],
      ['shop',     seed.external_shops,  x => `${x.city}, ${x.country}`,                       x => { setTab('merch'); document.querySelector('.subtab[data-sub="allied"]')?.click(); }],
      ['service',  seed.services,        x => `${x.by} · ${x.rate}`,                           x => { setTab('merch'); document.querySelector('.subtab[data-sub="services"]')?.click(); }],
      ['seminar',  seed.seminars,        x => `${x.host} · ${x.format}`,                       x => { setTab('merch'); document.querySelector('.subtab[data-sub="seminars"]')?.click(); }],
      ['job',      seed.jobs,            x => `${x.org} · ${x.city}`,                          x => { setTab('merch'); document.querySelector('.subtab[data-sub="jobs"]')?.click(); }],
      ['amb',      seed.ambassadors,     x => `${x.city}, ${x.country}`,                       x => setTab('ambassadors')]
    ];
    const f = (q || '').toLowerCase().trim();
    const out = $('#search-results'); out.innerHTML = ''; let count = 0;
    types.forEach(([kind, list, sub, jump]) => {
      (list || []).forEach(item => {
        const hay = JSON.stringify(item).toLowerCase();
        if (!f || hay.includes(f)) {
          count++;
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:10px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);cursor:pointer';
          row.innerHTML = `
            <span style="display:inline-block;font-size:.65rem;padding:2px 8px;border-radius:99px;background:var(--accent);color:var(--bg);font-weight:700;letter-spacing:.12em;text-transform:uppercase;flex:0 0 auto;align-self:flex-start">${kind}</span>
            <div style="flex:1;min-width:0">
              <b style="display:block">${(item.title || item.name || item.funder || item.host || '')}</b>
              <span style="color:var(--muted);font-size:.8rem">${sub(item)}</span>
            </div>`;
          row.addEventListener('click', () => { closeSearch(); jump(item); });
          out.appendChild(row);
        }
      });
    });
    if (!count) out.innerHTML = '<p style="color:var(--muted);padding:20px;text-align:center">no match — try a different word.</p>';
  }

  // ---- KONAMI CODE → underground mode ----------------------------------
  (function () {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let buf = [];
    document.addEventListener('keydown', e => {
      buf.push(e.key); if (buf.length > code.length) buf.shift();
      if (buf.join(',').toLowerCase() === code.join(',').toLowerCase()) {
        document.body.classList.add('underground');
        const t = document.createElement('div'); t.className = 'underground-toast'; t.textContent = 'UNDERGROUND MODE — 60s'; document.body.appendChild(t);
        setTimeout(() => { document.body.classList.remove('underground'); t.remove(); }, 60000);
      }
    });
  })();

  // ---- CLI install widget ----------------------------------------------
  function detectOS () {
    const ua = navigator.userAgent || '';
    if (/Mac/i.test(ua))     return 'mac';
    if (/Linux/i.test(ua))   return 'linux';
    if (/Windows/i.test(ua)) return 'win';
    return 'unix';
  }
  function installCommand (os = 'unix') {
    if (os === 'win') {
      // Windows users via PowerShell or WSL — give them WSL
      return `wsl bash -c "curl -sSL ${location.origin || 'https://anarchism-africa.vercel.app'}/aa.sh | bash"`;
    }
    return `curl -sSL ${location.origin || 'https://anarchism-africa.vercel.app'}/aa.sh | bash`;
  }
  const cliCopy = $('#cli-copy');
  const cliOs   = $('#cli-os');
  const cliScr  = $('#cli-screen');
  if (cliCopy) {
    cliCopy.addEventListener('click', async () => {
      const cmd = installCommand(detectOS());
      try {
        await navigator.clipboard.writeText(cmd);
        const card = $('#cli-install'); card.classList.add('copied');
        cliCopy.textContent = '✓ Copied — paste into Terminal';
        setTimeout(() => { cliCopy.textContent = 'Copy install command'; card.classList.remove('copied'); }, 2400);
      } catch {
        prompt('Copy this:', cmd);
      }
    });
  }
  if (cliOs) {
    cliOs.addEventListener('click', () => {
      const os = detectOS();
      const cmd = installCommand(os);
      const label = ({ mac:'macOS', linux:'Linux', win:'Windows (WSL)', unix:'Unix' })[os];
      cliScr.innerHTML = `<span class="cli-comment"># ${label} — paste in Terminal</span>\n<span class="cli-prompt">[anarchist@africa]$</span> <span class="cli-cmd">${cmd}</span>`;
    });
  }

  // ---- newsletter -------------------------------------------------------
  document.querySelectorAll('#newsletter-form, #newsletter-form-2').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const email = e.target.querySelector('input').value;
    const r = await AA.subscribe(email);
    e.target.reset();
    alert(`Subscribed ${email} — list size: ${r.count || '∞'}`);
  }));

  // ---- role strip -------------------------------------------------------
  // Role strip — toggled by bottombar 'signin' button now (header pill removed)
  function toggleRoleStrip () {
    const strip = $('#role-strip'); if (strip) strip.classList.toggle('open');
  }
  window.AA_ROLE = { toggleStrip: toggleRoleStrip };
  $('#role-toggle')?.addEventListener('click', toggleRoleStrip);
  $$('#role-strip button').forEach(b => b.addEventListener('click', () => {
    AA.setRole(b.dataset.role);
    $$('#role-strip button').forEach(x => x.classList.toggle('active', x === b));
    if (['admin','publisher','merch'].includes(b.dataset.role)) {
      setTimeout(() => { if (confirm('Open the Studio backend?')) location.href = 'admin.html'; }, 200);
    }
    // close strip after pick
    setTimeout(() => $('#role-strip')?.classList.remove('open'), 600);
  }));

  // chat is now owned by chat.js — see js/chat.js

  // ---- skeletons + entry animations ------------------------------------
  function applyEntryAnim () {
    const anim = localStorage.getItem('aa.anim') || 'aa-fade-up';
    document.documentElement.style.setProperty('--enter-anim', anim);
  }
  function applyCustomLogo () {
    const url = localStorage.getItem('aa.customLogo');
    if (!url) return;
    document.querySelectorAll('.brand .logo').forEach(l => {
      l.classList.add('custom');
      l.style.setProperty('--custom-logo', `url("${url}")`);
    });
  }
  function injectCustomCSS () {
    const css = localStorage.getItem('aa.css');
    if (!css) return;
    let tag = document.getElementById('aa-custom-css');
    if (!tag) { tag = document.createElement('style'); tag.id = 'aa-custom-css'; document.head.appendChild(tag); }
    tag.textContent = css;
  }
  function showSkeletons (containerId, n = 6) {
    const c = $(containerId); if (!c) return;
    c.classList.add('skeleton-grid');
    c.innerHTML = Array.from({length: n}, () => '<div class="skeleton"></div>').join('');
  }
  function clearSkeletons (containerId) {
    const c = $(containerId); if (!c) return;
    c.classList.remove('skeleton-grid');
    c.classList.add('grid','anim-stagger');
    c.innerHTML = '';
  }

  // wrap renderTab with skeleton + stagger anim
  const _renderTab = renderTab;
  renderTab = async function (tab) {
    const map = { films:'#films-grid', articles:'#articles-grid', events:'#events-grid', books:'#books-grid', merch:'#merch-grid' };
    const target = map[tab];
    if (target && !$(target).children.length) showSkeletons(target);
    await new Promise(r => setTimeout(r, 220));   // tiny delay so the shimmer is visible
    if (target) clearSkeletons(target);
    return _renderTab(tab);
  };

  // ---- boot -------------------------------------------------------------
  (async function boot () {
    applyEntryAnim();
    applyCustomLogo();
    injectCustomCSS();
    // theme tokens from localStorage
    const customTheme = localStorage.getItem('aa.theme');
    if (customTheme) {
      try {
        const t = JSON.parse(customTheme);
        Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
      } catch {}
    }

    // skeleton flash → real content with stagger animation
    showSkeletons('#featured-grid');
    showSkeletons('#library-grid', 3);
    await new Promise(r => setTimeout(r, 280));
    clearSkeletons('#featured-grid');
    clearSkeletons('#library-grid');
    await renderHome();

    // tab clicks render lazily
    $('#tabs')?.addEventListener('click', e => {
      const t = e.target.closest('.tab'); if (t) renderTab(t.dataset.tab);
    });
    const h = location.hash.replace('#', '');
    if (h && document.getElementById('view-' + h)) { setTab(h); renderTab(h); }
    setTimeout(() => ['films','articles','events','music','books','merch','community','ambassadors','crowdfund'].forEach(renderTab), 600);
  })();

  // react to theme changes — re-trigger entry animation on visible cards for tactile feedback
  window.addEventListener('aa:theme', () => {
    document.querySelectorAll('section.view.active .card').forEach(c => {
      c.classList.remove('anim-enter');
      void c.offsetWidth;
      c.classList.add('anim-enter');
    });
  });
})();
