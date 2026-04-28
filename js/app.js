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
        alert(`Pledge of €${amt} recorded (demo).`);
      });
      list.appendChild(el);
    });
  }

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
  $('#role-toggle').addEventListener('click', () => $('#role-strip').classList.toggle('open'));
  $$('#role-strip button').forEach(b => b.addEventListener('click', () => {
    AA.setRole(b.dataset.role);
    $$('#role-strip button').forEach(x => x.classList.toggle('active', x === b));
    $('#role-toggle').textContent = b.textContent + ' (signed in · demo)';
    if (['admin','publisher','merch'].includes(b.dataset.role)) {
      setTimeout(() => { if (confirm('Open the Studio backend?')) location.href = 'admin.html'; }, 200);
    }
  }));

  // chat is now owned by chat.js — see js/chat.js

  // ---- skeletons + entry animations ------------------------------------
  function applyEntryAnim () {
    const anim = localStorage.getItem('aa.anim') || 'aa-fade-up';
    document.documentElement.style.setProperty('--enter-anim', anim);
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
