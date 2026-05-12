/* ANARCHISM.AFRICA — Autopilot Panel
 *
 * Pipeline control dashboard for publisher / editor.
 * Shows the full cron pipeline status, lets you trigger individual stages,
 * run the full autopilot, and inspect source health.
 *
 * Mounts into #view-autopilot.
 * Loaded by publisher.html + editor.html.
 */
(function () {
  const $  = s => document.querySelector(s);
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const STAGES = [
    { key:'scrape',   label:'RSS Scan',          icon:'M3 7l7-4 7 4v10l-7 4-7-4z',              schedule:'06:00 UTC daily',   desc:'Fetches 35 curated RSS/Atom feeds, parses titles + summaries, scrapes og:image thumbnails, dedupes, queues new items.' },
    { key:'articles', label:'Article Generator',  icon:'M5 4h12a3 3 0 010 6H8a2 2 0 00-2 2v6a2 2 0 002 2h12', schedule:'09:00 UTC daily', desc:'Picks trending theme from queue, runs outline → grounded research → draft → polish → media pipeline. Stores result as pending draft for editor review.' },
    { key:'slogans',  label:'Slogan Generator',   icon:'M3 11l13-5v12L3 13z',                    schedule:'12:00 UTC daily',   desc:'Generates new afro-anarchist slogans and agitprop copy for Marketplace + community.' },
    { key:'logos',    label:'Logo Generator',     icon:'M12 3l9 7-9 7-9-7z',                     schedule:'15:00 UTC daily',   desc:'Generates new logo variants and visual identity iterations.' },
    { key:'verify',   label:'Link Verifier',      icon:'M9 12l2 2 4-4M5 12a7 7 0 1114 0 7 7 0 01-14 0', schedule:'03:00 UTC Sundays', desc:'HEAD-checks all external URLs in the catalogue, flags 404s and dead links for editor triage.' },
  ];

  const SOURCES = [
    { id:'africaisacountry', name:'Africa Is a Country', kind:'article', url:'https://africasacountry.com' },
    { id:'pambazuka',        name:'Pambazuka News',      kind:'article', url:'https://www.pambazuka.org' },
    { id:'roarmag',          name:'ROAR Magazine',       kind:'article', url:'https://roarmag.org' },
    { id:'crimethinc',       name:'CrimethInc.',         kind:'article', url:'https://crimethinc.com' },
    { id:'okayafrica',       name:'OkayAfrica',          kind:'article', url:'https://www.okayafrica.com' },
    { id:'afropunk',         name:'AFROPUNK',            kind:'article', url:'https://afropunk.com' },
    { id:'blackagendareport',name:'Black Agenda Report', kind:'article', url:'https://blackagendareport.com' },
    { id:'darajapress-blog', name:'Daraja Press',        kind:'article', url:'https://darajapress.com' },
    { id:'newframe',         name:'New Frame',           kind:'article', url:'https://www.newframe.com' },
    { id:'thefader',         name:'The FADER',           kind:'song',    url:'https://www.thefader.com' },
    { id:'wax-poetics',      name:'Wax Poetics',         kind:'song',    url:'https://www.waxpoetics.com' },
    { id:'soundway',         name:'Soundway Records',    kind:'song',    url:'https://www.soundwayrecords.com' },
    { id:'analog-africa',    name:'Analog Africa',       kind:'song',    url:'https://analogafrica.com' },
    { id:'habibi-funk',      name:'Habibi Funk',         kind:'song',    url:'https://habibifunk.com' },
    { id:'akpress',          name:'AK Press',            kind:'book',    url:'https://www.akpress.org' },
    { id:'haymarket',        name:'Haymarket Books',     kind:'book',    url:'https://www.haymarketbooks.org' },
    { id:'cassava-republic', name:'Cassava Republic',    kind:'book',    url:'https://www.cassavarepublic.biz' },
    { id:'fespaco',          name:'FESPACO',             kind:'film',    url:'https://www.fespaco.org' },
    { id:'mubi-notebook',    name:'MUBI Notebook',       kind:'film',    url:'https://mubi.com/notebook' },
    { id:'nyege-nyege',      name:'Nyege Nyege',         kind:'event',   url:'https://nyegenyege.com' },
  ];

  const KIND_COLOURS = {
    article:'var(--accent)', song:'#C8102E', book:'#006B3F', film:'#FFD700', event:'var(--muted)'
  };

  let state = { stats: null, log: null, loading: false };

  // ── template ────────────────────────────────────────────────────────────
  function template () {
    return `
      <div class="panel ap-header">
        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">
          <h2 style="margin:0">Autopilot Pipeline</h2>
          <span class="mono" style="font-size:.7rem;color:var(--muted)">Daily cron · 5 stages · 35 sources</span>
        </div>
        <p style="color:var(--fg-dim);max-width:68ch;margin:6px 0 14px;font-size:.9rem">
          The pipeline runs unattended every day. Scraped items land in the
          <b>Editorial Queue → Scraped</b> tab; AI drafts land in
          <b>Editorial Queue → AI Drafts</b>. Nothing is published without your approval.
          Use the buttons below to trigger any stage manually or run the full pipeline now.
        </p>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <button class="btn primary" id="ap-run-all">▶ Run full pipeline now</button>
          <button class="btn ghost"   id="ap-refresh">↻ Refresh stats</button>
          <span id="ap-status" class="mono" style="font-size:.75rem;color:var(--muted);align-self:center"></span>
        </div>
      </div>

      <div id="ap-stats-row" class="ap-stats-row">
        <div class="ap-stat-box"><div class="ap-stat-num" id="ap-n-scraped">—</div><div class="ap-stat-label mono">Scraped pending</div></div>
        <div class="ap-stat-box"><div class="ap-stat-num" id="ap-n-drafts">—</div><div class="ap-stat-label mono">AI drafts pending</div></div>
        <div class="ap-stat-box"><div class="ap-stat-num" id="ap-n-published">—</div><div class="ap-stat-label mono">Published this week</div></div>
        <div class="ap-stat-box"><div class="ap-stat-num">${SOURCES.length}</div><div class="ap-stat-label mono">Active sources</div></div>
      </div>

      <div class="ap-stages" id="ap-stages">
        ${STAGES.map(s => stageCard(s)).join('')}
      </div>

      <div class="panel" style="margin-top:14px">
        <h3 style="margin:0 0 12px" class="section-head-african">Source registry</h3>
        <p style="color:var(--fg-dim);font-size:.85rem;margin:0 0 10px">
          Adding or removing sources is a code-edit in <code>api/cron/scan-content.js</code>
          so the editorial line stays visible in the repository. All sources below are checked
          for liveness before queueing.
        </p>
        <div class="ap-sources-grid">
          ${SOURCES.map(s => `
            <div class="ap-source-row">
              <span class="ap-source-pip" style="background:${KIND_COLOURS[s.kind]||'var(--muted)'}"></span>
              <a href="${esc(s.url)}" target="_blank" rel="noopener" class="ap-source-name">${esc(s.name)}</a>
              <span class="ap-source-kind mono">${esc(s.kind)}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="panel" id="ap-log-panel" style="margin-top:14px;display:none">
        <h3 style="margin:0 0 10px" class="section-head-african">Last run log</h3>
        <pre id="ap-log-pre" class="ap-log"></pre>
      </div>`;
  }

  function stageCard (s) {
    return `
      <div class="panel ap-stage-card" id="ap-stage-${esc(s.key)}">
        <div class="ap-stage-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="${esc(s.icon)}"/>
          </svg>
        </div>
        <div class="ap-stage-body">
          <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
            <strong>${esc(s.label)}</strong>
            <span class="mono" style="font-size:.67rem;color:var(--muted)">${esc(s.schedule)}</span>
          </div>
          <p style="margin:4px 0 10px;color:var(--fg-dim);font-size:.82rem;line-height:1.45">${esc(s.desc)}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn ghost ap-run-btn" data-stage="${esc(s.key)}">Run now</button>
            <span class="mono ap-stage-result" style="font-size:.72rem;color:var(--muted);align-self:center"></span>
          </div>
        </div>
      </div>`;
  }

  // ── boot ────────────────────────────────────────────────────────────────
  function paint () {
    const root = document.getElementById('view-autopilot');
    if (!root) return;
    if (!root.dataset.painted) {
      root.innerHTML = template();
      root.dataset.painted = '1';
      bind(root);
    }
    loadStats();
  }

  function bind (root) {
    root.querySelector('#ap-run-all').addEventListener('click', runAll);
    root.querySelector('#ap-refresh').addEventListener('click', loadStats);
    root.addEventListener('click', e => {
      const b = e.target.closest('.ap-run-btn'); if (!b) return;
      runStage(b.dataset.stage, b);
    });
  }

  // ── stats ────────────────────────────────────────────────────────────────
  async function loadStats () {
    try {
      const [qRes, aiRes, pubRes] = await Promise.allSettled([
        fetch('/api/content/queue?limit=1', {cache:'no-store'}).then(r=>r.json()),
        fetch('/api/content/list?status=pending&kind=article&limit=1', {cache:'no-store'}).then(r=>r.json()),
        fetch('/api/content/list?status=published&limit=50', {cache:'no-store'}).then(r=>r.json())
      ]);
      const nScraped   = qRes.status   === 'fulfilled' ? (qRes.value.count   || 0) : '?';
      const nDrafts    = aiRes.status  === 'fulfilled' ? (aiRes.value.count  || 0) : '?';
      const weekAgo    = Date.now() - 7 * 86400000;
      const nPublished = pubRes.status === 'fulfilled'
        ? (pubRes.value.items||[]).filter(x => x.published_at && new Date(x.published_at)>=weekAgo).length
        : '?';

      const el = id => document.getElementById(id);
      if (el('ap-n-scraped'))   el('ap-n-scraped').textContent   = nScraped;
      if (el('ap-n-drafts'))    el('ap-n-drafts').textContent    = nDrafts;
      if (el('ap-n-published')) el('ap-n-published').textContent = nPublished;
    } catch {}
  }

  // ── run stage ────────────────────────────────────────────────────────────
  async function runStage (key, btn) {
    const resultEl = btn?.closest('.ap-stage-card')?.querySelector('.ap-stage-result');
    const endpoints = {
      scrape:   '/api/cron/scan-content',
      articles: '/api/cron/generate-articles',
      slogans:  '/api/cron/generate-slogans',
      logos:    '/api/cron/generate-logos',
      verify:   '/api/cron/verify-links'
    };
    const url = endpoints[key]; if (!url) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }
    if (resultEl) resultEl.textContent = 'Running…';
    try {
      const r = await fetch(url, {method:'GET'});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
      const msg = key==='scrape'
        ? `Scanned ${d.scanned||0}, queued ${d.queued||0}, deduped ${d.deduped||0}`
        : key==='articles' ? `Draft: "${d.title||'?'}"`
        : 'Done ✓';
      if (resultEl) { resultEl.textContent = msg; resultEl.style.color = 'var(--green,#4a4)'; }
      apStatus(msg, 'ok');
      setTimeout(loadStats, 1000);
    } catch (e) {
      const msg = `Failed (check CRON_SECRET): ${e.message}`;
      if (resultEl) { resultEl.textContent = msg; resultEl.style.color = 'var(--red,#e55)'; }
      apStatus(msg, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Run now'; }
    }
  }

  async function runAll () {
    apStatus('Running full pipeline…');
    const btn = document.getElementById('ap-run-all');
    if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }
    try {
      const r = await fetch('/api/autopilot/run', {method:'POST'});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);

      const logPanel = document.getElementById('ap-log-panel');
      const logPre   = document.getElementById('ap-log-pre');
      if (logPanel && logPre) {
        logPanel.style.display = '';
        logPre.textContent = JSON.stringify(d.stages, null, 2);
      }
      apStatus('Pipeline complete ✓', 'ok');
      setTimeout(loadStats, 1000);
    } catch (e) {
      apStatus('Autopilot failed: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '▶ Run full pipeline now'; }
    }
  }

  function apStatus (msg, kind='idle') {
    const el = document.getElementById('ap-status'); if (!el) return;
    el.textContent = msg;
    el.style.color = kind==='error' ? 'var(--red,#e55)' : kind==='ok' ? 'var(--green,#4a4)' : 'var(--muted)';
  }

  window.AutopilotPanel = { render: paint };
})();
