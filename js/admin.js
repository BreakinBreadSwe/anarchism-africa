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
    if (name === 'articlelab')   window.ArticleLab?.render();
    if (name === 'merchlab')     window.MerchLab?.render();
    if (name === 'marklab')      window.MarkLab?.render();
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

    // Autopilot panel - kick the constant-content pipeline manually.
    let auto = document.getElementById('autopilot-panel');
    if (!auto) {
      auto = document.createElement('div');
      auto.id = 'autopilot-panel';
      auto.className = 'panel';
      auto.style.marginTop = '16px';
      auto.innerHTML = `
        <h3 style="margin:0 0 6px">Autopilot</h3>
        <p style="color:var(--fg-dim);max-width:65ch;margin:0 0 10px;font-size:.86rem">
          Scrape feeds, draft an article on the trending theme, top up the slogan
          and mark queues. Idempotent - safe to re-run. Underlying handlers skip
          recently-covered work. Cron also runs these stages daily (06/09/12/15 UTC).
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
          <button class="btn" data-auto="all">Run all stages</button>
          <button class="btn ghost" data-auto="scrape">Scrape only</button>
          <button class="btn ghost" data-auto="articles">Draft article</button>
          <button class="btn ghost" data-auto="slogans">Top up slogans</button>
          <button class="btn ghost" data-auto="logos">Top up marks</button>
        </div>
        <pre id="autopilot-out" class="mono" style="margin:0;padding:10px;background:var(--bg-2);border:1px solid var(--line);border-radius:8px;font-size:.78rem;max-height:240px;overflow:auto;white-space:pre-wrap">Idle.</pre>`;
      $('#view-dashboard')?.appendChild(auto);
      auto.addEventListener('click', async e => {
        const b = e.target.closest('button[data-auto]');
        if (!b) return;
        const stage = b.dataset.auto;
        const out = document.getElementById('autopilot-out');
        out.textContent = `Running ${stage}...`;
        try {
          const url = stage === 'all' ? '/api/autopilot/run' : `/api/autopilot/run?only=${stage}`;
          const r = await fetch(url, { method: 'POST' });
          const j = await r.json();
          out.textContent = JSON.stringify(j, null, 2);
        } catch (err) {
          out.textContent = 'Error: ' + (err.message || err);
        }
      });
    }
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
  $('#content-new').addEventListener('click', () => window.AdminEditor && window.AdminEditor.open(contentKind, null, () => renderContent(contentKind)));
  // Edit button delegation — every Edit button calls AdminEditor with the item id
  $('#content-rows').addEventListener('click', e => {
    const b = e.target.closest('[data-edit]'); if (!b) return;
    window.AdminEditor && window.AdminEditor.open(contentKind, b.dataset.edit, () => renderContent(contentKind));
  });

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
    window.AA_LIVE.toast('Newsletter queued. Hooks into Mailchimp / Resend / Listmonk via /api/mailing/send.', 'ok');
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
      window.AA_LIVE.toast('Ambassador approved. Invite emailed.', 'ok');
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
    loadEnvStatus();
  }

  async function loadEnvStatus () {
    const host = document.getElementById('env-table');
    if (!host) return;
    host.innerHTML = '<span style="color:var(--muted)">Checking deployment...</span>';
    try {
      const r = await fetch('/api/system/env-status', { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      renderEnvTable(host, data.vars || []);
    } catch (e) {
      host.innerHTML = '<span style="color:var(--red,#C8102E)">Could not load env status: ' + (e.message || e) + '</span>';
    }
  }

  function renderEnvTable (host, vars) {
    const groups = {};
    for (const v of vars) (groups[v.group] = groups[v.group] || []).push(v);
    const order = ['LLM','Media','POD','Storage','Auth','Platform'];
    const html = order.filter(g => groups[g]).map(g => `
      <div style="margin-bottom:14px">
        <div style="font:600 .72rem 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-dim);margin-bottom:6px">${g}</div>
        <table style="width:100%;border-collapse:collapse;font-family:'JetBrains Mono',monospace;font-size:.78rem">
          <thead>
            <tr style="border-bottom:1px solid var(--line);text-align:left">
              <th style="padding:6px 8px;width:32px"></th>
              <th style="padding:6px 8px">KEY</th>
              <th style="padding:6px 8px">USED FOR</th>
              <th style="padding:6px 8px;text-align:right">GET KEY</th>
            </tr>
          </thead>
          <tbody>
            ${groups[g].map(v => `
              <tr style="border-bottom:1px solid var(--line)">
                <td style="padding:8px;text-align:center">${v.set
                  ? `<span title="set (${v.length} chars)" style="color:var(--green,#0a0);font-weight:700">●</span>`
                  : `<span title="missing" style="color:var(--red,#C8102E);font-weight:700">○</span>`}</td>
                <td style="padding:8px"><code style="background:var(--bg-2);padding:2px 6px;border:1px solid var(--line);border-radius:4px;cursor:pointer" data-copy="${v.key}" title="Click to copy">${v.key}</code></td>
                <td style="padding:8px;font-family:'Space Grotesk',sans-serif;color:var(--fg-dim)">${escapeHTML(v.label)}</td>
                <td style="padding:8px;text-align:right">
                  ${v.signup ? `<a class="btn ghost" style="font-size:.7rem;padding:4px 8px" href="${escapeHTML(v.signup)}" target="_blank" rel="noopener">Sign up</a>` : ''}
                  ${v.doc ? `<a class="btn ghost" style="font-size:.7rem;padding:4px 8px" href="${/^https?:/.test(v.doc) ? escapeHTML(v.doc) : '#'}" target="_blank" rel="noopener">${/^https?:/.test(v.doc) ? 'Get key' : escapeHTML(v.doc)}</a>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');
    const summary = (() => {
      const set = vars.filter(v => v.set).length;
      return `<div style="margin-bottom:10px;color:var(--fg-dim);font-family:'Space Grotesk',sans-serif;font-size:.86rem">
        <b>${set}</b> of <b>${vars.length}</b> environment variables set.
        Filled rows are good to go; empty ones turn off the feature they back.
      </div>`;
    })();
    host.innerHTML = summary + html;
    host.querySelectorAll('[data-copy]').forEach(el => el.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(el.dataset.copy); el.style.background = 'var(--green,#0a0)'; el.style.color = '#fff'; setTimeout(() => { el.style.background = 'var(--bg-2)'; el.style.color = ''; }, 700); } catch {}
    }));
  }

  function escapeHTML (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  document.addEventListener('click', e => {
    if (e.target && e.target.id === 'env-refresh') loadEnvStatus();
  });
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
