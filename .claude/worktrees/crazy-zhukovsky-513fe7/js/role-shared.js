/* ANARCHISM.AFRICA — shared role-page helpers
 * Used by publisher.html, market.html, partner.html, anarchist.html
 * Provides: rail/bottombar wiring, search, common views (grants/ambassadors/mailing/promo/ai)
 */
(function () {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const RoleShared = {
    boot ({ role, views }) {
      this.views = Object.assign({}, this.views, views || {});
      this.role = role;

      // rail toggle
      const rail = $('#rail');
      $('#menu-toggle')?.addEventListener('click', () => {
        rail.classList.contains('expanded')
          ? (rail.classList.remove('expanded'), document.body.classList.remove('rail-open'))
          : (rail.classList.add('expanded'),    document.body.classList.add('rail-open'));
      });
      $('#rail-backdrop')?.addEventListener('click', () => { rail.classList.remove('expanded'); document.body.classList.remove('rail-open'); });

      rail?.addEventListener('click', e => {
        const r = e.target.closest('.rail-item'); if (!r) return;
        $$('.rail-item').forEach(x => x.classList.toggle('active', x === r));
        this.show(r.dataset.view);
        if (matchMedia('(max-width:768px)').matches) { rail.classList.remove('expanded'); document.body.classList.remove('rail-open'); }
      });

      $('#bottombar')?.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.view) {
          $$('.rail-item').forEach(x => x.classList.toggle('active', x.dataset.view === b.dataset.view));
          this.show(b.dataset.view);
        }
        if (b.dataset.bbar === 'public') location.href = 'index.html';
        if (b.dataset.bbar === 'search') this.openSearch();
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') this.closeSearch();
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); this.openSearch(); }
      });

      // boot first view
      const initial = location.hash.replace('#','') || $$('.rail-item.active')[0]?.dataset.view || Object.keys(views)[0];
      this.show(initial);
    },

    async show (name) {
      const host = $('#role-views'); if (!host) return;
      host.innerHTML = '<div class="skeleton" style="min-height:200px"></div>';
      try {
        const fn = this.views[name];
        host.innerHTML = fn ? (await fn()) : `<div class="panel"><p>No view: ${name}</p></div>`;
        location.hash = name;
        // attach common form handlers
        host.querySelectorAll('form[data-form]').forEach(f => f.addEventListener('submit', this.onForm.bind(this)));
      } catch (e) { host.innerHTML = `<div class="panel"><p style="color:var(--red)">Error: ${e.message}</p></div>`; }
    },

    onForm (e) {
      e.preventDefault();
      const form = e.target;
      const kind = form.dataset.form;
      const data = Object.fromEntries(new FormData(form));
      if (kind === 'mail-add') AA.subscribe(data.email, data.name);
      if (kind === 'promo')    {
        const list = JSON.parse(localStorage.getItem('aa.promos') || '[]');
        list.unshift({ ...data, ts: Date.now() });
        localStorage.setItem('aa.promos', JSON.stringify(list));
      }
      window.AA_LIVE.toast('Saved.', 'ok');
      form.reset();
    },

    // ---- search modal ----
    async openSearch () {
      let m = $('#search-modal');
      if (!m) {
        m = document.createElement('div'); m.id = 'search-modal'; m.className = 'modal';
        m.innerHTML = `<div class="panel" style="max-width:680px"><div class="panel-body" style="padding:18px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <input id="search-input" placeholder="Search…" style="flex:1;padding:12px 16px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit;font-size:1rem"/>
            <button class="btn ghost" id="search-close">Esc</button>
          </div>
          <div id="search-results" style="display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto"></div>
        </div></div>`;
        document.body.appendChild(m);
        $('#search-close').addEventListener('click', () => this.closeSearch());
        $('#search-input').addEventListener('input', e => this.runSearch(e.target.value));
        m.addEventListener('click', e => { if (e.target === m) this.closeSearch(); });
      }
      m.classList.add('open'); document.body.style.overflow = 'hidden';
      setTimeout(() => $('#search-input').focus(), 50);
      this.runSearch('');
    },
    closeSearch () { $('#search-modal')?.classList.remove('open'); document.body.style.overflow = ''; },
    async runSearch (q) {
      const seed = await AA.loadSeed();
      const types = [
        ['film',    seed.films,           x => `${x.director} · ${x.duration}min`],
        ['article', seed.articles,        x => `${x.author} · ${x.reading_time}min`],
        ['event',   seed.events,          x => `${x.city}`],
        ['song',    seed.music,           x => `${x.artist}`],
        ['book',    seed.books,           x => `${x.author}`],
        ['merch',   seed.merch,           x => `€${x.price_eur}`],
        ['shop',    seed.external_shops,  x => `${x.city}, ${x.country}`],
        ['service', seed.services,        x => `${x.by} · ${x.rate}`],
        ['seminar', seed.seminars,        x => `${x.host}`],
        ['job',     seed.jobs,            x => `${x.org} · ${x.city}`],
        ['amb',     seed.ambassadors,     x => `${x.city}, ${x.country}`],
        ['grant',   seed.grants,          x => `${x.funder} · ${x.amount}`]
      ];
      const f = (q||'').toLowerCase().trim();
      const out = $('#search-results'); out.innerHTML = ''; let count = 0;
      types.forEach(([kind, list, sub]) => {
        (list || []).forEach(item => {
          if (!f || JSON.stringify(item).toLowerCase().includes(f)) {
            count++;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:10px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);cursor:pointer';
            row.innerHTML = `<span style="display:inline-block;font-size:.65rem;padding:2px 8px;border-radius:99px;background:var(--accent);color:var(--bg);font-weight:700;letter-spacing:.12em;text-transform:uppercase;flex:0 0 auto;align-self:flex-start">${kind}</span><div style="flex:1;min-width:0"><b style="display:block">${(item.title||item.name||item.funder||item.host||'')}</b><span style="color:var(--muted);font-size:.8rem">${sub(item)}</span></div>`;
            out.appendChild(row);
          }
        });
      });
      if (!count) out.innerHTML = '<p style="color:var(--muted);padding:20px;text-align:center">no match — try a different word.</p>';
    },

    // ---- shared view templates ----
    html: {
      panels (arr) { return arr.join(''); },
      tablePanel (title, headers, rows) {
        return `<div class="panel"><h3 style="margin:0 0 8px">${title}</h3><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      },
      kpis (items) {
        return `<div class="panel"><div class="kpi">${items.map(([k,v])=>`<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('')}</div></div>`;
      }
    },

    views: {
      async grants () {
        const seed = await AA.loadSeed();
        const stored = JSON.parse(localStorage.getItem('aa.grants') || '[]');
        const all = [...stored, ...seed.grants];
        return `<div class="panel">
          <h3 style="margin:0 0 8px">Grants tracker</h3>
          <p style="color:var(--fg-dim)">A.A.AI scans daily and alerts on deadlines.</p>
          <table><thead><tr><th>Funder</th><th>Title</th><th>Amount</th><th>Deadline</th><th>Status</th></tr></thead>
          <tbody>${all.map(g => `<tr><td><b>${g.funder}</b></td><td>${g.title}</td><td class="mono">${g.amount}</td><td class="mono">${g.deadline}</td><td><span class="status-pill ${g.status==='open'?'pending':'active'}">${g.status}</span></td></tr>`).join('')}</tbody></table>
        </div>
        <div class="panel">
          <h3 style="margin-top:0">Add a grant</h3>
          <form data-form="grant" style="display:grid;gap:8px;max-width:520px">
            <input name="funder" required placeholder="Funder"/>
            <input name="title" required placeholder="Title"/>
            <input name="amount" placeholder="Amount"/>
            <input name="deadline" type="date"/>
            <button class="btn primary" type="submit">Save</button>
          </form>
        </div>`;
      },
      async ambassadors () {
        const seed = await AA.loadSeed();
        const apps = JSON.parse(localStorage.getItem('aa.amb_apps') || '[]');
        return `<div class="panel">
          <h3 style="margin:0 0 8px">Ambassadors</h3>
          <table><thead><tr><th>Name</th><th>City</th><th>Status</th><th>Reach</th></tr></thead>
          <tbody>${seed.ambassadors.map(a => `<tr><td><b>${a.name}</b></td><td>${a.city}, ${a.country}</td><td><span class="status-pill ${a.status}">${a.status}</span></td><td>${a.reach||0}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="panel">
          <h3 style="margin-top:0">Pending applications (${apps.length})</h3>
          ${apps.length ? `<table><thead><tr><th>Name</th><th>Location</th><th>Pitch</th></tr></thead><tbody>${apps.map(a => `<tr><td><b>${a.name}</b></td><td>${a.location}</td><td>${a.pitch}</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--muted)">No pending applications.</p>'}
        </div>`;
      },
      async mailing () {
        const list = JSON.parse(localStorage.getItem('aa.mailing') || '[]');
        return `<div class="panel">
          <h3 style="margin:0 0 8px">Mailing list (${list.length})</h3>
          <table><thead><tr><th>Email</th><th>Name</th><th>Joined</th></tr></thead>
          <tbody>${list.length ? list.map(m=>`<tr><td>${m.email}</td><td>${m.name||''}</td><td class="mono" style="color:var(--muted)">${new Date(m.ts).toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="3" style="color:var(--muted)">No subscribers yet.</td></tr>'}</tbody></table>
        </div>
        <div class="panel">
          <h3 style="margin-top:0">Quick add</h3>
          <form data-form="mail-add" style="display:flex;gap:8px;max-width:520px;flex-wrap:wrap">
            <input name="email" type="email" required placeholder="email" style="flex:1;min-width:180px"/>
            <input name="name" placeholder="name (optional)" style="flex:1;min-width:140px"/>
            <button class="btn primary" type="submit">Add</button>
          </form>
        </div>`;
      },
      async promo () {
        const list = JSON.parse(localStorage.getItem('aa.promos') || '[]');
        return `<div class="panel">
          <h3 style="margin:0 0 8px">New campaign</h3>
          <form data-form="promo" style="display:grid;gap:8px;max-width:640px">
            <select name="kind"><option>newsletter</option><option>promo</option><option>event_push</option><option>crowdfund</option></select>
            <input name="subject" required placeholder="Subject"/>
            <textarea name="body" required style="min-height:80px">Salutations from the archive…</textarea>
            <input name="audience" value="all" placeholder="Audience"/>
            <button class="btn primary" type="submit">Send</button>
          </form>
        </div>
        <div class="panel">
          <h3 style="margin-top:0">Recent campaigns</h3>
          ${list.length ? `<table><thead><tr><th>Subject</th><th>Kind</th><th>Audience</th><th>Sent</th></tr></thead><tbody>${list.map(p=>`<tr><td><b>${p.subject}</b></td><td>${p.kind}</td><td>${p.audience}</td><td class="mono">${new Date(p.ts).toLocaleDateString()}</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--muted)">No campaigns yet.</p>'}
        </div>`;
      },
      async ai () {
        return `<div class="panel">
          <h3 style="margin:0 0 8px">A.A.AI workbench</h3>
          <p style="color:var(--fg-dim)">Draft content, find grants, scout collaborators, summarise the archive. Provider: ${(window.AA_CONFIG?.ai?.model)||'gemini-1.5-flash'}.</p>
          <div id="aw-body" style="display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto;padding:6px;border:1px solid var(--line);border-radius:10px;min-height:140px"></div>
          <form id="aw-form" style="display:flex;gap:8px;margin-top:8px">
            <input id="aw-input" placeholder="Find me 3 grants for diaspora reading circles…" style="flex:1;padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px"/>
            <button class="btn primary" type="submit">Ask</button>
          </form>
          <script>
            (function(){
              const f = document.getElementById('aw-form'); const inp = document.getElementById('aw-input'); const body = document.getElementById('aw-body');
              f?.addEventListener('submit', async e => {
                e.preventDefault(); const q = inp.value.trim(); if(!q) return;
                push('user', q); inp.value = '';
                const m = push('bot', '…'); const a = await window.AA_AI.ask(q, []); m.textContent = a;
              });
              function push(who, text){ const m = document.createElement('div'); m.className = 'chat-msg ' + who; m.textContent = text; body.appendChild(m); body.scrollTop = body.scrollHeight; return m; }
            })();
          <\/script>
        </div>`;
      },
      async pod () {
        const seed = await AA.loadSeed();
        const providers = (window.AA_CONFIG?.pod_providers) || [];
        return `<div class="panel">
          <h3 style="margin:0 0 8px">POD providers</h3>
          <table><thead><tr><th>Provider</th><th>Eco</th><th>Certifications</th></tr></thead>
          <tbody>${providers.map(p => `<tr><td><b>${p.name}</b></td><td class="mono">${p.eco}</td><td>${(p.cert||[]).join(' · ')}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="panel">
          <h3 style="margin-top:0">Catalogue</h3>
          <table><thead><tr><th>Product</th><th>Provider</th><th>Price</th><th>CO₂</th></tr></thead>
          <tbody>${seed.merch.map(m => `<tr><td><b>${m.title}</b></td><td>${m.provider}</td><td>€${m.price_eur}</td><td class="mono">${m.carbon_g}g</td></tr>`).join('')}</tbody></table>
        </div>`;
      },
      async services () {
        const seed = await AA.loadSeed();
        return `<div class="panel">
          <h3 style="margin:0 0 8px">Services posted</h3>
          <table><thead><tr><th>Title</th><th>By</th><th>Rate</th></tr></thead>
          <tbody>${seed.services.map(s => `<tr><td><b>${s.title}</b></td><td>${s.by} · ${s.city}</td><td>${s.rate}</td></tr>`).join('')}</tbody></table>
        </div>`;
      },
      async myStuff () {
        const mail = JSON.parse(localStorage.getItem('aa.mailing') || '[]');
        const apps = JSON.parse(localStorage.getItem('aa.amb_apps') || '[]');
        const pledges = JSON.parse(localStorage.getItem('aa.pledges') || '[]');
        const posts = JSON.parse(localStorage.getItem('aa.posts') || '[]');
        return RoleShared.html.kpis([
          ['Mailing', mail.length],
          ['My applications', apps.length],
          ['My pledges', pledges.length],
          ['My posts', posts.length]
        ]);
      }
    }
  };

  window.RoleShared = RoleShared;
})();
