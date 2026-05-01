/* ANARCHISM.AFRICA — Article Lab
 *
 * AI-assisted article writing pipeline for COOLHUNTPARIS publishers and the
 * LUVLAB admin. Five steps:
 *   1. Topic & angle      — editor sets the brief
 *   2. Outline            — AI proposes title, hook, angle, sections, beats
 *   3. Research notes     — AI drafts factual notes per section, flags uncertainties
 *   4. Draft              — AI writes the article in Markdown
 *   5. Polish & headlines — AI tightens voice, suggests title/deck/blurb
 *
 * All AI calls go through /api/ai/article (which internally routes through
 * /api/ai/chat → OpenRouter). Drafts are saved to localStorage; published
 * articles are persisted to Vercel Blob via /api/blob/put under content/
 * articles.json.
 *
 * Available on both admin.html and publisher.html. The host page is
 * detected via document.body.dataset.role.
 */
(function () {
  const $  = (s, r=document) => r.querySelector(s);
  const KEY_DRAFTS = 'aa.articles.drafts';
  const KEY_LAST   = 'aa.articles.last';

  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const uid = () => 'art_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function template () {
    return `
      <div class="panel" style="margin-bottom:14px">
        <h2 style="margin:0 0 6px">Article Lab</h2>
        <p style="color:var(--fg-dim);max-width:65ch;margin:0 0 12px">
          Research, outline, draft, polish — all assisted, none automated. The
          AI proposes; the editor decides. Every output is a draft until you
          press <em>Publish</em>. Verify every <code>[verify]</code> flag and
          every named claim before it ships.
        </p>
        <div class="al-tabs">
          <button class="al-tab active" data-step="brief">1 · Brief</button>
          <button class="al-tab" data-step="outline">2 · Outline</button>
          <button class="al-tab" data-step="research">3 · Research</button>
          <button class="al-tab" data-step="draft">4 · Draft</button>
          <button class="al-tab" data-step="polish">5 · Polish & ship</button>
        </div>
      </div>

      <div class="panel" id="al-step-brief">
        <h3 style="margin:0 0 10px">1 · Brief</h3>
        <div style="display:grid;gap:10px">
          <label style="display:grid;gap:4px">
            <span class="mono" style="font-size:.7rem;color:var(--muted)">Topic</span>
            <input id="al-topic" placeholder="e.g. The Burkinabè revolution, 1983–1987 — what worked, what didn't"
              style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/>
          </label>
          <label style="display:grid;gap:4px">
            <span class="mono" style="font-size:.7rem;color:var(--muted)">Editorial angle (optional)</span>
            <input id="al-angle" placeholder="e.g. Read it through the lens of mutual aid, not great-man history"
              style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/>
          </label>
          <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
            <label style="display:grid;gap:4px">
              <span class="mono" style="font-size:.7rem;color:var(--muted)">Length (words)</span>
              <input id="al-length" type="number" value="1500" min="400" max="6000"
                style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/>
            </label>
            <label style="display:grid;gap:4px">
              <span class="mono" style="font-size:.7rem;color:var(--muted)">Audience</span>
              <input id="al-audience" value="general afro-anarchist reader"
                style="padding:10px 14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:99px;font:inherit"/>
            </label>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <button class="btn primary" id="al-generate-outline">Generate outline →</button>
            <button class="btn ghost"   id="al-load-draft">Load saved draft</button>
            <span class="mono" id="al-status" style="font-size:.75rem;color:var(--muted);align-self:center"></span>
          </div>
        </div>
      </div>

      <div class="panel" id="al-step-outline" style="display:none">
        <h3 style="margin:0 0 10px">2 · Outline</h3>
        <div id="al-outline-host" style="color:var(--muted)">No outline yet — go back to step 1 and generate one.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn ghost" id="al-regen-outline">Regenerate</button>
          <button class="btn primary" id="al-go-research">Research notes →</button>
        </div>
      </div>

      <div class="panel" id="al-step-research" style="display:none">
        <h3 style="margin:0 0 10px">3 · Research notes</h3>
        <div id="al-research-host" style="display:grid;gap:10px;color:var(--muted)">Run an outline first.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn primary" id="al-go-draft">Compose draft →</button>
        </div>
      </div>

      <div class="panel" id="al-step-draft" style="display:none">
        <h3 style="margin:0 0 10px">4 · Draft</h3>
        <textarea id="al-draft" placeholder="The full article will appear here in Markdown — edit freely."
          style="width:100%;min-height:360px;padding:14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:14px;font:inherit;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.85rem;resize:vertical;line-height:1.5"></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn ghost"   id="al-regen-draft">Regenerate</button>
          <button class="btn primary" id="al-go-polish">Polish & headlines →</button>
          <button class="btn ghost"   id="al-save-now">Save draft</button>
        </div>
      </div>

      <div class="panel" id="al-step-polish" style="display:none">
        <h3 style="margin:0 0 10px">5 · Polish & ship</h3>
        <div id="al-headlines" style="display:grid;gap:8px;margin-bottom:14px"></div>
        <textarea id="al-polished" placeholder="Polished version will appear here."
          style="width:100%;min-height:360px;padding:14px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:14px;font:inherit;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.85rem;resize:vertical;line-height:1.5"></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn ghost"   id="al-copy-md">Copy Markdown</button>
          <button class="btn ghost"   id="al-save-final">Save as draft</button>
          <button class="btn primary" id="al-publish">Publish to Library</button>
        </div>
      </div>

      <div class="panel">
        <h3 style="margin:0 0 10px">Saved drafts</h3>
        <div id="al-drafts" class="al-drafts">No drafts yet.</div>
      </div>
    `;
  }

  // ---- state -----------------------------------------------------------
  let state = {
    id: null, topic: '', angle: '', length: 1500, audience: '',
    outline: null, notesBySection: {}, draft: '', polished: '',
    headlines: { titles: [], deck: '', blurb: '' }
  };

  function paint () {
    const root = $('#view-articlelab');
    if (!root) return;
    if (!root.dataset.painted) {
      root.innerHTML = template();
      root.dataset.painted = '1';
      bind(root);
    }
    renderDrafts();
  }

  function bind () {
    $('.al-tabs').addEventListener('click', e => {
      const t = e.target.closest('.al-tab'); if (!t) return;
      showStep(t.dataset.step);
    });
    $('#al-generate-outline').addEventListener('click', genOutline);
    $('#al-regen-outline').addEventListener('click',    genOutline);
    $('#al-go-research').addEventListener('click',      goResearch);
    $('#al-go-draft').addEventListener('click',         genDraft);
    $('#al-regen-draft').addEventListener('click',      genDraft);
    $('#al-go-polish').addEventListener('click',        goPolish);
    $('#al-save-now').addEventListener('click',         () => { state.draft = $('#al-draft').value; saveDraft('draft'); });
    $('#al-save-final').addEventListener('click',       () => { state.polished = $('#al-polished').value; saveDraft('final'); });
    $('#al-copy-md').addEventListener('click',          copyMd);
    $('#al-publish').addEventListener('click',          publish);
    $('#al-load-draft').addEventListener('click',       loadLast);
    document.addEventListener('click', e => {
      const card = e.target.closest('[data-draft-id]');
      if (!card) return;
      if (e.target.closest('[data-act="open"]'))   loadDraft(card.dataset.draftId);
      if (e.target.closest('[data-act="delete"]')) deleteDraft(card.dataset.draftId);
    });
  }

  function showStep (name) {
    document.querySelectorAll('.al-tab').forEach(t => t.classList.toggle('active', t.dataset.step === name));
    ['brief','outline','research','draft','polish'].forEach(s => {
      const el = document.getElementById('al-step-' + s);
      if (el) el.style.display = s === name ? '' : 'none';
    });
  }

  function status (msg, kind = 'idle') {
    const el = $('#al-status'); if (!el) return;
    el.textContent = msg || '';
    el.style.color = kind === 'error' ? 'var(--red)' : kind === 'ok' ? 'var(--green)' : 'var(--muted)';
  }

  async function callStep (step, payload) {
    const r = await fetch('/api/ai/article', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, payload })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
    return data;
  }

  async function genOutline () {
    state.topic    = $('#al-topic').value.trim();
    state.angle    = $('#al-angle').value.trim();
    state.length   = parseInt($('#al-length').value, 10) || 1500;
    state.audience = $('#al-audience').value.trim();
    if (!state.topic) { status('Topic is required', 'error'); return; }
    if (!state.id) state.id = uid();
    status('Generating outline…');
    try {
      const { outline, raw } = await callStep('outline', { topic: state.topic, angle: state.angle, length: state.length, audience: state.audience });
      if (!outline) { $('#al-outline-host').innerHTML = `<pre style="white-space:pre-wrap;color:var(--fg-dim);font-size:.8rem">${escapeHTML(raw || 'No outline returned.')}</pre>`; status('Could not parse outline — see raw output', 'error'); }
      else          { state.outline = outline; renderOutline(); status('Outline ready', 'ok'); }
      writeJSON(KEY_LAST, state);
      showStep('outline');
    } catch (e) { status('Error: ' + e.message, 'error'); }
  }

  function renderOutline () {
    const o = state.outline;
    if (!o) return;
    $('#al-outline-host').innerHTML = `
      <div style="display:grid;gap:10px">
        <div><b>Title:</b> ${escapeHTML(o.title || '—')}</div>
        <div><b>Hook:</b> ${escapeHTML(o.hook  || '—')}</div>
        <div><b>Angle:</b> ${escapeHTML(o.angle || '—')}</div>
        <div>
          <b>Sections:</b>
          <ol style="margin:6px 0 0 18px;padding:0">
            ${(o.sections || []).map(s => `
              <li style="margin-bottom:8px">
                <b>${escapeHTML(s.heading)}</b>
                <ul style="margin:4px 0 0 16px;padding:0">
                  ${(s.beats || []).map(b => `<li>${escapeHTML(b)}</li>`).join('')}
                </ul>
              </li>`).join('')}
          </ol>
        </div>
        ${(o.verify_before_publishing || []).length ? `
          <div style="border-left:3px solid var(--red);padding:8px 12px;background:rgba(200,16,46,.08)">
            <b>Verify before publishing</b>
            <ul style="margin:6px 0 0 16px;padding:0">
              ${o.verify_before_publishing.map(v => `<li>${escapeHTML(v)}</li>`).join('')}
            </ul>
          </div>` : ''}
      </div>`;
  }

  async function goResearch () {
    if (!state.outline) { status('Generate an outline first', 'error'); return; }
    showStep('research');
    const host = $('#al-research-host');
    host.innerHTML = '';
    state.notesBySection = {};
    for (const sec of (state.outline.sections || [])) {
      const block = document.createElement('div');
      block.className = 'panel';
      block.style.padding = '12px 14px';
      block.innerHTML = `<b>${escapeHTML(sec.heading)}</b><div class="mono" style="font-size:.75rem;color:var(--muted);margin-top:6px">researching…</div>`;
      host.appendChild(block);
      try {
        const { notes } = await callStep('research', { topic: state.topic, sectionHeading: sec.heading, beats: sec.beats || [] });
        state.notesBySection[sec.heading] = notes || '';
        block.innerHTML = `<b>${escapeHTML(sec.heading)}</b><pre style="white-space:pre-wrap;font:inherit;font-size:.82rem;color:var(--fg-dim);margin:8px 0 0">${escapeHTML(notes || '')}</pre>`;
      } catch (e) {
        block.innerHTML = `<b>${escapeHTML(sec.heading)}</b><div style="color:var(--red);margin-top:6px">${escapeHTML(e.message)}</div>`;
      }
    }
    writeJSON(KEY_LAST, state);
  }

  async function genDraft () {
    if (!state.outline) { status('Generate an outline first', 'error'); return; }
    showStep('draft');
    $('#al-draft').value = 'Drafting…';
    const notes = Object.entries(state.notesBySection).map(([k, v]) => `## ${k}\n${v}`).join('\n\n');
    try {
      const { draft } = await callStep('draft', { outline: state.outline, notes });
      state.draft = draft || '';
      $('#al-draft').value = state.draft;
      writeJSON(KEY_LAST, state);
    } catch (e) {
      $('#al-draft').value = 'Error: ' + e.message;
    }
  }

  async function goPolish () {
    state.draft = $('#al-draft').value;
    if (!state.draft.trim()) { alert('Draft is empty.'); return; }
    showStep('polish');
    $('#al-polished').value = 'Polishing…';
    $('#al-headlines').innerHTML = '';
    try {
      const [{ polished }, headlines] = await Promise.all([
        callStep('polish',   { draft: state.draft }),
        callStep('headline', { draft: state.draft })
      ]);
      state.polished  = polished || '';
      state.headlines = { titles: headlines.titles || [], deck: headlines.deck || '', blurb: headlines.blurb || '' };
      $('#al-polished').value = state.polished;
      renderHeadlines();
      writeJSON(KEY_LAST, state);
    } catch (e) {
      $('#al-polished').value = 'Error: ' + e.message;
    }
  }

  function renderHeadlines () {
    const h = state.headlines;
    $('#al-headlines').innerHTML = `
      <div class="panel" style="padding:12px 14px">
        <b>Title candidates</b>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${(h.titles || []).map((t, i) => `
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="radio" name="al-title" value="${escapeHTML(t)}" ${i === 0 ? 'checked' : ''}/>
              <span>${escapeHTML(t)}</span>
            </label>`).join('') || '<span style="color:var(--muted)">none</span>'}
        </div>
      </div>
      <div class="panel" style="padding:12px 14px">
        <b>Deck</b>
        <input id="al-deck" value="${escapeHTML(h.deck || '')}"
          style="width:100%;margin-top:6px;padding:8px 12px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit"/>
      </div>
      <div class="panel" style="padding:12px 14px">
        <b>Blurb</b>
        <textarea id="al-blurb" style="width:100%;margin-top:6px;padding:8px 12px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font:inherit;min-height:60px">${escapeHTML(h.blurb || '')}</textarea>
      </div>`;
  }

  function copyMd () {
    const md = $('#al-polished').value || $('#al-draft').value;
    navigator.clipboard.writeText(md).then(
      () => status('Copied Markdown', 'ok'),
      () => status('Copy failed', 'error')
    );
  }

  function saveDraft (which = 'draft') {
    if (!state.id) state.id = uid();
    state.draft    = $('#al-draft')?.value    || state.draft;
    state.polished = $('#al-polished')?.value || state.polished;
    const drafts = readJSON(KEY_DRAFTS, []);
    const idx = drafts.findIndex(d => d.id === state.id);
    const entry = {
      id: state.id, ts: Date.now(),
      topic: state.topic, angle: state.angle,
      title: state.headlines?.titles?.[0] || state.outline?.title || state.topic,
      draft: state.draft, polished: state.polished,
      outline: state.outline, headlines: state.headlines
    };
    if (idx >= 0) drafts[idx] = entry; else drafts.unshift(entry);
    writeJSON(KEY_DRAFTS, drafts.slice(0, 100));
    writeJSON(KEY_LAST, state);
    status('Saved (' + which + ')', 'ok');
    renderDrafts();
  }

  function loadLast () {
    const last = readJSON(KEY_LAST, null);
    if (!last) { status('No saved session', 'error'); return; }
    state = last;
    $('#al-topic').value    = state.topic    || '';
    $('#al-angle').value    = state.angle    || '';
    $('#al-length').value   = state.length   || 1500;
    $('#al-audience').value = state.audience || '';
    if (state.outline)  renderOutline();
    if (state.draft)    { /* will paint when user moves to step 4 */ }
    status('Loaded last session', 'ok');
    showStep('brief');
  }

  function loadDraft (id) {
    const drafts = readJSON(KEY_DRAFTS, []);
    const d = drafts.find(x => x.id === id);
    if (!d) return;
    state = {
      id: d.id, topic: d.topic || '', angle: d.angle || '',
      length: 1500, audience: '',
      outline: d.outline || null, notesBySection: {},
      draft: d.draft || '', polished: d.polished || '',
      headlines: d.headlines || { titles: [], deck: '', blurb: '' }
    };
    $('#al-topic').value = state.topic;
    $('#al-angle').value = state.angle;
    if (state.outline)  renderOutline();
    if (state.draft)    $('#al-draft').value    = state.draft;
    if (state.polished) $('#al-polished').value = state.polished;
    renderHeadlines();
    showStep('polish');
    status('Loaded draft', 'ok');
  }

  function deleteDraft (id) {
    if (!confirm('Delete this draft?')) return;
    const drafts = readJSON(KEY_DRAFTS, []).filter(d => d.id !== id);
    writeJSON(KEY_DRAFTS, drafts);
    renderDrafts();
  }

  function renderDrafts () {
    const drafts = readJSON(KEY_DRAFTS, []);
    const host = $('#al-drafts');
    if (!host) return;
    if (!drafts.length) { host.innerHTML = '<span style="color:var(--muted)">No drafts yet.</span>'; return; }
    host.innerHTML = drafts.map(d => `
      <div class="al-draft-card" data-draft-id="${d.id}">
        <div>
          <b>${escapeHTML(d.title || d.topic || '(untitled)')}</b>
          <div class="mono" style="font-size:.7rem;color:var(--muted)">${new Date(d.ts).toLocaleString()}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn ghost" data-act="open">Open</button>
          <button class="btn ghost" data-act="delete">Delete</button>
        </div>
      </div>`).join('');
  }

  async function publish () {
    state.polished = $('#al-polished').value;
    if (!state.polished.trim()) { alert('Polished article is empty.'); return; }
    const titleInput = document.querySelector('input[name="al-title"]:checked');
    const title = titleInput?.value || state.headlines?.titles?.[0] || state.outline?.title || state.topic || '(untitled)';
    const deck  = $('#al-deck')?.value  || state.headlines?.deck  || '';
    const blurb = $('#al-blurb')?.value || state.headlines?.blurb || '';
    if (!confirm(`Publish "${title}" to the public Library?`)) return;
    status('Publishing…');
    const author = (document.body.dataset.role === 'admin') ? 'LUVLAB' : 'COOLHUNTPARIS';
    const newArticle = {
      id:           'art_' + Date.now().toString(36),
      title, author, year: new Date().getFullYear(),
      category:     'essay',
      reading_time: Math.max(2, Math.round(state.polished.split(/\s+/).length / 220)),
      image:        'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=1200&q=80',
      summary:      blurb || (state.outline?.hook || ''),
      deck,
      body:         state.polished,
      published_at: new Date().toISOString(),
      provenance:   'Article Lab — drafted by AI assistant, edited and published by ' + author
    };
    try {
      const cur = await (window.AA?.loadSeed?.() || fetch('/data/seed.json').then(r => r.json())).catch(() => ({}));
      const articles = Array.isArray(cur.articles) ? cur.articles.slice() : [];
      articles.unshift(newArticle);
      const r = await fetch('/api/blob/put', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'content/articles.json', value: { articles } })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'put failed');
      status('Published ✓ — ' + (data.url || ''), 'ok');
      saveDraft('published');
    } catch (e) {
      status('Publish failed: ' + e.message, 'error');
    }
  }

  function escapeHTML (s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }

  window.ArticleLab = { render: paint };
})();
