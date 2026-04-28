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

  // ---- tabs --------------------------------------------------------------
  function setTab (name) {
    state.tab = name;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('section.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    location.hash = name;
  }

  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) setTab(t.dataset.tab);
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

  // hero CTA delegation
  $('#hero').addEventListener('click', e => {
    const goTab = e.target.dataset.heroGo;
    const detailId = e.target.dataset.heroDetail;
    if (goTab) { setTab(goTab); }
    if (detailId) {
      const item = state.hero.find(h => h.id === detailId);
      if (item) openModalFromHero(item);
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
    openModal(a.image, `
      <h2>${a.title}</h2>
      <p class="meta" style="color:var(--muted)">${a.author} · ${a.reading_time} min · ${a.category}</p>
      <p>${a.body || a.summary}</p>
    `);
  }
  function openEvent (ev) {
    const dt = new Date(ev.starts_at);
    openModal(ev.image, `
      <h2>${ev.title}</h2>
      <p class="meta" style="color:var(--muted)">${dt.toLocaleString()} · ${ev.venue}, ${ev.city}</p>
      <p>${ev.summary}</p>
      <div class="row-flex" style="margin-top:14px">
        <button class="btn primary" onclick="alert('RSVP saved (demo)')">RSVP</button>
        <button class="btn ghost" onclick="alert('Added to calendar (demo)')">Add to calendar</button>
      </div>
    `);
  }
  function openBook (b) {
    openModal(b.image, `
      <h2>${b.title}</h2>
      <p class="meta" style="color:var(--muted)">${b.author} · ${b.publisher} · ${b.pages}p</p>
      <p>${b.summary}</p>
      <div class="row-flex" style="margin-top:14px"><button class="btn primary" onclick="alert('Library reader (demo)')">Read in library</button></div>
    `);
  }
  function openMerch (m) {
    openModal(m.image, `
      <h2>${m.title}</h2>
      <p class="meta" style="color:var(--muted)">${m.provider} · ${m.eco.join(' · ')}</p>
      <p style="font-size:1.4rem;color:var(--accent);font-weight:700">€${m.price_eur}</p>
      <p>${m.summary}</p>
      <p class="mono" style="color:var(--muted);font-size:.8rem">est. ${m.carbon_g}g CO₂ · printed-on-demand · ships in 5–8 days</p>
      <div class="row-flex" style="margin-top:14px"><button class="btn primary" onclick="alert('POD order created (demo). API call: ' + JSON.stringify({sku:'${m.id}',provider:'${m.provider}'}))">Buy</button></div>
    `);
  }

  // ---- card factory ------------------------------------------------------
  function card (it, kind) {
    const el = document.createElement('div');
    el.className = 'card' + (kind === 'merch' ? ' merch-card' : '');
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

  function attachCardClick (el, handler, item) { el.addEventListener('click', () => handler(item)); }

  // ---- render tabs -------------------------------------------------------
  async function renderHome () {
    const hero = await AA.getHero();
    state.hero = hero;
    buildHeroDom(hero);
    showHero(0);
    startHero();

    const featured = $('#featured-grid'); featured.innerHTML = '';
    const films = await AA.getByType('film');
    films.forEach(f => { const c = card(f, 'film'); attachCardClick(c, openFilm, f); featured.appendChild(c); });
    const events = await AA.getByType('event');
    events.slice(0, 3).forEach(e => { const c = card(e, 'event'); attachCardClick(c, openEvent, e); featured.appendChild(c); });

    const lib = $('#library-grid'); lib.innerHTML = '';
    const articles = await AA.getByType('article');
    articles.forEach(a => { const c = card(a, 'article'); attachCardClick(c, openArticle, a); lib.appendChild(c); });
  }

  async function renderTab (tab) {
    if (tab === 'films') {
      const g = $('#films-grid'); g.innerHTML = '';
      (await AA.getByType('film')).forEach(f => { const c = card(f,'film'); attachCardClick(c, openFilm, f); g.appendChild(c); });
    }
    if (tab === 'articles') {
      const g = $('#articles-grid'); g.innerHTML = '';
      (await AA.getByType('article')).forEach(a => { const c = card(a,'article'); attachCardClick(c, openArticle, a); g.appendChild(c); });
    }
    if (tab === 'events') {
      const g = $('#events-grid'); g.innerHTML = '';
      (await AA.getByType('event')).forEach(e => { const c = card(e,'event'); attachCardClick(c, openEvent, e); g.appendChild(c); });
    }
    if (tab === 'music') {
      const list = $('#music-list'); list.innerHTML = '';
      (await AA.getByType('song')).forEach(s => list.appendChild(audioRow(s)));
    }
    if (tab === 'books') {
      const g = $('#books-grid'); g.innerHTML = '';
      (await AA.getByType('book')).forEach(b => { const c = card(b,'book'); attachCardClick(c, openBook, b); g.appendChild(c); });
    }
    if (tab === 'merch') {
      const g = $('#merch-grid'); g.innerHTML = '';
      (await AA.getByType('merch')).forEach(m => { const c = card(m,'merch'); attachCardClick(c, openMerch, m); g.appendChild(c); });
    }
    if (tab === 'community')  renderCommunity();
    if (tab === 'ambassadors') renderAmb();
    if (tab === 'crowdfund')   renderCrowdfund();
  }

  function audioRow (s) {
    const row = document.createElement('div');
    row.className = 'audio-row';
    row.innerHTML = `
      <button class="play">▶</button>
      <div class="info">
        <h3>${s.title}</h3>
        <div class="meta">${s.artist} · ${Math.floor(s.duration/60)}:${String(s.duration%60).padStart(2,'0')}</div>
      </div>`;
    const a = new Audio(s.audio);
    const btn = row.querySelector('.play');
    btn.addEventListener('click', () => {
      if (a.paused) {
        document.querySelectorAll('audio').forEach(x => x !== a && x.pause());
        a.play(); btn.classList.add('playing'); btn.textContent = '⏸';
      } else { a.pause(); btn.classList.remove('playing'); btn.textContent = '▶'; }
    });
    a.addEventListener('ended', () => { btn.classList.remove('playing'); btn.textContent = '▶'; });
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
    const items = await AA.getAmbassadors();
    items.forEach(a => {
      const row = document.createElement('div');
      row.className = 'amb-row';
      row.innerHTML = `
        <div class="avatar">${a.name.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <h3 style="margin:0;font-family:'Space Grotesk',sans-serif;text-transform:none;letter-spacing:0">${a.name}</h3>
            <span class="status-pill ${a.status}">${a.status}</span>
          </div>
          <div class="meta">${a.city}, ${a.country} · reach ~${a.reach||0}</div>
          <p style="margin:8px 0 0">${a.pitch}</p>
        </div>`;
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
        alert(`Pledge of €${amt} recorded (demo).`);
      });
      list.appendChild(el);
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
  $('#role-toggle').addEventListener('click', () => $('#role-strip').classList.toggle('open'));
  $$('#role-strip button').forEach(b => b.addEventListener('click', () => {
    AA.setRole(b.dataset.role);
    $$('#role-strip button').forEach(x => x.classList.toggle('active', x === b));
    $('#role-toggle').textContent = b.textContent + ' (signed in · demo)';
    if (['admin','publisher','merch'].includes(b.dataset.role)) {
      setTimeout(() => { if (confirm('Open the Studio backend?')) location.href = 'admin.html'; }, 200);
    }
  }));

  // ---- chat -------------------------------------------------------------
  const chatPanel = $('#chat-panel');
  const chatBody  = $('#chat-body');
  const chatInput = $('#chat-input');
  const chatModel = $('#chat-model');
  chatModel.textContent = window.AA_CONFIG?.ai?.model || 'gemini-1.5-flash';

  $('#chat-fab').addEventListener('click', () => {
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open') && !state.chatHistory.length) {
      pushChat('bot', "I'm A.A.AI — the library oracle. Ask about films, articles, events, music, books, merch, or how to host locally.");
    }
  });
  $('#chat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const q = chatInput.value.trim();
    if (!q) return;
    pushChat('user', q);
    state.chatHistory.push({ role: 'user', content: q });
    chatInput.value = '';
    const thinking = pushChat('bot', '…');
    const ans = await AA_AI.ask(q, state.chatHistory);
    thinking.textContent = ans;
    state.chatHistory.push({ role: 'assistant', content: ans });
  });
  function pushChat (who, text) {
    const m = document.createElement('div');
    m.className = 'chat-msg ' + who;
    m.textContent = text;
    chatBody.appendChild(m);
    chatBody.scrollTop = chatBody.scrollHeight;
    return m;
  }

  // ---- boot -------------------------------------------------------------
  (async function boot () {
    // theme override from localStorage (Studio control)
    const customTheme = localStorage.getItem('aa.theme');
    if (customTheme) {
      try {
        const t = JSON.parse(customTheme);
        Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
      } catch {}
    }
    await renderHome();
    // pre-render adjacent tabs lazily on switch
    $('#tabs').addEventListener('click', e => {
      const t = e.target.closest('.tab'); if (t) renderTab(t.dataset.tab);
    });
    // hash deep-link
    const h = location.hash.replace('#', '');
    if (h && document.getElementById('view-' + h)) { setTab(h); renderTab(h); }
    // lazy-render every other tab one time so fast-switching feels instant
    setTimeout(() => ['films','articles','events','music','books','merch','community','ambassadors','crowdfund'].forEach(renderTab), 600);
  })();
})();
