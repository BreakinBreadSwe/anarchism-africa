/* ANARCHISM.AFRICA — Admin Editor (live, database-backed)
 *
 * Powers the Edit / +New buttons on the admin Studio's content tables.
 * Every save writes to Vercel Blob at content/<kind>.json so the public
 * site reflects the change on next page load (AA.loadSeed overlays Blob
 * on top of the bundled fixture).
 *
 * Field schemas per kind are inferred from data/seed.json + the curated
 * datasets — books get publisher/pages, films get director/duration, etc.
 *
 * Public API: window.AdminEditor.open(kind, id|null, onSaved?)
 *   - kind: 'film' | 'article' | 'event' | 'song' | 'book' | 'merch' | 'grant'
 *   - id:   the existing item id to edit, OR null to create new
 *   - onSaved: optional callback fired after successful save
 */
(function () {
  const KIND_KEYS = {
    film: 'films', article: 'articles', event: 'events',
    song: 'music', book: 'books', merch: 'merch', grant: 'grants'
  };
  const SCHEMAS = {
    film:    [['title','text',true],['director','text'],['year','number'],['duration','number','min'],['language','text'],['summary','textarea'],['image','url'],['external_url','url']],
    article: [['title','text',true],['author','text',true],['year','number'],['category','text'],['reading_time','number','min'],['summary','textarea'],['body','longtext'],['image','url'],['external_url','url']],
    event:   [['title','text',true],['starts_at','datetime-local',true],['venue','text'],['city','text',true],['country','text'],['online','checkbox'],['summary','textarea'],['image','url'],['external_url','url']],
    song:    [['title','text',true],['artist','text',true],['year','number'],['duration','number','sec'],['summary','textarea'],['image','url'],['audio','url'],['external_url','url']],
    book:    [['title','text',true],['author','text',true],['year','number'],['publisher','text'],['pages','number'],['summary','textarea'],['body','longtext'],['image','url'],['external_url','url']],
    merch:   [['title','text',true],['provider','text'],['price_eur','number'],['eco','text','comma-separated'],['carbon_g','number','grams'],['summary','textarea'],['image','url'],['external_url','url']],
    grant:   [['funder','text',true],['title','text',true],['amount','text'],['deadline','text'],['region','text'],['themes','text','comma-separated'],['status','text','open|watching|applying|submitted'],['external_url','url']]
  };

  const $  = (s, r=document) => r.querySelector(s);
  const escapeHTML = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  function openModal (html) {
    let m = document.getElementById('admin-editor-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'admin-editor-modal';
      m.className = 'modal open';
      m.setAttribute('role','dialog');
      m.setAttribute('aria-modal','true');
      document.body.appendChild(m);
    }
    m.innerHTML = html;
    m.classList.add('open');
    return m;
  }
  function closeModal () {
    const m = document.getElementById('admin-editor-modal');
    if (m) m.classList.remove('open');
  }

  function buildField ([name, type, hint]) {
    const isLongText = type === 'longtext' || type === 'textarea';
    const placeholder = hint ? ` (${hint})` : '';
    const baseStyle = 'padding:10px 12px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:10px;font:inherit;width:100%';
    if (type === 'checkbox') {
      return `<label style="display:flex;align-items:center;gap:8px;font:inherit"><input type="checkbox" name="${name}"/> ${name}${placeholder}</label>`;
    }
    if (isLongText) {
      return `<label style="display:grid;gap:4px"><span class="mono" style="font-size:.7rem;color:var(--muted);letter-spacing:.1em">${name.toUpperCase()}${placeholder}</span><textarea name="${name}" rows="${type==='longtext'?'10':'4'}" style="${baseStyle};font-family:inherit;line-height:1.5"></textarea></label>`;
    }
    return `<label style="display:grid;gap:4px"><span class="mono" style="font-size:.7rem;color:var(--muted);letter-spacing:.1em">${name.toUpperCase()}${placeholder}</span><input name="${name}" type="${type==='url'||type==='datetime-local'||type==='number'?type:'text'}" style="${baseStyle}"/></label>`;
  }

  function setFormValues (form, item) {
    if (!item) return;
    for (const el of form.elements) {
      if (!el.name) continue;
      const v = item[el.name];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (Array.isArray(v))  el.value = v.join(', ');
      else if (v != null)         el.value = String(v);
    }
  }
  function readFormValues (form, schema) {
    const out = {};
    for (const [name, type, hint] of schema) {
      const el = form.elements[name]; if (!el) continue;
      if (type === 'checkbox')      out[name] = !!el.checked;
      else if (type === 'number')   out[name] = el.value === '' ? null : Number(el.value);
      else if (hint === 'comma-separated') out[name] = el.value.split(',').map(s => s.trim()).filter(Boolean);
      else                           out[name] = el.value;
    }
    return out;
  }

  function genId (kind) { return kind[0] + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

  async function open (kind, id, onSaved) {
    const schema = SCHEMAS[kind] || [];
    const seed = await window.AA.loadSeed();
    const list = seed[KIND_KEYS[kind]] || [];
    const existing = id ? list.find(x => x.id === id) : null;
    const isNew = !existing;

    const m = openModal(`
      <div class="panel" style="max-width:680px;width:calc(100% - 32px);max-height:90vh;display:flex;flex-direction:column;border-radius:18px">
        <div style="padding:18px 22px 0;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <h2 style="margin:0;font-family:'Bebas Neue',sans-serif;letter-spacing:.04em">${isNew ? 'New' : 'Edit'} ${kind}</h2>
          <button class="btn ghost" data-ae-close>Close</button>
        </div>
        <form id="ae-form" style="padding:18px 22px 22px;overflow-y:auto;display:grid;gap:12px">
          ${schema.map(buildField).join('')}
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;margin-top:8px">
            <div>
              ${!isNew ? '<button type="button" class="btn ghost" data-ae-delete style="border-color:var(--red);color:var(--red)">Delete</button>' : ''}
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn ghost" data-ae-close>Cancel</button>
              <button type="submit" class="btn primary">${isNew ? 'Create' : 'Save changes'}</button>
            </div>
          </div>
          <div id="ae-status" class="mono" style="font-size:.72rem;color:var(--muted);min-height:1.2em"></div>
        </form>
      </div>`);

    const form = m.querySelector('#ae-form');
    const status = m.querySelector('#ae-status');
    setFormValues(form, existing);

    m.addEventListener('click', e => {
      if (e.target === m) closeModal();
      if (e.target.closest('[data-ae-close]')) closeModal();
      if (e.target.closest('[data-ae-delete]')) handleDelete();
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const patch = readFormValues(form, schema);
      const item = isNew ? { id: genId(kind), ...patch } : { ...existing, ...patch };
      status.textContent = 'Saving to live database…';
      status.style.color = 'var(--muted)';
      try {
        // Pull current overlay from blob (may be ahead of seed)
        const blobKey = `content/${KIND_KEYS[kind]}.json`;
        const cur = await window.AA.blobGet(blobKey).catch(() => null);
        let arr = (cur && Array.isArray(cur.items)) ? cur.items.slice() : null;
        if (!arr) arr = list.slice();        // bootstrap from seed
        const idx = arr.findIndex(x => x.id === item.id);
        if (idx >= 0) arr[idx] = item; else arr.unshift(item);
        await window.AA.blobPut(blobKey, { items: arr.slice(0, 5000), updated: Date.now() });
        // Bust the in-process cache so AA.loadSeed re-reads on next call
        window.AA.invalidateSeed?.();
        status.textContent = isNew ? 'Created. Public site shows it on next page load.' : 'Saved. Public site shows the update on next page load.';
        status.style.color = 'var(--green)';
        if (typeof onSaved === 'function') onSaved(item);
        setTimeout(closeModal, 800);
      } catch (err) {
        status.textContent = 'Save failed: ' + err.message;
        status.style.color = 'var(--red)';
      }
    });

    async function handleDelete () {
      if (!confirm(`Delete "${existing.title || existing.id}" from the live ${kind} list? This cannot be undone.`)) return;
      const blobKey = `content/${KIND_KEYS[kind]}.json`;
      const cur = await window.AA.blobGet(blobKey).catch(() => null);
      let arr = (cur && Array.isArray(cur.items)) ? cur.items.slice() : list.slice();
      arr = arr.filter(x => x.id !== existing.id);
      try {
        await window.AA.blobPut(blobKey, { items: arr, updated: Date.now() });
        window.AA.invalidateSeed?.();
        if (typeof onSaved === 'function') onSaved(null);
        closeModal();
      } catch (e) {
        status.textContent = 'Delete failed: ' + e.message;
        status.style.color = 'var(--red)';
      }
    }
    document.addEventListener('keydown', function onEsc (e) {
      if (e.key === 'Escape' && m.classList.contains('open')) {
        closeModal(); document.removeEventListener('keydown', onEsc);
      }
    });
  }

  window.AdminEditor = { open };
})();
