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
    // sync bottombar Home highlight only for tab=home (other actions remain unselected)
    $$('.bottombar [data-bbar]').forEach(b => b.classList.toggle('active',
      (b.dataset.bbar === 'home' && name === 'home') ||
      (b.dataset.bbar === 'merch' && name === 'merch')));
    $$('section.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    location.hash = name;
    // close mobile rail drawer after navigation
    if (matchMedia('(max-width: 768px)').matches) closeRail();
  }

  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) setTab(t.dataset.tab);
  });
  // left rail
  const rail = $('#rail');
  function openRail ()  { rail.classList.add('expanded'); document.body.classList.add('rail-open'); }
  function closeRail () { rail.classList.remove('expanded'); document.body.classList.remove('rail-open'); }
  function toggleRail () { rail.classList.contains('expanded') ? closeRail() : openRail(); }
  $('#menu-toggle')?.addEventListener('click', toggleRail);
  $('#rail-backdrop')?.addEventListener('click', closeRail);
  rail?.addEventListener('click', e => {
    const r = e.target.closest('.rail-item');
    if (r) { setTab(r.dataset.tab); renderTab(r.dataset.tab); }
  });
  // bottombar
  $('#bottombar')?.addEventListener('click', e => {
    const b = e.target.closest('[data-bbar]'); if (!b) return;
    const k = b.dataset.bbar;
    // Mark the current button active so the visual state matches what the
    // user just tapped (other handlers may set their own active state too).
    $$('#bottombar [data-bbar]').forEach(x => x.classList.toggle('active', x === b));

    if (k === 'home')     { setTab('home'); return; }
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
      slide.innerHTML = `
        ${media}${audio}
        <div class="hero-overlay">
          <div class="hero-kicker"><span class="dot"></span> ${typeLabel(it.type)} · live</div>
          <h1>${it.title}</h1>
          <p class="hero-sub">${it.summary || it.subtitle || ''}</p>
          <div class="hero-cta">
            <button class="btn primary" data-hero-go="${it.tab}">Open ${typeLabel(it.type)}</button>
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

  $('#hero-prev').addEventListener('click',  () => { showHero(state.heroIndex - 1); startHero(); });
  $('#hero-next').addEventListener('click',  () => { showHero(state.heroIndex + 1); startHero(); });
  $('#hero-toggle').addEventListener('click', e => {
    state.heroPlaying = !state.heroPlaying;
    e.currentTarget.textContent = state.heroPlaying ? '⏸' : '▶';
    if (state.heroPlaying) startHero(); else stopHero();
  });

  // hero CTA delegation - hero items always open the full item page
  $('#hero').addEventListener('click', e => {
    const goTab = e.target.dataset.heroGo;
    const detailId = e.target.dataset.heroDetail;
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
  $('#modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

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
      <div style="line-height:1.7;max-width:70ch">${(a.body || a.summary || '').replace(/

/g, '</p><p>').replace(/^/, '<p>') + '</p>'}</div>
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
      ${b.body ? `<div style="margin-top:14px;line-height:1.7;max-width:70ch">${b.body.replace(/

/g, '</p><p>').replace(/^/, '<p>') + '</p>'}</div>` : ''}
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
      </div>`;
    return el;
  }
  function secondaryLine (it, kind) {
    if (kind === 'film')    return `${it.director} · ${it.duration}min · ${it.language || ''}`;
    if (kind === 'article') return `${it.author} · ${it.reading_time}min · ${it.category}`;
    if (kind === 'event')   return `${new Date(it.starts_at).toLocaleDateString()} · ${it.city}`;
    if (kind === 'book')    return `${it.author} · ${it.pages}p`;
    if (kind === 'merch')   return `${it.provider}`;
    return '';
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
    const hero = await AA.getHero();
    state.hero = hero;
    buildHeroDom(hero);
    showHero(0);
    startHero();

    const featured = $('#featured-grid'); resetGrid(featured);
    const films = await AA.getByType('film');
    films.forEach(f => { const c = card(f, 'film'); attachCardClick(c, openFilm, f); featured.appendChild(c); });
    const events = await AA.getByType('event');
    events.slice(0, 3).forEach(e => { const c = card(e, 'event'); attachCardClick(c, openEvent, e); featured.appendChild(c); });

    const lib = $('#library-grid'); resetGrid(lib);
    const articles = await AA.getByType('article');
    articles.forEach(a => { const c = card(a, 'article'); attachCardClick(c, openArticle, a); lib.appendChild(c); });
  }

  async function renderTab (tab) {
    if (tab === 'films') {
      const g = $('#films-grid'); resetGrid(g);
      (await AA.getByType('film')).forEach(f => { const c = card(f,'film'); attachCardClick(c, openFilm, f); g.appendChild(c); });
    }
    if (tab === 'articles') {
      const g = $('#articles-grid'); resetGrid(g);
      (await AA.getByType('article')).forEach(a => { const c = card(a,'article'); attachCardClick(c, openArticle, a); g.appendChild(c); });
    }
    if (tab === 'events') {
      const g = $('#events-grid'); resetGrid(g);
      (await AA.getByType('event')).forEach(e => { const c = card(e,'event'); attachCardClick(c, openEvent, e); g.appendChild(c); });
    }
    if (tab === 'music') {
      const list = $('#music-list'); list.innerHTML = ''; list.classList.add('anim-stagger');
      (await AA.getByType('song')).forEach(s => list.appendChild(audioRow(s)));
    }
    if (tab === 'books') {
      const g = $('#books-grid'); resetGrid(g);
      (await AA.getByType('book')).forEach(b => { const c = card(b,'book'); attachCardClick(c, openBook, b); g.appendChild(c); });
    }
    if (tab === 'merch') {
      const g = $('#merch-grid'); resetGrid(g);
      (await AA.getByType('merch')).forEach(m => { const c = card(m,'merch'); attachCardClick(c, openMerch, m); g.appendChild(c); });
    }
    if (tab === 'community')  renderCommunity();
    if (tab === 'ambassadors') renderAmb();
    if (tab === 'crowdfund')   renderCrowdfund();
    if (tab === 'languages') {
      let host = document.getElementById('view-languages');
      if (!host) {
        host = document.createElement('section');
        host.className = 'view'; host.id = 'view-languages';
        host.style.padding = '18px var(--content-pad-x, 16px)';
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

  // -------- MINI PLAYER (sticky across tabs) -----------------------------
  const MP = (function () {
    let audio = null, current = null;
    const ui = {
      bar: $('#mini-player'), play: $('#mp-play'), close: $('#mp-close'),
      title: $('#mp-title'), artist: $('#mp-artist'), progress: $('#mp-bar')
    };
    function play (song) {
      if (audio && current?.id === song.id) {
        if (audio.paused) audio.play(); else audio.pause();
        return;
      }
      if (audio) { audio.pause(); audio.src = ''; }
      audio = new Audio(song.audio);
      current = song;
      ui.title.textContent  = song.title;
      ui.artist.textContent = song.artist;
      ui.bar?.classList.add('show');
      ui.play.textContent = '⏸'; ui.play.classList.add('playing');
      audio.play().catch(() => {});
      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        ui.progress.style.width = (audio.currentTime / audio.duration * 100) + '%';
      });
      audio.addEventListener('pause', () => { ui.play.textContent = '▶'; ui.play.classList.remove('playing'); });
      audio.addEventListener('play',  () => { ui.play.textContent = '⏸'; ui.play.classList.add('playing'); });
      audio.addEventListener('ended', () => { ui.bar?.classList.remove('show'); current = null; });
    }
    ui.play?.addEventListener('click',  () => { if (audio) (audio.paused ? audio.play() : audio.pause()); });
    ui.close?.addEventListener('click', () => { audio?.pause(); ui.bar?.classList.remove('show'); current = null; });
    return { play, get current () { return current; } };
  })();

  function audioRow (s) {
    const row = document.createElement('div');
    row.className = 'audio-row';
    row.innerHTML = `
      <button class="play">▶</button>
      <div class="info">
        <h3>${s.title}</h3>
        <div class="meta">${s.artist} · ${Math.floor(s.duration/60)}:${String(s.duration%60).padStart(2,'0')}</div>
      </div>`;
    const btn = row.querySelector('.play');
    btn.addEventListener('click', () => MP.play(s));
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
  $('#apply-amb').addEventListener('click', () => {
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
    if (e.target.id === 'customize-open') { $('#customize-sheet').classList.add('open'); buildCustomize(); }
    if (e.target.id === 'customize-close') $('#customize-sheet').classList.remove('open');
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
    $('#tabs').addEventListener('click', e => {
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
