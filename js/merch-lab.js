/* ANARCHISM.AFRICA — Merch Lab
 * Browse curated quotes, generate front+back T-shirt SVG, download print-ready
 * PNG (300dpi), and push to Printify (upload + create product + publish).
 * Mounts into #view-merchlab. Public API: window.MerchLab.render().
 */
(function () {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const STORE_URL_BASE = 'https://anarchism.africa/merch/quote/';

  let state = {
    quotes: [], selected: null, front: null, back: null,
    blueprintId: 5, printProviderId: 1, variants: [],
    productId: null, shops: [], shopId: null
  };

  function template () {
    return `
      <div class="panel" style="margin-bottom:14px">
        <h2 style="margin:0 0 6px">Merch Lab</h2>
        <p style="color:var(--fg-dim);max-width:65ch;margin:0 0 10px">
          Turn an afro-anarchist quote into a print-ready T-shirt — quote on the
          front, the speaker's face + biography + QR-link to the AA store on the
          back. Pushes to Printify when configured.
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn primary" id="ml-load">Load quotes</button>
          <button class="btn ghost" id="ml-printify-shops" title="Verify Printify connection">Check Printify</button>
          <span id="ml-status" class="mono" style="font-size:.75rem;color:var(--muted);margin-left:6px"></span>
        </div>
      </div>
      <div class="panel" id="ml-quotes-panel" style="margin-bottom:14px;display:none">
        <h3 style="margin:0 0 10px">Quotes</h3>
        <input id="ml-q-search" placeholder="filter — name, word, year, tag…"
          style="width:100%;padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit;margin-bottom:10px"/>
        <div id="ml-quotes" class="ml-quotes-grid"></div>
      </div>
      <div class="panel" id="ml-design-panel" style="margin-bottom:14px;display:none">
        <h3 style="margin:0 0 6px">Design preview</h3>
        <p id="ml-design-meta" style="color:var(--fg-dim);font-size:.85rem;margin:0 0 12px"></p>
        <div class="ml-shirt-grid">
          <div class="ml-shirt-side"><div class="ml-side-label">FRONT</div><div id="ml-front-host" class="ml-svg-host"></div></div>
          <div class="ml-shirt-side"><div class="ml-side-label">BACK</div><div id="ml-back-host" class="ml-svg-host"></div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn ghost" id="ml-dl-svg-front">Front SVG</button>
          <button class="btn ghost" id="ml-dl-svg-back">Back SVG</button>
          <button class="btn ghost" id="ml-dl-png-front">Front PNG (300dpi)</button>
          <button class="btn ghost" id="ml-dl-png-back">Back PNG (300dpi)</button>
        </div>
      </div>
      <div class="panel" id="ml-printify-panel" style="display:none">
        <h3 style="margin:0 0 10px">Printify push</h3>
        <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;margin-bottom:12px">
          <label style="display:grid;gap:4px"><span class="mono" style="font-size:.7rem;color:var(--muted)">Blueprint ID</span>
            <input id="ml-blueprint" type="number" value="${state.blueprintId}" style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/></label>
          <label style="display:grid;gap:4px"><span class="mono" style="font-size:.7rem;color:var(--muted)">Print provider ID</span>
            <input id="ml-pp" type="number" value="${state.printProviderId}" style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/></label>
          <label style="display:grid;gap:4px;grid-column:1/-1"><span class="mono" style="font-size:.7rem;color:var(--muted)">Title</span>
            <input id="ml-title" placeholder="ANARCHISM.AFRICA · Quote tee" style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/></label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="ml-fetch-variants">Fetch variants</button>
          <button class="btn primary" id="ml-push-printify">Upload + create product</button>
          <button class="btn ghost" id="ml-publish">Publish to shop</button>
        </div>
        <pre id="ml-pf-log" style="margin-top:14px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;font-size:.72rem;color:var(--fg-dim);max-height:240px;overflow:auto;white-space:pre-wrap"></pre>
      </div>`;
  }
  function paint () {
    const root = $('#view-merchlab');
    if (!root) return;
    if (!root.dataset.painted) { root.innerHTML = template(); root.dataset.painted = '1'; bind(); }
  }
  function bind () {
    $('#ml-load').addEventListener('click', loadQuotes);
    $('#ml-printify-shops').addEventListener('click', checkPrintify);
    $('#ml-q-search').addEventListener('input', e => filterQuotes(e.target.value));
    $('#ml-quotes').addEventListener('click', e => { const c = e.target.closest('[data-q-id]'); if (c) pickQuote(c.dataset.qId); });
    $('#ml-dl-svg-front').addEventListener('click', () => downloadSVG('front'));
    $('#ml-dl-svg-back').addEventListener('click', () => downloadSVG('back'));
    $('#ml-dl-png-front').addEventListener('click', () => downloadPNG('front'));
    $('#ml-dl-png-back').addEventListener('click', () => downloadPNG('back'));
    $('#ml-fetch-variants').addEventListener('click', fetchVariants);
    $('#ml-push-printify').addEventListener('click', pushPrintify);
    $('#ml-publish').addEventListener('click', publishProduct);
  }
  function status (msg, kind = 'idle') {
    const el = $('#ml-status'); if (!el) return;
    el.textContent = msg || '';
    el.style.color = kind === 'error' ? 'var(--red)' : kind === 'ok' ? 'var(--green)' : 'var(--muted)';
  }
  function logPF (msg) { const el = $('#ml-pf-log'); if (!el) return; el.textContent += (el.textContent ? '\n' : '') + msg; el.scrollTop = el.scrollHeight; }
  async function loadQuotes () {
    status('Loading quotes…');
    try {
      const r = await fetch('data/afro-anarchist-quotes.json');
      const data = await r.json();
      state.quotes = data.quotes || [];
      $('#ml-quotes-panel').style.display = '';
      renderQuotes(state.quotes);
      status(`${state.quotes.length} quotes loaded`, 'ok');
    } catch (e) { status('Load failed: ' + e.message, 'error'); }
  }
  function renderQuotes (list) {
    const host = $('#ml-quotes');
    if (!list.length) { host.innerHTML = '<div style="color:var(--muted)">No quotes match.</div>'; return; }
    host.innerHTML = list.map(q => `
      <div class="ml-quote-card" data-q-id="${q.id}">
        <div class="ml-quote-text">"${escapeHTML((q.text||'').slice(0,160))}${(q.text||'').length>160?'…':''}"</div>
        <div class="ml-quote-meta">— ${escapeHTML(q.author||'')}${q.year?' · '+q.year:''}</div>
        <div class="ml-quote-tags">${(q.tags||[]).slice(0,4).map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div>
      </div>`).join('');
  }
  function filterQuotes (q) {
    const f = (q||'').toLowerCase().trim();
    if (!f) { renderQuotes(state.quotes); return; }
    renderQuotes(state.quotes.filter(x =>
      (x.text||'').toLowerCase().includes(f) ||
      (x.author||'').toLowerCase().includes(f) ||
      String(x.year||'').includes(f) ||
      (x.tags||[]).some(t => t.toLowerCase().includes(f))
    ));
  }
  async function pickQuote (id) {
    const q = state.quotes.find(x => x.id === id); if (!q) return;
    state.selected = q;
    status('Generating design…');
    try {
      const r = await fetch('/api/merch/generate-shirt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: id, both: true, storeUrl: STORE_URL_BASE + id })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      state.front = { svg: data.front.svg };
      state.back = { svg: data.back.svg };
      $('#ml-design-panel').style.display = '';
      $('#ml-printify-panel').style.display = '';
      $('#ml-design-meta').textContent = `${q.author} · ${q.year || ''} · ${(q.tags || []).join(', ')}`;
      $('#ml-front-host').innerHTML = state.front.svg;
      $('#ml-back-host').innerHTML = state.back.svg;
      $('#ml-title').value = `ANARCHISM.AFRICA · ${q.author} — quote tee`;
      status('Design ready', 'ok');
    } catch (e) { status('Error: ' + e.message, 'error'); }
  }
  function downloadSVG (side) {
    const obj = side === 'back' ? state.back : state.front;
    if (!obj?.svg) { status('Pick a quote first', 'error'); return; }
    const blob = new Blob([obj.svg], { type: 'image/svg+xml' });
    triggerDownload(URL.createObjectURL(blob), `aa-tee-${state.selected?.id || 'design'}-${side}.svg`);
  }
  async function rasterise (svgString, w = 4500, h = 5400) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(b => resolve({ blob: b, dataUrl: c.toDataURL('image/png') }), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG rasterise failed (cross-origin image probably blocked)')); };
      img.src = url;
    });
  }
  async function downloadPNG (side) {
    const obj = side === 'back' ? state.back : state.front;
    if (!obj?.svg) { status('Pick a quote first', 'error'); return; }
    status('Rasterising ' + side + '…');
    try { const r = await rasterise(obj.svg); triggerDownload(URL.createObjectURL(r.blob), `aa-tee-${state.selected?.id || 'design'}-${side}.png`); status('Downloaded', 'ok'); }
    catch (e) { status(e.message, 'error'); }
  }
  function triggerDownload (href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  async function checkPrintify () {
    logPF(''); $('#ml-pf-log').textContent = '';
    status('Checking Printify…');
    try {
      const r = await fetch('/api/pod/printify?op=shops');
      const shops = await r.json();
      if (!r.ok) throw new Error(shops.error || ('HTTP ' + r.status));
      state.shops = Array.isArray(shops) ? shops : [];
      state.shopId = state.shops[0]?.id || null;
      $('#ml-printify-panel').style.display = '';
      logPF(`Connected shops: ${JSON.stringify(state.shops, null, 2)}`);
      status(state.shops.length ? `Printify OK — using shop ${state.shopId}` : 'Printify connected, no shops', 'ok');
    } catch (e) { status('Printify: ' + e.message, 'error'); logPF(String(e.message)); }
  }
  async function fetchVariants () {
    state.blueprintId = parseInt($('#ml-blueprint').value, 10) || state.blueprintId;
    state.printProviderId = parseInt($('#ml-pp').value, 10) || state.printProviderId;
    status('Fetching variants…');
    try {
      const r = await fetch(`/api/pod/printify?op=variants&id=${state.blueprintId}&pp=${state.printProviderId}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      const vs = data?.variants || [];
      state.variants = vs.slice(0, 8).map(v => ({ id: v.id, price: 2900, is_enabled: true }));
      logPF(`Loaded ${vs.length} variants. Using first ${state.variants.length} at €29.00 each.`);
      status(`Variants ready (${state.variants.length})`, 'ok');
    } catch (e) { status('Variants: ' + e.message, 'error'); logPF(String(e.message)); }
  }
  async function uploadImage (svg, fileName) {
    const r = await rasterise(svg);
    const b64 = r.dataUrl.split(',')[1];
    const up = await fetch('/api/pod/printify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'upload', imageB64: b64, fileName })
    });
    const data = await up.json();
    if (!up.ok) throw new Error(data.error || ('HTTP ' + up.status));
    return data;
  }
  async function pushPrintify () {
    if (!state.front || !state.back) { status('Generate a design first', 'error'); return; }
    if (!state.variants.length) { status('Fetch variants first', 'error'); return; }
    const q = state.selected;
    status('Uploading front…'); logPF('--- front upload ---');
    try {
      const upFront = await uploadImage(state.front.svg, `aa-${q.id}-front.png`);
      state.front.pfImageId = upFront.id; logPF(`front uploaded: ${upFront.id}`);
      status('Uploading back…');
      const upBack = await uploadImage(state.back.svg, `aa-${q.id}-back.png`);
      state.back.pfImageId = upBack.id; logPF(`back uploaded: ${upBack.id}`);
      status('Creating product…');
      const created = await fetch('/api/pod/printify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'product', shopId: state.shopId,
          blueprintId: state.blueprintId, printProviderId: state.printProviderId,
          title: $('#ml-title').value || `ANARCHISM.AFRICA · ${q.author} quote tee`,
          description: `"${q.text}" — ${q.author}${q.year ? ', ' + q.year : ''}.\n\n${q.bio || ''}\n\nDesigned and printed on demand.`,
          variants: state.variants,
          printAreas: [
            { position: 'front', imageId: state.front.pfImageId, scale: 0.95, x: 0.5, y: 0.5 },
            { position: 'back',  imageId: state.back.pfImageId,  scale: 0.95, x: 0.5, y: 0.5 }
          ],
          tags: ['anarchism','africa','afrofuturist', q.author.replace(/\s+/g,'-').toLowerCase(), ...(q.tags||[])]
        })
      });
      const cdata = await created.json();
      if (!created.ok) throw new Error(cdata.error || ('HTTP ' + created.status));
      state.productId = cdata.id;
      logPF(`product created: ${cdata.id}`);
      status('Product created — hit "Publish to shop" to push live', 'ok');
    } catch (e) { status('Push failed: ' + e.message, 'error'); logPF(String(e.message)); }
  }
  async function publishProduct () {
    if (!state.productId) { status('Create the product first', 'error'); return; }
    status('Publishing…');
    try {
      const r = await fetch('/api/pod/printify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'publish', shopId: state.shopId, productId: state.productId })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      logPF(`published: ${JSON.stringify(data)}`);
      status('Published ✓', 'ok');
    } catch (e) { status('Publish failed: ' + e.message, 'error'); logPF(String(e.message)); }
  }
  function escapeHTML (s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }
  window.MerchLab = { render: paint };
})();
