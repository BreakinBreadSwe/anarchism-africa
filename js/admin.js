/* ANARCHISM.AFRICA — Studio (CMS backend)
 * Tabs, content tables, theme editor, AI workbench.
 * All data stored in localStorage in the demo; switches to Supabase/Neon
 * automatically when AA_CONFIG.backend is changed.
 */
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---- tabs --------------------------------------------------------------
  // Persist last visited tab + scroll position per-tab in localStorage so a
  // refresh / re-open lands the editor exactly where they left off. Scroll
  // is stored before the next setTab fires so we capture the current page
  // before navigating away.
  const TAB_KEY    = 'aa.admin.tab';
  const SCROLL_KEY = 'aa.admin.scroll';
  let _lastTab = 'dashboard';
  let _currentTab = null;
  function saveScroll () {
    if (!_currentTab) return;
    try {
      const map = JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}');
      map[_currentTab] = window.scrollY || document.documentElement.scrollTop || 0;
      localStorage.setItem(SCROLL_KEY, JSON.stringify(map));
    } catch {}
  }
  function restoreScroll (name) {
    try {
      const map = JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}');
      const y = map[name] || 0;
      // Defer so the view has actually rendered before we scroll. Two
      // rAFs cover both DOM mutation and layout flush.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    } catch {}
  }
  // Throttled scroll persistence so we don't hammer localStorage on every pixel.
  let _scrollTimer = null;
  window.addEventListener('scroll', () => {
    if (_scrollTimer) return;
    _scrollTimer = setTimeout(() => { _scrollTimer = null; saveScroll(); }, 250);
  }, { passive: true });
  function setTab (name) {
    saveScroll();
    // Leaving the Studio → autosave + close before painting the next
    // tab. The Studio remembers what it was working on via the session
    // id stashed in localStorage, so returning restores the design.
    if (_currentTab === 'studio' && name !== 'studio') {
      try { window.MerchStudio?.autosaveAndClose?.(); } catch {}
      const view = document.getElementById('view-studio');
      if (view) view.innerHTML = '';   // release DOM + canvas refs
      // Belt-and-braces: force-hide the fixed overlay in case autosaveAndClose
      // fails (e.g. no layers → early return). Studio overlay lives OUTSIDE
      // view-studio so clearing the view container doesn't unmount it.
      try { document.getElementById('ms-overlay')?.classList.remove('open'); } catch {}
    }
    if (name !== 'studio') _lastTab = name;
    _currentTab = name;
    try { localStorage.setItem(TAB_KEY, name); } catch {}
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
    if (name === 'hero')         window.AfricaHeroCMS?.render(document.getElementById('view-hero'));
    if (name === 'marklab')      window.MarkLab?.render();
    if (name === 'articlelab')   window.ArticleLab?.render();
    if (name === 'studio') { window.MerchStudio?.render({ prevTab: _lastTab }); return; }
    // 'pod' tab removed 2026-06 — merged into 'merch'. Redirect any
    // saved-tab pointers or stale hash links so users land on the merged page.
    if (name === 'pod')    { setTab('merch'); return; }
    restoreScroll(name);
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

  // ---- Ingest URLs form -------------------------------------------------
  function statusPill (el, msg, cls) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'aa-cms-status' + (cls ? ' ' + cls : '');
    if (cls === 'ok') setTimeout(() => { if (el.classList.contains('ok')) { el.textContent = ''; el.className = 'aa-cms-status'; } }, 3200);
  }
  const ingestFireBtn = $('#ingest-urls-fire');
  ingestFireBtn?.addEventListener('click', async () => {
    const input = $('#ingest-urls-input');
    const status = $('#ingest-urls-status');
    const urls = (input?.value || '').split(/\r?\n/).map(s => s.trim()).filter(s => /^https?:\/\//.test(s));
    if (!urls.length) { statusPill(status, 'Paste at least one URL', 'err'); return; }
    statusPill(status, `Ingesting ${urls.length} URL${urls.length !== 1 ? 's' : ''}…`, 'busy');
    try {
      const r = await fetch('/api/content/ingest-urls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, kind: contentKind === 'song' ? 'song' : contentKind === 'film' ? 'film' : 'article' })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { statusPill(status, `Failed: ${d?.error || r.status}`, 'err'); return; }
      statusPill(status, `Inserted ${d.inserted || 0}, skipped ${d.skipped_existing || 0}${d.errors?.length ? `, ${d.errors.length} errors` : ''}`, 'ok');
      input.value = '';
      renderContent(contentKind);
    } catch (e) {
      statusPill(status, 'Network error: ' + (e.message || e).slice(0, 80), 'err');
    }
  });

  // ---- Scrape-topic form (AI-assisted URL discovery + review) ----------
  const scrapeForm = $('#scrape-topic-form');
  scrapeForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status  = $('#scrape-topic-status');
    const results = $('#scrape-topic-results');
    const topic   = scrapeForm.topic.value.trim();
    const count   = Number(scrapeForm.count.value) || 8;
    if (!topic) { statusPill(status, 'Enter a topic', 'err'); return; }
    statusPill(status, 'Asking AI for source URLs…', 'busy');
    results.innerHTML = '';
    try {
      const r = await fetch('/api/admin/find-urls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { statusPill(status, `Failed: ${d?.error || r.status}`, 'err'); return; }
      const list = d.urls || [];
      if (!list.length) { statusPill(status, 'AI returned no URLs — try a different topic', 'err'); return; }
      statusPill(status, `${list.length} candidates ready`, 'ok');
      results.innerHTML = `
        <div style="border:1px solid var(--line);padding:10px;background:var(--bg-2);margin-top:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
            <label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="scrape-selectall" checked /> Select all</label>
            <button class="btn primary" id="scrape-ingest-selected" type="button">Ingest selected →</button>
          </div>
          ${list.map((u, i) => `
            <label style="display:flex;gap:8px;padding:6px 4px;border-top:1px dashed var(--line);align-items:flex-start">
              <input type="checkbox" data-scrape-url="${escapeAttr(u.url)}" checked style="margin-top:3px" />
              <div style="flex:1;min-width:0">
                <a href="${escapeAttr(u.url)}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;word-break:break-all">${escapeHtml(u.url)}</a>
                <div style="color:var(--fg-dim);font-size:.78rem;margin-top:2px">${escapeHtml(u.why || '')}</div>
              </div>
            </label>`).join('')}
        </div>`;
      $('#scrape-selectall').addEventListener('change', (e) => {
        results.querySelectorAll('[data-scrape-url]').forEach(cb => { cb.checked = e.target.checked; });
      });
      $('#scrape-ingest-selected').addEventListener('click', async () => {
        const picked = [...results.querySelectorAll('[data-scrape-url]:checked')].map(cb => cb.dataset.scrapeUrl);
        if (!picked.length) { statusPill(status, 'Nothing selected', 'err'); return; }
        statusPill(status, `Ingesting ${picked.length}…`, 'busy');
        const r2 = await fetch('/api/content/ingest-urls', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: picked, kind: 'article' })
        });
        const d2 = await r2.json().catch(() => ({}));
        if (!r2.ok) { statusPill(status, `Failed: ${d2?.error || r2.status}`, 'err'); return; }
        statusPill(status, `Inserted ${d2.inserted || 0}${d2.errors?.length ? `, ${d2.errors.length} errors` : ''}`, 'ok');
        results.innerHTML = '';
        renderContent(contentKind);
      });
    } catch (e) {
      statusPill(status, 'Network error: ' + (e.message || e).slice(0, 80), 'err');
    }
  });

  // ---- AI compose form (end-to-end draft with brief + links + media) ---
  // Media state — files the user picked but haven't uploaded yet, and
  // the Blob URLs once they're up. Re-rendered into the tag list on
  // every change.
  const composeForm = $('#ai-compose-form');
  const composeMediaInput = $('#ai-compose-media');
  const composeMediaList  = $('#ai-compose-media-list');
  let composeMedia = [];   // array of { name, type, url? , error? }

  function paintComposeMedia () {
    if (!composeMediaList) return;
    if (!composeMedia.length) { composeMediaList.innerHTML = ''; return; }
    composeMediaList.innerHTML = composeMedia.map((m, i) => `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:${m.error?'#3a1010':'var(--bg-2)'};border:1px solid ${m.error?'#ef4444':'var(--line)'};font-size:.72rem;max-width:220px">
        <span style="color:${m.error?'#ef4444':'var(--fg)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${m.error?'✗ ':''}${escapeHtml(m.name)}</span>
        ${m.url ? '<span style="color:#22c55e">✓</span>' : m.error ? `<span title="${escapeAttr(m.error)}" style="color:#ef4444">!</span>` : '<span style="color:var(--fg-dim)">…</span>'}
        <button type="button" data-compose-media-rm="${i}" style="background:none;border:0;color:var(--fg-dim);cursor:pointer;padding:0 2px">×</button>
      </div>`).join('');
    composeMediaList.querySelectorAll('[data-compose-media-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        composeMedia.splice(Number(btn.dataset.composeMediaRm), 1);
        paintComposeMedia();
      });
    });
  }
  composeMediaInput?.addEventListener('change', async () => {
    const files = Array.from(composeMediaInput.files || []);
    if (!files.length) return;
    // Reuse the direct-to-Blob uploader the hero-CMS uses. Load it once.
    if (!window._aaBlobClient) {
      try { window._aaBlobClient = await import('https://esm.sh/@vercel/blob@0.27.0/client'); }
      catch (e) { alert('Could not load Blob uploader: ' + (e.message || e)); return; }
    }
    const { upload } = window._aaBlobClient;
    for (const f of files) {
      const idx = composeMedia.push({ name: f.name, type: f.type || 'application/octet-stream' }) - 1;
      paintComposeMedia();
      const safe = (f.name || 'upload.bin').replace(/[^\w.\-]+/g, '_').slice(0, 120);
      const key  = `article-media/${Date.now()}-${safe}`;
      try {
        const blob = await upload(key, f, { access: 'public', handleUploadUrl: '/api/africa-slides/upload', contentType: f.type });
        composeMedia[idx].url = blob.url;
      } catch (e) {
        composeMedia[idx].error = String(e.message || e).slice(0, 120);
      }
      paintComposeMedia();
    }
    composeMediaInput.value = '';
  });

  composeForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = $('#ai-compose-status');
    const topic  = composeForm.topic.value.trim();
    const angle  = composeForm.angle.value.trim();
    const brief  = composeForm.brief.value.trim();
    const links  = composeForm.links.value.split(/\r?\n/).map(s => s.trim()).filter(s => /^https?:\/\//.test(s));
    const length = composeForm.length.value;
    const grounded = composeForm.grounded.checked;
    const media = composeMedia.filter(m => m.url).map(m => ({ url: m.url, type: m.type, name: m.name }));
    if (!topic) { statusPill(status, 'Enter a topic', 'err'); return; }
    if (composeMedia.some(m => !m.url && !m.error)) {
      statusPill(status, 'Media still uploading — wait a moment', 'err');
      return;
    }
    statusPill(status, 'Composing (~30–90s)…', 'busy');
    try {
      const r = await fetch('/api/ai/article', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'compose',
          payload: { topic, angle, brief, references: links, media, length, grounded }
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { statusPill(status, `Failed: ${d?.error || r.status}`, 'err'); return; }
      const art = d.article;
      if (!art) { statusPill(status, 'No article returned', 'err'); return; }
      statusPill(status, 'Draft ready — opening editor', 'ok');
      if (window.AdminEditor?.openDraft) {
        window.AdminEditor.openDraft('article', art, () => renderContent('article'));
      } else if (window.AdminEditor?.open) {
        window.AdminEditor.open('article', null, () => renderContent('article'), art);
      } else {
        try { await navigator.clipboard.writeText(JSON.stringify(art, null, 2)); statusPill(status, 'Draft copied to clipboard (editor not available)', 'ok'); } catch {}
      }
    } catch (e) {
      statusPill(status, 'Network error: ' + (e.message || e).slice(0, 80), 'err');
    }
  });

  function escapeHtml (s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttr (s) { return escapeHtml(s); }

  // ---- MERCH -------------------------------------------------------------
  // Single merged POD view: combines the curated eco metadata from
  // AA_CONFIG.pod_providers (eco score, certifications, marketing name)
  // with the live API status from /api/pod/overview (connection, shop
  // count, features, products, print areas, formats, env var name, docs).
  //
  // Replaces the two former pages: 'Print-on-demand providers' (curated
  // marketing list — always showed 'connected') and 'POD Connect' (API
  // overview — had real status but no eco data).
  const POD_SLUG_TO_ID = {
    stanley_stella: 'printful',  // Stanley/Stella organic cotton fulfilled via Printful API
    teemill:        'teemill',
    fairshare:      null,         // no proxy yet
    ohh_deer:       null,         // no proxy yet
    gelato:         'gelato'
  };
  let _podFilter = 'all';
  async function renderMerch () {
    const providers = (window.AA_CONFIG?.pod_providers) || [];
    let statusById = {};
    try {
      const r = await fetch('/api/pod/overview');
      if (r.ok) {
        const data = await r.json();
        for (const s of (data.services || [])) statusById[s.id] = s;
      }
    } catch {}

    /* Build a unified row per provider: curated eco metadata + live API
       data merged. Providers without a backing proxy get state='pending'. */
    const rows = providers.map(p => {
      const id = POD_SLUG_TO_ID[p.slug];
      const live = id ? statusById[id] : null;
      let state = 'unknown';
      if (!id) state = 'pending';
      else if (live?.connected) state = 'connected';
      else if (live) state = 'disconnected';
      return { p, id, live, state };
    });
    // Sort: connected first, then highest eco score, then pending, then disconnected.
    const stateRank = { connected: 0, disconnected: 1, pending: 2, unknown: 3 };
    rows.sort((a, b) => {
      const sa = stateRank[a.state] - stateRank[b.state];
      return sa !== 0 ? sa : (b.p.eco || 0) - (a.p.eco || 0);
    });

    const filtered = rows.filter(r => {
      if (_podFilter === 'connected') return r.state === 'connected';
      if (_podFilter === 'pending')   return r.state === 'pending' || r.state === 'disconnected';
      if (_podFilter === 'eco')       return (r.p.eco || 0) >= 90;
      return true;
    });

    const VERCEL_ENV_URL = 'https://vercel.com/breakinbreadswes-projects/anarchism-africa/settings/environment-variables';
    const cards = filtered.map(({ p, live, state }) => {
      // Pill colour + label per state.
      const pill = state === 'connected'
        ? `<span style="padding:3px 10px;border-radius:99px;font-size:.7rem;font-weight:700;letter-spacing:.1em;background:rgba(46,204,113,.15);color:var(--green,#2ecc71);border:1px solid rgba(46,204,113,.3)">● CONNECTED${live.shopCount ? ' · ' + live.shopCount + ' shop' + (live.shopCount > 1 ? 's' : '') : ''}</span>`
        : state === 'disconnected'
        ? `<span style="padding:3px 10px;border-radius:99px;font-size:.7rem;font-weight:700;letter-spacing:.1em;background:rgba(251,191,36,.10);color:var(--amber,#fbbf24);border:1px solid rgba(251,191,36,.3)">○ NOT CONNECTED</span>`
        : state === 'pending'
        ? '<span style="padding:3px 10px;border-radius:99px;font-size:.7rem;font-weight:700;letter-spacing:.1em;background:rgba(255,255,255,.06);color:var(--muted);border:1px solid var(--line)">⚙ PROXY PENDING</span>'
        : '<span style="padding:3px 10px;border-radius:99px;font-size:.7rem;color:var(--muted);opacity:.7">status unknown</span>';
      // Border colour as a left strip — visual sort by state.
      const borderColor = state === 'connected' ? 'var(--green,#2ecc71)'
                        : state === 'disconnected' ? 'var(--amber,#fbbf24)'
                        : 'var(--line)';
      const features = (live?.features || []).map(f =>
        `<span style="padding:2px 8px;border-radius:4px;font-size:.66rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:rgba(255,215,0,.08);color:var(--accent);border:1px solid rgba(255,215,0,.18)">${f}</span>`
      ).join('');
      const certs = (p.cert || []).map(c =>
        `<span class="eco-tag">${c}</span>`
      ).join(' ');
      const productsLine = live ? `<div><span class="mono" style="color:var(--muted);font-size:.62rem">PRODUCTS</span><br>${live.products.join(', ')}</div>` : '';
      const areasLine    = live ? `<div><span class="mono" style="color:var(--muted);font-size:.62rem">PRINT AREAS</span><br>${live.printAreas.join(', ')}</div>` : '';
      const formatsLine  = live ? `<div><span class="mono" style="color:var(--muted);font-size:.62rem">FORMATS</span><br>${live.fileFormats.join(', ')}</div>` : '';

      // Action buttons differ per state.
      let actions = '';
      if (state === 'connected') {
        actions = `
          <button class="btn primary" data-pod-sync="${live.id}" style="font-size:.72rem;padding:6px 12px">Sync SKUs</button>
          <button class="btn ghost" data-pod-open-merchlab="1" style="font-size:.72rem;padding:6px 12px">Open in Merch Lab →</button>
          <a class="btn ghost" href="${live.docs}" target="_blank" rel="noopener" style="font-size:.72rem;padding:6px 12px">API docs ↗</a>`;
      } else if (state === 'disconnected') {
        actions = `
          <a class="btn primary" href="${VERCEL_ENV_URL}" target="_blank" rel="noopener" style="font-size:.72rem;padding:6px 12px" title="Set ${live.envVar} in Vercel env">Set up ↗</a>
          <code style="font-size:.7rem;color:var(--muted);padding:6px 8px;background:var(--bg);border:1px solid var(--line);border-radius:6px">${live.envVar}</code>
          <a class="btn ghost" href="${live.docs}" target="_blank" rel="noopener" style="font-size:.72rem;padding:6px 12px">API docs ↗</a>`;
      } else if (state === 'pending') {
        actions = '<span class="mono" style="font-size:.7rem;color:var(--muted)">proxy not built yet — open an issue to prioritise</span>';
      }

      return `
        <div class="panel" style="border-left:3px solid ${borderColor};padding:14px 16px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div style="min-width:0">
              <b style="font-size:1rem">${p.name}</b>
              ${live ? `<span class="mono" style="font-size:.66rem;color:var(--muted);margin-left:8px">${live.endpoint}</span>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <span style="display:inline-flex;align-items:center;gap:4px;font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace">
                <span style="display:inline-block;width:34px;height:6px;background:linear-gradient(90deg,${p.eco>=90?'#22c55e':p.eco>=80?'#a3e635':'#facc15'} ${p.eco}%, var(--line) ${p.eco}%);border-radius:99px"></span>
                ECO ${p.eco}
              </span>
              ${pill}
            </div>
          </div>
          ${certs ? `<div style="margin-bottom:10px">${certs}</div>` : ''}
          ${features ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${features}</div>` : ''}
          ${live ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:.76rem;margin-bottom:12px">${productsLine}${areasLine}${formatsLine}</div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${actions}</div>
        </div>`;
    }).join('');

    const host = document.getElementById('pod-cards');
    if (host) host.innerHTML = cards || '<p style="color:var(--muted)">No providers match this filter.</p>';

    // Filter chips — bind once.
    document.querySelectorAll('.aa-pod-filter').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        _podFilter = btn.dataset.podf;
        document.querySelectorAll('.aa-pod-filter').forEach(b => b.classList.toggle('active', b === btn));
        renderMerch();
      });
    });
    // Action button delegation — Sync SKUs + Open in Merch Lab.
    if (host && !host.dataset.bound) {
      host.dataset.bound = '1';
      host.addEventListener('click', (e) => {
        const sync = e.target.closest('[data-pod-sync]');
        if (sync) {
          window.alert('Sync SKUs flow not wired yet — for now, push individual designs via Merch Lab.');
          return;
        }
        const ml = e.target.closest('[data-pod-open-merchlab]');
        if (ml) { document.querySelector('.rail-item[data-tab=merchlab]')?.click(); return; }
      });
    }
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

  // ---- USERS — delegated to js/admin-users.js ----------------------------
  function renderUsers () {
    // admin-users.js auto-loads on DOMContentLoaded (session-cookie auth).
    // Re-fetch each time the tab is activated so data stays fresh.
    window.AdminUsers?.loadUsers();
    window.AdminUsers?.loadPasscodes();
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
    const defaults = { bg: '#0a0a0a', fg: '#f5f0e8', accent: '#FFD700', red: '#C8102E', green: '#007749', violet: '#8B00FF', teal: '#00FFE0', 'logo-bg': '#242424' };
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

  // ---- POD Connect -------------------------------------------------------
  function renderPOD () {
    const btn = document.getElementById('pod-load-btn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const grid = document.getElementById('pod-overview');
      grid.innerHTML = '<p style="color:var(--muted)">Loading…</p>';
      try {
        const r = await fetch('/api/pod/overview');
        const data = await r.json();
        grid.innerHTML = (data.services || []).map(svc => `
          <div class="panel" style="border-left:3px solid ${svc.connected ? 'var(--green,#2ecc71)' : 'var(--line)'}">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
              <div>
                <b style="font-size:1.05rem">${svc.name}</b>
                <span class="mono" style="font-size:.7rem;color:var(--muted);margin-left:10px">${svc.endpoint}</span>
              </div>
              <span style="padding:3px 10px;border-radius:99px;font-size:.7rem;font-weight:700;letter-spacing:.1em;background:${svc.connected ? 'rgba(46,204,113,.15)' : 'rgba(255,255,255,.06)'};color:${svc.connected ? 'var(--green,#2ecc71)' : 'var(--muted)'};border:1px solid ${svc.connected ? 'rgba(46,204,113,.3)' : 'var(--line)'}">
                ${svc.connected ? '● CONNECTED' + (svc.shopCount ? ` · ${svc.shopCount} shop${svc.shopCount > 1 ? 's' : ''}` : '') : '○ NOT CONNECTED'}
              </span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
              ${svc.features.map(f => `<span style="padding:2px 8px;border-radius:4px;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:rgba(255,215,0,.08);color:var(--accent);border:1px solid rgba(255,215,0,.18)">${f}</span>`).join('')}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:.78rem">
              <div><span class="mono" style="color:var(--muted);font-size:.66rem">PRODUCTS</span><br>${svc.products.join(', ')}</div>
              <div><span class="mono" style="color:var(--muted);font-size:.66rem">PRINT AREAS</span><br>${svc.printAreas.join(', ')}</div>
              <div><span class="mono" style="color:var(--muted);font-size:.66rem">FORMATS</span><br>${svc.fileFormats.join(', ')}</div>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${svc.connected ? '' : `<p class="mono" style="font-size:.72rem;color:var(--muted);margin:0">Set <code>${svc.envVar}</code> in Vercel env vars to connect.</p>`}
              <a class="btn ghost" href="${svc.docs}" target="_blank" rel="noopener" style="font-size:.72rem;padding:4px 10px">API docs ↗</a>
              ${svc.connected ? `<button class="btn primary" style="font-size:.72rem;padding:4px 10px" onclick="document.querySelector('.rail-item[data-tab=studio]')?.click()">Open Studio →</button>` : ''}
              ${svc.note ? `<span class="mono" style="font-size:.7rem;color:var(--muted)">${svc.note}</span>` : ''}
            </div>
          </div>`).join('');
      } catch (e) {
        document.getElementById('pod-overview').innerHTML = `<p style="color:var(--red,#e74c3c)">Error: ${e.message}</p>`;
      }
    });
  }

  // ---- demo reset --------------------------------------------------------
  $('#seed-demo').addEventListener('click', () => {
    if (!confirm('Reset all demo data (mail list, posts, pledges, applications)?')) return;
    ['aa.mailing','aa.posts','aa.pledges','aa.amb_apps','aa.promos','aa.grants','aa.theme','aa.css'].forEach(k => localStorage.removeItem(k));
    location.reload();
  });

  // ---- boot --------------------------------------------------------------
  const roleTag = $('#role-tag'); if (roleTag) roleTag.textContent = 'role: ' + (AA.getRole() || 'admin');
  // Restore the last visited tab from localStorage (set by setTab). Default
  // to dashboard on first visit or if the saved tab no longer exists in the
  // DOM. setTab() also restores scroll position via restoreScroll().
  let _initialTab = 'dashboard';
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved && document.getElementById('view-' + saved)) _initialTab = saved;
  } catch {}
  setTab(_initialTab);
  if (_initialTab === 'dashboard') renderDashboard();
})();
