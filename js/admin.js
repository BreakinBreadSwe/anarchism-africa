/* ANARCHISM.AFRICA — Studio (CMS backend)
 * Tabs, content tables, theme editor, AI workbench.
 * All data stored in localStorage in the demo; switches to Supabase/Neon
 * automatically when AA_CONFIG.backend is changed.
 */
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---- tabs --------------------------------------------------------------
  function setTab (name) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + name));
    if (name === 'content')      renderContent('film');
    if (name === 'merch')        renderMerch();
    if (name === 'users')        renderUsers();
    if (name === 'mailing')      renderMailing();
    if (name === 'promotions')   renderPromos();
    if (name === 'ambassadors')  renderAmb();
    if (name === 'crowdfund')    renderCF();
    if (name === 'grants')       renderGrants();
    if (name === 'settings')     renderSettings();
    if (name === 'ai')           renderAI();
    if (name === 'dashboard')    renderDashboard();
    if (name === 'marklab')      window.MarkLab?.render();
    if (name === 'articlelab')   window.ArticleLab?.render();
  }
  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab);
  });

  // ---- DASHBOARD ---------------------------------------------------------
  async function renderDashboard () {
    const seed = await AA.loadSeed();
    const mail = JSON.parse(localStorage.getItem('aa.mailing') || '[]');
    const apps = JSON.parse(localStorage.getItem('aa.amb_apps') || '[]');
    const pledges = JSON.parse(localStorage.getItem('aa.pledges') || '[]');
    const totalRaised = pledges.reduce((s, p) => s + p.amount_cents, 0) / 100;
    $('#kpi').innerHTML = [
      ['Films',         seed.films.length],
      ['Articles',      seed.articles.length],
      ['Events',        seed.events.length],
      ['Music',         seed.music.length],
      ['Books',         seed.books.length],
      ['Merch SKUs',    seed.merch.length],
      ['Mail list',     mail.length],
      ['Amb. pending',  apps.length],
      ['Pledged €',     totalRaised.toFixed(0)]
    ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  }

  // ---- CONTENT -----------------------------------------------------------
  let contentKind = 'film';
  $('#view-content .sidenav').addEventListener('click', e => {
    const b = e.target.closest('button[data-content]');
    if (!b) return;
    $$('#view-content .sidenav button').forEach(x => x.classList.toggle('active', x === b));
    contentKind = b.dataset.content;
    renderContent(contentKind);
  });
  async function renderContent (kind) {
    contentKind = kind;
    $('#content-title').textContent =
      ({ film:'Films', article:'Articles', event:'Events', song:'Music', book:'Books' })[kind];
    const items = await AA.getByType(kind);
    const rows = $('#content-rows');
    rows.innerHTML = items.map(i => `
      <tr>
        <td><b>${i.title}</b></td>
        <td class="meta" style="color:var(--muted)">${secondary(i, kind)}</td>
        <td><span class="status-pill active">published</span></td>
        <td><button class="btn ghost" data-edit="${i.id}">Edit</button></td>
      </tr>`).join('');
  }
  function secondary (i, kind) {
    if (kind === 'film')    return `${i.director} · ${i.duration}min`;
    if (kind === 'article') return `${i.author} · ${i.reading_time}min`;
    if (kind === 'event')   return `${new Date(i.starts_at).toLocaleDateString()} · ${i.city}`;
    if (kind === 'song')    return `${i.artist}`;
    if (kind === 'book')    return `${i.author} · ${i.pages}p`;
    return '';
  }
  $('#content-new').addEventListener('click', () => alert(`New ${contentKind} editor — wire to Supabase content_items table.`));

  // ---- MERCH -------------------------------------------------------------
  async function renderMerch () {
    const providers = (window.AA_CONFIG?.pod_providers) || [];
    $('#pod-rows').innerHTML = providers.map(p => `
      <tr>
        <td><b>${p.name}</b></td>
        <td>${ecoBar(p.eco)}</td>
        <td>${p.cert.map(c => `<span class="eco-tag">${c}</span>`).join(' ')}</td>
        <td><span class="status-pill active">connected</span></td>
        <td><button class="btn ghost">Sync SKUs</button></td>
      </tr>`).join('');
    const merch = await AA.getByType('merch');
    $('#merch-rows').innerHTML = merch.map(m => `
      <tr>
        <td><b>${m.title}</b></td>
        <td>${m.provider}</td>
        <td>€${m.price_eur}</td>
        <td class="mono">${m.carbon_g}g</td>
        <td><button class="btn ghost">Edit</button></td>
      </tr>`).join('');
  }
  function ecoBar (score) {
    return `<div style="display:flex;align-items:center;gap:8px"><div style="width:80px;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><i style="display:block;height:100%;width:${score}%;background:linear-gradient(90deg,var(--green),var(--accent))"></i></div><span class="mono" style="font-size:.8rem">${score}</span></div>`;
  }

  // ---- USERS -------------------------------------------------------------
  function renderUsers () {
    const seed = [
      { email: 'admin@luvlab.io',         name: 'LUVLAB',         role: 'admin',     city: 'Brussels'   },
      { email: 'curator@coolhuntparis.fr', name: 'COOLHUNTPARIS',  role: 'publisher', city: 'Paris'     },
      { email: 'merch@anarchism.africa',  name: 'Merch staff',    role: 'merch',     city: 'Lisbon'    },
      { email: 'kojo@blackstar.dub',      name: 'Kojo Sound',     role: 'partner',   city: 'Accra'     },
      { email: 'lerato@joburg.za',        name: 'Lerato M.',      role: 'ambassador',city: 'Johannesburg' },
      { email: 'reader@diaspora.world',   name: 'Anon reader',    role: 'consumer',  city: 'London'    }
    ];
    $('#user-rows').innerHTML = seed.map(u => `
      <tr>
        <td>${u.email}</td>
        <td><b>${u.name}</b></td>
        <td><span class="status-pill ${u.role === 'admin' ? 'hot' : 'active'}">${u.role}</span></td>
        <td>${u.city}</td>
        <td><button class="btn ghost">Manage</button></td>
      </tr>`).join('');
  }

  // ---- MAILING -----------------------------------------------------------
  function renderMailing () {
    const list = JSON.parse(localStorage.getItem('aa.mailing') || '[]');
    $('#mail-stats').innerHTML = `
      <div class="stat"><b>${list.length}</b><span>subscribers</span></div>
      <div class="stat"><b>${list.filter(x => x.ts > Date.now() - 7*24*3600*1000).length}</b><span>last 7 days</span></div>`;
    $('#mail-rows').innerHTML = list.length
      ? list.map(m => `<tr><td>${m.email}</td><td>${m.name||''}</td><td class="mono" style="color:var(--muted)">${new Date(m.ts).toLocaleString()}</td></tr>`).join('')
      : '<tr><td colspan="3" style="color:var(--muted)">No subscribers yet — try the newsletter form on the public site.</td></tr>';
  }
  $('#mail-add').addEventListener('submit', async e => {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('input');
    await AA.subscribe(inputs[0].value, inputs[1].value);
    e.target.reset(); renderMailing();
  });

  // ---- PROMOTIONS --------------------------------------------------------
  function renderPromos () {
    const list = JSON.parse(localStorage.getItem('aa.promos') || '[]');
    $('#promo-rows').innerHTML = list.length
      ? list.map(p => `<tr><td><b>${p.subject}</b></td><td>${p.kind}</td><td>${p.audience}</td><td class="mono">${new Date(p.ts).toLocaleDateString()}</td></tr>`).join('')
      : '<tr><td colspan="4" style="color:var(--muted)">No campaigns yet.</td></tr>';
  }
  $('#promo-form').addEventListener('submit', e => {
    e.preventDefault();
    const [kindEl, subEl, bodyEl, audEl] = ['select','input','textarea','input[placeholder*="all"]'].map(s => e.target.querySelector(s));
    const list = JSON.parse(localStorage.getItem('aa.promos') || '[]');
    list.unshift({ kind: kindEl.value, subject: subEl.value, body: bodyEl.value, audience: audEl.value, ts: Date.now() });
    localStorage.setItem('aa.promos', JSON.stringify(list));
    e.target.reset();
    renderPromos();
    alert('Sent (demo). In production this hits Mailchimp / Resend / Listmonk.');
  });

  // ---- AMBASSADORS -------------------------------------------------------
  async function renderAmb () {
    const items = await AA.getAmbassadors();
    $('#amb-rows').innerHTML = items.map(a => `
      <tr>
        <td><b>${a.name}</b></td>
        <td>${a.city}, ${a.country}</td>
        <td>${a.reach||0}</td>
        <td><span class="status-pill ${a.status}">${a.status}</span></td>
        <td><button class="btn ghost">Manage</button></td>
      </tr>`).join('');
    const apps = JSON.parse(localStorage.getItem('aa.amb_apps') || '[]');
    $('#amb-app-rows').innerHTML = apps.length
      ? apps.map((a, i) => `
        <tr>
          <td><b>${a.name}</b></td>
          <td>${a.location}</td>
          <td>${a.pitch}</td>
          <td><button class="btn primary" data-approve="${i}">Approve</button></td>
        </tr>`).join('')
      : '<tr><td colspan="4" style="color:var(--muted)">No pending applications.</td></tr>';
    $$('#amb-app-rows [data-approve]').forEach(b => b.addEventListener('click', e => {
      const apps = JSON.parse(localStorage.getItem('aa.amb_apps') || '[]');
      apps.splice(+e.target.dataset.approve, 1);
      localStorage.setItem('aa.amb_apps', JSON.stringify(apps));
      renderAmb();
      alert('Approved (demo) — invite email sent.');
    }));
  }

  // ---- CROWDFUND ---------------------------------------------------------
  async function renderCF () {
    const items = await AA.getCampaigns();
    $('#cf-rows').innerHTML = items.map(c => {
      const pct = Math.min(100, Math.round(c.raised_eur / c.goal_eur * 100));
      return `<tr>
        <td><b>${c.title}</b></td>
        <td class="mono">€${c.raised_eur.toLocaleString()}</td>
        <td class="mono">€${c.goal_eur.toLocaleString()}</td>
        <td>${pct}%</td>
      </tr>`;
    }).join('');
  }

  // ---- GRANTS ------------------------------------------------------------
  async function renderGrants () {
    const seedGrants = (await AA.loadSeed()).grants || [];
    const stored = JSON.parse(localStorage.getItem('aa.grants') || '[]');
    const all = [...stored, ...seedGrants];
    $('#grant-rows').innerHTML = all.map(g => `
      <tr>
        <td><b>${g.funder}</b></td>
        <td>${g.title}</td>
        <td class="mono">${g.amount}</td>
        <td class="mono">${g.deadline}</td>
        <td><span class="status-pill ${g.status === 'open' ? 'pending' : 'active'}">${g.status}</span></td>
      </tr>`).join('');
  }
  $('#grant-form').addEventListener('submit', e => {
    e.preventDefault();
    const [funder, title, amount, deadline, status] = e.target.querySelectorAll('input, select');
    const list = JSON.parse(localStorage.getItem('aa.grants') || '[]');
    list.unshift({ funder: funder.value, title: title.value, amount: amount.value, deadline: deadline.value, status: status.value });
    localStorage.setItem('aa.grants', JSON.stringify(list));
    e.target.reset();
    renderGrants();
  });

  // ---- SETTINGS ----------------------------------------------------------
  function renderSettings () {
    const defaults = { bg: '#0a0a0a', fg: '#f5f0e8', accent: '#FFD700', red: '#C8102E', green: '#007749', violet: '#8B00FF', teal: '#00FFE0' };
    const cur = JSON.parse(localStorage.getItem('aa.theme') || 'null') || defaults;
    $('#theme-controls').innerHTML = Object.keys(defaults).map(k => `
      <div class="form-row" style="grid-template-columns: 110px 1fr 60px;align-items:center;display:grid;gap:10px">
        <label>${k}</label>
        <input type="color" value="${cur[k]}" data-token="${k}"/>
        <span class="mono" style="font-size:.8rem;color:var(--muted)" data-mono="${k}">${cur[k]}</span>
      </div>`).join('');
    $$('#theme-controls input[type=color]').forEach(inp => inp.addEventListener('input', e => {
      $(`#theme-controls [data-mono="${e.target.dataset.token}"]`).textContent = e.target.value;
    }));
    $('#css-override').value = localStorage.getItem('aa.css') || '/* Drop CSS here. Example:\n.tab.active { background: var(--violet); color: #fff; }\n*/';

    // logo upload preview
    const savedLogo = localStorage.getItem('aa.customLogo');
    if (savedLogo) {
      $('#logo-preview').style.backgroundImage = `url("${savedLogo}")`;
    }
    const upload = $('#logo-upload');
    if (upload && !upload.dataset.bound) {
      upload.dataset.bound = '1';
      upload.addEventListener('change', e => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 500_000) { alert('Too big — under 500KB please.'); return; }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          localStorage.setItem('aa.customLogo', dataUrl);
          $('#logo-preview').style.backgroundImage = `url("${dataUrl}")`;
          // apply live to admin page logo
          document.querySelectorAll('.brand .logo').forEach(l => { l.classList.add('custom'); l.style.setProperty('--custom-logo', `url("${dataUrl}")`); });
        };
        reader.readAsDataURL(file);
      });
    }

    // animation picker
    const savedAnim = localStorage.getItem('aa.anim') || 'aa-fade-up';
    const savedDur  = localStorage.getItem('aa.animDur') || '550';
    $('#anim-pick').value = savedAnim;
    $('#anim-dur').value  = savedDur;
    document.documentElement.style.setProperty('--enter-anim', savedAnim);
    document.documentElement.style.setProperty('--enter-dur',  savedDur + 'ms');
  }
  // anim picker handlers
  document.addEventListener('click', e => {
    if (e.target.id === 'anim-save') {
      const v = $('#anim-pick').value, d = $('#anim-dur').value;
      localStorage.setItem('aa.anim', v); localStorage.setItem('aa.animDur', d);
      document.documentElement.style.setProperty('--enter-anim', v);
      document.documentElement.style.setProperty('--enter-dur',  d + 'ms');
      alert('Saved. The public site will use it on next render.');
    }
    if (e.target.id === 'anim-preview') {
      const v = $('#anim-pick').value, d = $('#anim-dur').value;
      document.documentElement.style.setProperty('--enter-anim', v);
      document.documentElement.style.setProperty('--enter-dur',  d + 'ms');
      const stage = $('#anim-stage');
      stage.classList.remove('anim-stagger'); void stage.offsetWidth; stage.classList.add('anim-stagger');
      stage.querySelectorAll('.preview-card').forEach(c => { c.classList.remove('anim-enter'); void c.offsetWidth; c.classList.add('anim-enter'); });
    }
    if (e.target.id === 'logo-shuffle-now' && window.AA_LOGO) window.AA_LOGO.shuffle();
    if (e.target.id === 'logo-clear') {
      localStorage.removeItem('aa.customLogo');
      $('#logo-preview').style.backgroundImage = '';
      document.querySelectorAll('.brand .logo').forEach(l => { l.classList.remove('custom'); l.style.removeProperty('--custom-logo'); });
    }
    if (e.target.id === 'logo-pause') {
      // simple pause: re-toggle a flag the logo loop checks via localStorage (logo.js doesn't currently honor it; lightweight approach for the demo)
      const cur = localStorage.getItem('aa.logoPaused') === '1';
      localStorage.setItem('aa.logoPaused', cur ? '0' : '1');
      e.target.textContent = cur ? 'Pause rotation' : 'Resume rotation';
    }
  });
  $('#theme-save').addEventListener('click', () => {
    const t = {};
    $$('#theme-controls input[type=color]').forEach(i => t[i.dataset.token] = i.value);
    localStorage.setItem('aa.theme', JSON.stringify(t));
    Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
    alert('Theme saved — public site will use it on next load.');
  });
  $('#theme-reset').addEventListener('click', () => {
    localStorage.removeItem('aa.theme');
    location.reload();
  });
  $('#css-save').addEventListener('click', () => {
    localStorage.setItem('aa.css', $('#css-override').value);
    alert('CSS overrides saved.');
  });

  // ---- AI ----------------------------------------------------------------
  function renderAI () {
    const cfg = AA.cfg().ai;
    $('#ai-provider').value = cfg.provider;
    $('#ai-model').value    = cfg.model;
    $('#ai-endpoint').value = cfg.endpoint;
  }
  $('#ai-save').addEventListener('click', () => {
    const ai = { provider: $('#ai-provider').value, model: $('#ai-model').value, endpoint: $('#ai-endpoint').value };
    AA.setConfig({ ai: Object.assign({}, AA.cfg().ai, ai) });
    alert('AI provider saved. Public site will use it on next chat.');
  });
  $('#aw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const q = $('#aw-input').value.trim(); if (!q) return;
    push('user', q); $('#aw-input').value = '';
    const ans = await AA_AI.ask(q, []);
    push('bot', ans);
  });
  function push (who, text) {
    const m = document.createElement('div');
    m.className = 'chat-msg ' + who;
    m.textContent = text;
    $('#aw-body').appendChild(m);
    $('#aw-body').scrollTop = $('#aw-body').scrollHeight;
  }

  // ---- demo reset --------------------------------------------------------
  $('#seed-demo').addEventListener('click', () => {
    if (!confirm('Reset all demo data (mail list, posts, pledges, applications)?')) return;
    ['aa.mailing','aa.posts','aa.pledges','aa.amb_apps','aa.promos','aa.grants','aa.theme','aa.css'].forEach(k => localStorage.removeItem(k));
    location.reload();
  });

  // ---- boot --------------------------------------------------------------
  const roleTag = $('#role-tag'); if (roleTag) roleTag.textContent = 'role: ' + (AA.getRole() || 'admin');
  renderDashboard();
})();
