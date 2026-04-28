/* ANARCHISM.AFRICA — chat module
 * Three tabs: A.A.AI · DMs · Groups
 * - DMs: 1:1 chat with users you follow
 * - Groups: many-to-many threads
 * - Live audio + video calls (WebRTC provider hook — LiveKit/Daily/Agora)
 * - Pasted URLs auto-embed (YouTube, Vimeo, SoundCloud, Spotify, mp3/mp4/wav/pdf)
 * - Share content sheet: search the platform, drop into the chat
 * - Share users to users / groups
 *
 * Storage: localStorage for the demo. Production would use Vercel Blob
 * (for transcripts) and a realtime channel (Pusher / Supabase Realtime / Ably) for messages.
 */
(function () {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---------- seed users + threads ----------
  const SEED_USERS = [
    { id: 'u1', name: 'Lerato M.',     city: 'Johannesburg', role: 'ambassador' },
    { id: 'u2', name: 'Esi Mensah',    city: 'Accra',         role: 'partner' },
    { id: 'u3', name: 'Yannick D.',    city: 'Brussels',      role: 'ambassador' },
    { id: 'u4', name: 'Aïcha B.',      city: 'Tunis',         role: 'consumer' },
    { id: 'u5', name: 'Kojo Sound',    city: 'Accra',         role: 'partner' },
    { id: 'u6', name: 'COOLHUNTPARIS', city: 'Paris',         role: 'publisher' },
    { id: 'u7', name: 'DJ Anarka',     city: 'Luanda',        role: 'partner' }
  ];
  const SEED_GROUPS = [
    { id: 'g1', name: 'Diaspora reading circle',  members: ['u2','u3','u4','u6'], emoji: '📚' },
    { id: 'g2', name: 'Soundsystem build · Accra', members: ['u5','u7','u6'],     emoji: '🔊' },
    { id: 'g3', name: 'Pan-African bookfair org',  members: ['u1','u2','u6'],     emoji: '🌍' }
  ];

  function loadStore () {
    const s = JSON.parse(localStorage.getItem('aa.chat') || 'null');
    if (s) return s;
    const init = {
      following: ['u1','u2','u3','u5','u6'],
      groups: SEED_GROUPS.map(g => ({ ...g })),
      threads: {} // keyed by threadId → array of messages
    };
    // seed a few sample messages
    init.threads['u1'] = [
      { from: 'u1', body: 'Joburg session locked for May 11 — we\'re bringing the Kojo EP.', ts: Date.now()-3600e3*5 },
      { from: 'me', body: 'Let me know if you need posters — happy to ship via Studio.',    ts: Date.now()-3600e3*4 }
    ];
    init.threads['g1'] = [
      { from: 'u2', body: 'I have two volunteers for the Twi translation.', ts: Date.now()-3600e3*8 },
      { from: 'u6', body: 'Brilliant. Sending the draft now: https://anarchism.africa/library', ts: Date.now()-3600e3*7 }
    ];
    localStorage.setItem('aa.chat', JSON.stringify(init));
    return init;
  }
  function saveStore (s) { localStorage.setItem('aa.chat', JSON.stringify(s)); }

  const store = loadStore();
  const userById = id => SEED_USERS.find(u => u.id === id) || { id, name: id };
  const initials = name => name.split(/\s+/).map(s => s[0]).join('').slice(0,2).toUpperCase();
  const fmtTime  = ts => {
    const d = new Date(ts), now = Date.now();
    if (now - ts < 60e3)  return 'now';
    if (now - ts < 3600e3) return Math.floor((now-ts)/60e3) + 'm';
    if (now - ts < 86400e3) return Math.floor((now-ts)/3600e3) + 'h';
    return d.toLocaleDateString();
  };

  // ---------- embed detector ----------
  function detectEmbed (url) {
    if (!url || !/^https?:\/\//.test(url)) return null;
    let m;
    // YouTube
    if ((m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/))) {
      return { kind: 'iframe', src: `https://www.youtube.com/embed/${m[1]}`, ratio: '16/9' };
    }
    // Vimeo
    if ((m = url.match(/vimeo\.com\/(\d+)/))) {
      return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}`, ratio: '16/9' };
    }
    // SoundCloud
    if (/soundcloud\.com\//.test(url)) {
      return { kind: 'iframe', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23FFD700`, ratio: 'audio' };
    }
    // Spotify
    if ((m = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/))) {
      return { kind: 'iframe', src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, ratio: 'audio' };
    }
    // raw audio/video/pdf
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { kind: 'video', src: url };
    if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) return { kind: 'audio', src: url };
    if (/\.pdf(\?|$)/i.test(url)) return { kind: 'pdf', src: url };
    return { kind: 'link', src: url };
  }

  function embedHtml (e, label) {
    if (!e) return '';
    if (e.kind === 'iframe' && e.ratio === '16/9') {
      return `<div class="embed" style="aspect-ratio:16/9"><iframe src="${e.src}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    if (e.kind === 'iframe' && e.ratio === 'audio') {
      return `<div class="embed"><iframe src="${e.src}" style="height:120px" allow="autoplay; encrypted-media"></iframe></div>`;
    }
    if (e.kind === 'video') return `<div class="embed"><video controls preload="metadata" src="${e.src}"></video></div>`;
    if (e.kind === 'audio') return `<div class="embed"><audio controls preload="metadata" src="${e.src}"></audio></div>`;
    if (e.kind === 'pdf')   return `<div class="embed pdf"><iframe src="${e.src}#view=fitH" loading="lazy"></iframe></div>`;
    // generic link
    const host = (() => { try { return new URL(e.src).hostname.replace('www.',''); } catch { return e.src; } })();
    return `<a class="embed-link" href="${e.src}" target="_blank" rel="noopener"><span class="ico">↗</span><span><b>${label || host}</b><span>${e.src}</span></span></a>`;
  }

  // ---------- UI building ----------
  let activeThread = null;       // 'ai' | userId | groupId
  let aiHistory    = [];

  function renderTabs () {
    const tabs = `
      <div class="chat-tabs">
        <button class="active" data-tab="ai">A.A.AI</button>
        <button data-tab="dm">Direct</button>
        <button data-tab="grp">Groups</button>
      </div>`;
    return tabs;
  }

  function renderAIScreen () {
    return `
      <section class="chat-screen active" id="cs-ai">
        <div class="chat-body" id="ai-body"></div>
        ${composerHtml('ai')}
      </section>`;
  }

  function renderDMScreen () {
    return `
      <section class="chat-screen" id="cs-dm">
        <div class="thread-list" id="dm-list"></div>
        <div class="dm-view" style="display:none;flex:1;flex-direction:column;min-height:0" id="dm-view">
          <div class="dm-head" id="dm-head"></div>
          <div class="chat-body" id="dm-body"></div>
          ${composerHtml('dm')}
        </div>
      </section>`;
  }

  function renderGroupScreen () {
    return `
      <section class="chat-screen" id="cs-grp">
        <div class="thread-list" id="grp-list"></div>
        <div class="dm-view" style="display:none;flex:1;flex-direction:column;min-height:0" id="grp-view">
          <div class="dm-head" id="grp-head"></div>
          <div class="chat-body" id="grp-body"></div>
          ${composerHtml('grp')}
        </div>
      </section>`;
  }

  function composerHtml (kind) {
    return `
      <form class="chat-form" data-kind="${kind}">
        <div class="tools">
          <button type="button" data-act="share"  title="Share content">⊕</button>
          <button type="button" data-act="user"   title="Share a user">@</button>
          ${kind !== 'ai' ? '<button type="button" data-act="call" title="Audio/Video call">🎙</button>' : ''}
        </div>
        <input type="text" placeholder="${kind === 'ai' ? 'Ask the archive…' : 'Message…'}" autocomplete="off"/>
        <button type="submit">↑</button>
      </form>`;
  }

  function buildPanel () {
    const panel = $('#chat-panel');
    if (!panel) return;
    // Wipe and rebuild
    panel.innerHTML = `
      <div class="chat-head">
        <div class="title">A.A · CHAT</div>
        <div class="model-pick" id="chat-model">gemini-1.5-flash</div>
        <button class="icon-btn" id="chat-close" style="border:0;background:transparent;color:var(--fg-dim);cursor:pointer;font-size:18px;margin-left:6px">×</button>
      </div>
      ${renderTabs()}
      ${renderAIScreen()}
      ${renderDMScreen()}
      ${renderGroupScreen()}
      <div class="share-sheet" id="share-sheet">
        <h4>Share content</h4>
        <input type="text" id="share-q" placeholder="Search films, articles, events, music, books, merch…"/>
        <div class="share-results" id="share-results"></div>
        <button class="btn ghost" id="share-close" style="margin-top:6px">Close</button>
      </div>
      <div class="call-stage" id="call-stage">
        <div class="grid" id="call-grid"></div>
        <div class="call-controls">
          <button id="call-mute"  title="Mute">🎙</button>
          <button id="call-cam"   title="Camera">📷</button>
          <button id="call-share" title="Share screen">🖥</button>
          <button class="danger" id="call-end" title="Hang up">⏹</button>
        </div>
      </div>`;

    // wire tabs
    $$('.chat-tabs button').forEach(b => b.addEventListener('click', () => {
      $$('.chat-tabs button').forEach(x => x.classList.toggle('active', x === b));
      $$('.chat-screen').forEach(s => s.classList.remove('active'));
      $('#cs-' + b.dataset.tab).classList.add('active');
      if (b.dataset.tab === 'dm')  renderDMList();
      if (b.dataset.tab === 'grp') renderGroupList();
    }));

    // close
    $('#chat-close').addEventListener('click', () => panel.classList.remove('open'));

    // model label
    $('#chat-model').textContent = (window.AA_CONFIG?.ai?.model) || 'gemini-1.5-flash';

    // composers — delegate
    $$('.chat-form').forEach(f => {
      f.addEventListener('submit', e => { e.preventDefault(); handleSend(f); });
      f.addEventListener('click', e => {
        const act = e.target.dataset.act;
        if (!act) return;
        if (act === 'share') openShareSheet(f.dataset.kind);
        if (act === 'user')  shareUserPrompt(f.dataset.kind);
        if (act === 'call')  startCall(f.dataset.kind);
      });
    });

    // share sheet
    $('#share-close').addEventListener('click', () => $('#share-sheet').classList.remove('open'));
    $('#share-q').addEventListener('input', renderShareResults);

    // call controls
    $('#call-end').addEventListener('click', () => $('#call-stage').classList.remove('open'));
    ['call-mute','call-cam','call-share'].forEach(id => $('#'+id).addEventListener('click', e => {
      e.currentTarget.classList.toggle('toggled-off');
    }));

    // render initial AI screen welcome
    if (!aiHistory.length) {
      pushMsg('ai-body', 'bot', "I'm A.A.AI — the library oracle. Ask about films, articles, events, music, books, merch, or how to host locally.");
    }
  }

  // ---------- AI tab ----------
  async function aiAsk (q) {
    pushMsg('ai-body', 'user', q);
    aiHistory.push({ role: 'user', content: q });
    const m = pushMsg('ai-body', 'bot', '…');
    const ans = await window.AA_AI.ask(q, aiHistory);
    m.innerHTML = '';
    m.appendChild(document.createTextNode(ans));
    aiHistory.push({ role: 'assistant', content: ans });
  }

  // ---------- DMs ----------
  function renderDMList () {
    const list = $('#dm-list');
    list.innerHTML = '';
    const newDm = document.createElement('div');
    newDm.className = 'thread';
    newDm.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,var(--accent),var(--red));color:#000">+</div>
      <div class="meta"><b>New direct message</b><span>Pick someone you follow</span></div>`;
    newDm.addEventListener('click', () => pickFollowToDM());
    list.appendChild(newDm);

    store.following.forEach(id => {
      const u = userById(id);
      const t = store.threads[id] || [];
      const last = t[t.length-1];
      const row = document.createElement('div');
      row.className = 'thread';
      row.innerHTML = `
        <div class="avatar">${initials(u.name)}</div>
        <div class="meta">
          <b>${u.name}</b>
          <span>${last ? (last.body.slice(0,40)) : 'Say hi —'}</span>
        </div>
        ${last ? `<span class="badge">${fmtTime(last.ts)}</span>` : ''}`;
      row.addEventListener('click', () => openDM(id));
      list.appendChild(row);
    });
  }

  function pickFollowToDM () {
    const ids = store.following;
    if (!ids.length) { alert('Follow some users first.'); return; }
    // simple inline picker
    const list = $('#dm-list');
    list.innerHTML = '<div style="padding:10px;color:var(--muted);font-size:.8rem">Tap a user to start a chat:</div>';
    ids.forEach(id => {
      const u = userById(id);
      const row = document.createElement('div');
      row.className = 'thread';
      row.innerHTML = `<div class="avatar">${initials(u.name)}</div><div class="meta"><b>${u.name}</b><span>${u.city} · ${u.role}</span></div>`;
      row.addEventListener('click', () => openDM(id));
      list.appendChild(row);
    });
  }

  function openDM (id) {
    activeThread = id;
    $('#dm-list').style.display = 'none';
    const v = $('#dm-view'); v.style.display = 'flex';
    const u = userById(id);
    $('#dm-head').innerHTML = `
      <button class="icon-btn" id="dm-back" title="Back">‹</button>
      <div class="avatar">${initials(u.name)}</div>
      <div class="who"><b>${u.name}</b><span>${u.city} · online</span></div>
      <button class="icon-btn" data-call="${id}" title="Audio call">🎙</button>
      <button class="icon-btn" data-vcall="${id}" title="Video call">📹</button>`;
    $('#dm-back').addEventListener('click', () => { v.style.display='none'; $('#dm-list').style.display='block'; renderDMList(); });
    $$('#dm-head [data-call]').forEach(b => b.addEventListener('click', () => startCall('dm', { audioOnly: true })));
    $$('#dm-head [data-vcall]').forEach(b => b.addEventListener('click', () => startCall('dm')));
    renderThread('dm-body', id);
  }

  // ---------- Groups ----------
  function renderGroupList () {
    const list = $('#grp-list');
    list.innerHTML = '';
    const newG = document.createElement('div');
    newG.className = 'thread';
    newG.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,var(--accent),var(--violet));color:#000">+</div>
      <div class="meta"><b>New group</b><span>Pick members from your follows</span></div>`;
    newG.addEventListener('click', () => createGroupPrompt());
    list.appendChild(newG);

    store.groups.forEach(g => {
      const t = store.threads[g.id] || [];
      const last = t[t.length-1];
      const row = document.createElement('div');
      row.className = 'thread';
      row.innerHTML = `
        <div class="avatar">${g.emoji || '◯'}</div>
        <div class="meta">
          <b>${g.name}</b>
          <span>${g.members.length} members · ${last ? (last.body.slice(0,30)) : 'Empty'}</span>
        </div>
        ${last ? `<span class="badge">${fmtTime(last.ts)}</span>` : ''}`;
      row.addEventListener('click', () => openGroup(g.id));
      list.appendChild(row);
    });
  }

  function createGroupPrompt () {
    const name = prompt('Group name?');
    if (!name) return;
    const g = { id: 'g' + Date.now(), name, members: store.following.slice(0, 3), emoji: '◯' };
    store.groups.unshift(g); saveStore(store); renderGroupList();
  }

  function openGroup (id) {
    activeThread = id;
    const g = store.groups.find(x => x.id === id);
    $('#grp-list').style.display = 'none';
    const v = $('#grp-view'); v.style.display = 'flex';
    $('#grp-head').innerHTML = `
      <button class="icon-btn" id="grp-back" title="Back">‹</button>
      <div class="avatar">${g.emoji || '◯'}</div>
      <div class="who"><b>${g.name}</b><span>${g.members.map(m => userById(m).name).slice(0,3).join(', ')}${g.members.length>3 ? '…' : ''}</span></div>
      <button class="icon-btn" data-call="${id}" title="Group call">🎙</button>
      <button class="icon-btn" data-vcall="${id}" title="Group video">📹</button>`;
    $('#grp-back').addEventListener('click', () => { v.style.display='none'; $('#grp-list').style.display='block'; renderGroupList(); });
    $$('#grp-head [data-call]').forEach(b => b.addEventListener('click', () => startCall('grp', { audioOnly: true })));
    $$('#grp-head [data-vcall]').forEach(b => b.addEventListener('click', () => startCall('grp')));
    renderThread('grp-body', id);
  }

  // ---------- thread renderer ----------
  function renderThread (containerId, threadId) {
    const body = $('#' + containerId);
    body.innerHTML = '';
    const msgs = store.threads[threadId] || [];
    msgs.forEach(m => {
      const isMe = m.from === 'me';
      const u = isMe ? { name: 'You' } : userById(m.from);
      const wrap = document.createElement('div');
      wrap.className = 'chat-msg ' + (isMe ? 'user' : 'bot');
      wrap.innerHTML = renderMsgBody(m, u);
      body.appendChild(wrap);
    });
    body.scrollTop = body.scrollHeight;
  }

  function renderMsgBody (m, sender) {
    let html = '';
    if (m.share) {
      html += `<div class="embed-share-card">
        <img src="${m.share.image}" alt=""/>
        <div><span>${m.share.kind}</span><b>${m.share.title}</b></div>
      </div>`;
      return html;
    }
    if (m.shareUser) {
      const su = userById(m.shareUser);
      html += `<div class="embed-share-card">
        <div class="ico" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--violet),var(--red));color:#fff;display:grid;place-items:center;font-weight:700">${initials(su.name)}</div>
        <div><span>USER</span><b>${su.name}</b><span>${su.city || ''}</span></div>
      </div>`;
      return html;
    }
    // plain text + URL detection
    const text = m.body || '';
    const urls = (text.match(/https?:\/\/\S+/g) || []);
    let plain = text;
    urls.forEach(u => { plain = plain.split(u).join(`<span class="url">${u}</span>`); });
    html += `<div>${escapeHtml(text).replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank" style="color:inherit;text-decoration:underline">$1</a>')}</div>`;
    urls.forEach(u => { html += embedHtml(detectEmbed(u)); });
    return html;
  }
  function escapeHtml (s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  function pushMsg (containerId, who, text) {
    const body = $('#' + containerId);
    const m = document.createElement('div');
    m.className = 'chat-msg ' + who;
    m.textContent = text;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
    return m;
  }

  // ---------- send ----------
  function handleSend (form) {
    const kind = form.dataset.kind;
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    if (kind === 'ai') return aiAsk(text);
    if (!activeThread) return;
    const t = store.threads[activeThread] = store.threads[activeThread] || [];
    t.push({ from: 'me', body: text, ts: Date.now() });
    saveStore(store);
    renderThread(kind === 'dm' ? 'dm-body' : 'grp-body', activeThread);
    // simulated reply
    if (kind === 'dm') simulateReply(activeThread);
  }

  function simulateReply (id) {
    const u = userById(id);
    const replies = ['Word.', 'On it.', 'Send the link.', '🔥', 'Let\'s circle Sunday.', 'Tell me more.'];
    setTimeout(() => {
      const t = store.threads[id]; if (!t) return;
      t.push({ from: id, body: replies[Math.floor(Math.random()*replies.length)], ts: Date.now() });
      saveStore(store);
      if (activeThread === id) renderThread('dm-body', id);
    }, 1200 + Math.random()*1800);
  }

  // ---------- share content sheet ----------
  let shareTarget = null;       // 'ai' | 'dm' | 'grp'
  function openShareSheet (kind) {
    shareTarget = kind;
    $('#share-sheet').classList.add('open');
    renderShareResults();
    setTimeout(() => $('#share-q').focus(), 50);
  }
  async function renderShareResults () {
    const q = ($('#share-q').value || '').toLowerCase();
    const types = ['film','article','event','song','book','merch'];
    const results = [];
    for (const t of types) {
      const items = await window.AA.getByType(t);
      items.forEach(i => {
        const hay = (i.title + ' ' + (i.summary||'') + ' ' + t).toLowerCase();
        if (!q || hay.includes(q)) results.push({ ...i, kind: t });
      });
    }
    const out = $('#share-results');
    out.innerHTML = '';
    results.slice(0, 24).forEach(r => {
      const el = document.createElement('div');
      el.className = 'pick';
      el.innerHTML = `<img src="${r.image}" alt=""/><div><b>${r.title}</b><span>${r.kind}</span></div>`;
      el.addEventListener('click', () => insertShare(r));
      out.appendChild(el);
    });
  }
  function insertShare (item) {
    if (!activeThread && shareTarget !== 'ai') {
      alert('Open a chat first.'); return;
    }
    if (shareTarget === 'ai') {
      // shove into AI as context
      $('.chat-form[data-kind="ai"] input').value = `Tell me more about: ${item.title}`;
      $('#share-sheet').classList.remove('open');
      return;
    }
    const t = store.threads[activeThread] = store.threads[activeThread] || [];
    t.push({ from: 'me', share: { kind: item.kind, title: item.title, image: item.image, id: item.id }, ts: Date.now() });
    saveStore(store);
    $('#share-sheet').classList.remove('open');
    renderThread(shareTarget === 'dm' ? 'dm-body' : 'grp-body', activeThread);
  }

  // ---------- share user ----------
  function shareUserPrompt (kind) {
    if (!activeThread && kind !== 'ai') { alert('Open a chat first.'); return; }
    const id = prompt('Share which user? (type their name)\n' + SEED_USERS.map(u => '  · ' + u.name).join('\n'));
    if (!id) return;
    const u = SEED_USERS.find(x => x.name.toLowerCase().includes(id.toLowerCase()));
    if (!u) return alert('No match.');
    if (kind === 'ai') return; // skip
    const t = store.threads[activeThread] = store.threads[activeThread] || [];
    t.push({ from: 'me', shareUser: u.id, ts: Date.now() });
    saveStore(store);
    renderThread(kind === 'dm' ? 'dm-body' : 'grp-body', activeThread);
  }

  // ---------- live call (WebRTC stub) ----------
  // Production: drop-in providers — LiveKit, Daily.co, Agora, 100ms, Whereby.
  // This stub renders a placeholder grid so the demo feels real.
  function startCall (kind, opts={}) {
    if (!activeThread && kind !== 'ai') { alert('Open a chat first.'); return; }
    const stage = $('#call-stage'); stage.classList.add('open');
    const grid = $('#call-grid'); grid.innerHTML = '';
    let members = [];
    if (kind === 'dm') members = ['me', activeThread];
    else if (kind === 'grp') {
      const g = store.groups.find(x => x.id === activeThread);
      members = ['me', ...(g?.members || [])];
    }
    // layout
    grid.style.gridTemplateColumns = members.length <= 2 ? '1fr' : 'repeat(2, 1fr)';
    members.forEach(id => {
      const u = id === 'me' ? { name: 'You' } : userById(id);
      const tile = document.createElement('div');
      tile.className = 'tile' + (id === 'me' ? ' self' : '');
      tile.innerHTML = `${initials(u.name)}<small>${u.name}${id==='me'?' · you':''}</small>`;
      grid.appendChild(tile);
    });
    // toggle camera button if audio-only
    $('#call-cam').classList.toggle('toggled-off', !!opts.audioOnly);
  }

  // ---------- public ----------
  window.AA_CHAT = {
    open  () { $('#chat-panel').classList.add('open'); },
    close () { $('#chat-panel').classList.remove('open'); },
    rebuild: buildPanel
  };

  // ---------- boot ----------
  function boot () {
    if (!$('#chat-panel')) return;
    buildPanel();
    const fab = $('#chat-fab');
    if (fab) fab.addEventListener('click', () => $('#chat-panel').classList.toggle('open'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
