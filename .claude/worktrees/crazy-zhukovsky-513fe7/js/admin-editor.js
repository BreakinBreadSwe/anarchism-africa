/* ANARCHISM.AFRICA — Admin Editor (full-viewport, media-first)
 *
 * Opens as a full-screen page over the admin Studio. Two-column layout:
 *   LEFT  (~62% on desktop) — large image / video / audio preview
 *   RIGHT (~38%)            — form fields, scrollable
 * On phones the layout stacks; image preview becomes a tall hero band, form
 * scrolls below.
 *
 * Saves to Vercel Blob at content/<kind>.json so the public site reflects
 * changes on next page load (AA.loadSeed overlays Blob on top of seed).
 *
 * Public API: window.AdminEditor.open(kind, id|null, onSaved?)
 */
(function () {
  const KIND_KEYS = {
    film: 'films', article: 'articles', event: 'events',
    song: 'music', book: 'books', merch: 'merch', grant: 'grants'
  };
  // [name, type, hint, group]  — group: 'meta' | 'body' | 'media' | 'links'
  const SCHEMAS = {
    film:    [['title','text','','meta',true],['director','text','','meta'],['year','number','','meta'],['duration','number','min','meta'],['language','text','','meta'],['summary','textarea','','body'],['image','url','poster image','media'],['embed','url','video URL (mp4 / m3u8 / streaming)','media'],['external_url','url','source / publisher page','links']],
    article: [['title','text','','meta',true],['author','text','','meta',true],['year','number','','meta'],['category','text','essay | interview | library | …','meta'],['reading_time','number','min','meta'],['summary','textarea','lede / blurb','body'],['body','longtext','full article (markdown ok)','body'],['image','url','header image','media'],['external_url','url','source','links']],
    event:   [['title','text','','meta',true],['starts_at','datetime-local','','meta',true],['venue','text','','meta'],['city','text','','meta',true],['country','text','','meta'],['online','checkbox','livestream?','meta'],['summary','textarea','','body'],['image','url','','media'],['external_url','url','RSVP / event page','links']],
    song:    [['title','text','','meta',true],['artist','text','','meta',true],['year','number','','meta'],['duration','number','seconds','meta'],['summary','textarea','','body'],['image','url','cover art','media'],['audio','url','direct audio file (mp3/ogg)','media'],['external_url','url','Bandcamp / Spotify / YouTube','links']],
    book:    [['title','text','','meta',true],['author','text','','meta',true],['year','number','','meta'],['publisher','text','','meta'],['pages','number','','meta'],['summary','textarea','blurb','body'],['body','longtext','full text (when public domain)','body'],['image','url','cover','media'],['external_url','url','where to buy / read','links']],
    merch:   [['title','text','','meta',true],['provider','text','Stanley/Stella, Teemill, Printify…','meta'],['price_eur','number','','meta'],['eco','text','comma-separated certifications','meta'],['carbon_g','number','grams CO2e','meta'],['summary','textarea','','body'],['image','url','product photo','media'],['external_url','url','order page','links']],
    grant:   [['funder','text','','meta',true],['title','text','programme name','meta',true],['amount','text','','meta'],['deadline','text','YYYY-MM-DD or "rolling"','meta'],['region','text','','meta'],['themes','text','comma-separated','meta'],['status','text','open | watching | applying | submitted','meta'],['summary','textarea','what they fund','body'],['external_url','url','','links']]
  };

  const $ = (s, r=document) => r.querySelector(s);
  const escapeHTML = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  function fieldHTML ([name, type, hint, group, required]) {
    const placeholder = hint ? ` (${hint})` : '';
    const req = required ? '<span class="ae-req" aria-label="required">*</span>' : '';
    const labelText = `${name.replace(/_/g, ' ')}${placeholder}`;
    if (type === 'checkbox') {
      return `<label class="ae-row ae-row--inline">
        <input type="checkbox" name="${name}"/> <span>${labelText}</span>${req}
      </label>`;
    }
    if (type === 'longtext' || type === 'textarea') {
      return `<label class="ae-row">
        <span class="ae-label">${labelText}${req}</span>
        <textarea name="${name}" rows="${type === 'longtext' ? '12' : '4'}"></textarea>
      </label>`;
    }
    return `<label class="ae-row">
      <span class="ae-label">${labelText}${req}</span>
      <input name="${name}" type="${['url','datetime-local','number','email'].includes(type)?type:'text'}"/>
    </label>`;
  }

  function readVals (form, schema) {
    const out = {};
    for (const [name, type, hint] of schema) {
      const el = form.elements[name]; if (!el) continue;
      if (type === 'checkbox')      out[name] = !!el.checked;
      else if (type === 'number')   out[name] = el.value === '' ? null : Number(el.value);
      else if (hint === 'comma-separated certifications' || hint === 'comma-separated') out[name] = el.value.split(',').map(s => s.trim()).filter(Boolean);
      else                           out[name] = el.value;
    }
    return out;
  }
  function setVals (form, item) {
    if (!item) return;
    for (const el of form.elements) {
      if (!el.name) continue;
      const v = item[el.name];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (Array.isArray(v))  el.value = v.join(', ');
      else if (v != null)         el.value = String(v);
    }
  }
  const genId = kind => kind[0] + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  function renderMedia (kind, item) {
    const img = item?.image;
    if (kind === 'film' && item?.embed) {
      return `<video controls preload="metadata" src="${escapeHTML(item.embed)}" poster="${escapeHTML(img||'')}"></video>`;
    }
    if (kind === 'song' && item?.audio) {
      return `${img ? `<div class="ae-media-cover" style="background-image:url('${escapeHTML(img)}')"></div>` : '<div class="ae-media-empty">No cover yet</div>'}
        <audio controls preload="metadata" src="${escapeHTML(item.audio)}" style="width:100%;margin-top:12px"></audio>`;
    }
    if (img) return `<div class="ae-media-cover" style="background-image:url('${escapeHTML(img)}')" aria-hidden="true"></div>`;
    return `<div class="ae-media-empty">
      <div class="ae-media-empty-mark">
        <svg viewBox="0 0 192 192" width="80" height="80" aria-hidden="true">
          <rect width="192" height="192" rx="20" fill="#000"/>
          <path d="M 78 28 Q 100 22 124 28 Q 146 36 156 54 Q 162 70 158 84 Q 154 96 144 104 Q 142 116 138 130 Q 134 144 126 154 Q 116 162 106 158 Q 98 150 92 138 Q 84 122 76 108 Q 66 92 58 78 Q 52 64 56 50 Q 64 34 78 28 Z" fill="none" stroke="#fff" stroke-width="3"/>
        </svg>
      </div>
      <p>Drop an image URL into the <b>image</b> field on the right<br>and a preview will land here.</p>
    </div>`;
  }

  function shellHTML (kind, item, isNew) {
    const schema = SCHEMAS[kind] || [];
    // group fields
    const meta  = schema.filter(f => f[3] === 'meta');
    const body  = schema.filter(f => f[3] === 'body');
    const media = schema.filter(f => f[3] === 'media');
    const links = schema.filter(f => f[3] === 'links');
    const title = item?.title || item?.funder || '';
    const subtitle = item?.author || item?.director || item?.artist || '';
    return `
      <div class="ae-fs" role="dialog" aria-modal="true" aria-labelledby="ae-fs-title">
        <header class="ae-fs-head">
          <div class="ae-fs-head-left">
            <span class="ae-fs-pill">${isNew ? 'NEW' : 'EDIT'} &middot; ${kind.toUpperCase()}</span>
            <h1 id="ae-fs-title">${escapeHTML(title || (isNew ? 'Untitled' : '(no title)'))}</h1>
            ${subtitle ? `<p class="ae-fs-sub">${escapeHTML(subtitle)}</p>` : ''}
          </div>
          <div class="ae-fs-head-right">
            ${!isNew ? `<button type="button" class="btn ghost ae-del" data-ae-delete>Delete</button>` : ''}
            <button type="button" class="btn ghost" data-ae-close aria-label="Close">Cancel</button>
            <button type="submit" form="ae-form" class="btn primary">${isNew ? 'Create' : 'Save'}</button>
          </div>
        </header>

        <div class="ae-fs-grid">
          <section class="ae-media" id="ae-media-pane" aria-label="Preview">
            ${renderMedia(kind, item)}
            ${media.length ? `<div class="ae-media-fields">
              ${media.map(fieldHTML).join('')}
            </div>` : ''}
          </section>

          <section class="ae-form-pane" aria-label="${kind} fields">
            <form id="ae-form" autocomplete="off">
              ${meta.length  ? `<h2 class="ae-section-title">Metadata</h2><div class="ae-section">${meta.map(fieldHTML).join('')}</div>` : ''}
              ${body.length  ? `<h2 class="ae-section-title">Content</h2><div class="ae-section">${body.map(fieldHTML).join('')}</div>` : ''}
              ${links.length ? `<h2 class="ae-section-title">Links</h2><div class="ae-section">${links.map(fieldHTML).join('')}</div>` : ''}
              <div id="ae-status" class="ae-status mono"></div>
            </form>
          </section>
        </div>
      </div>`;
  }

  async function open (kind, id, onSaved) {
    const seed = await window.AA.loadSeed();
    const list = seed[KIND_KEYS[kind]] || [];
    const existing = id ? list.find(x => x.id === id) : null;
    const isNew = !existing;

    let host = document.getElementById('admin-editor-fs');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'admin-editor-fs';
    host.innerHTML = shellHTML(kind, existing || {}, isNew);
    document.body.appendChild(host);
    document.body.style.overflow = 'hidden';

    const form = host.querySelector('#ae-form');
    const status = host.querySelector('#ae-status');
    setVals(form, existing);

    function close () {
      host.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onEsc);
    }
    function onEsc (e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onEsc);

    host.addEventListener('click', e => {
      if (e.target.closest('[data-ae-close]')) close();
      if (e.target.closest('[data-ae-delete]')) handleDelete();
    });

    // Live media preview — when image/embed/audio inputs change, refresh the left pane
    function refreshMedia () {
      const draft = readVals(form, SCHEMAS[kind] || []);
      const pane = host.querySelector('#ae-media-pane');
      const fields = pane.querySelector('.ae-media-fields');
      const newPreview = renderMedia(kind, { ...existing, ...draft });
      // Replace everything before .ae-media-fields with the new preview
      pane.innerHTML = newPreview + (fields ? fields.outerHTML : '');
    }
    ['image', 'embed', 'audio'].forEach(n => form.elements[n]?.addEventListener('input', refreshMedia));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const patch = readVals(form, SCHEMAS[kind] || []);
      const item = isNew ? { id: genId(kind), ...patch } : { ...existing, ...patch };
      status.textContent = 'Saving to live database…'; status.dataset.kind = 'idle';
      try {
        const blobKey = `content/${KIND_KEYS[kind]}.json`;
        const cur = await window.AA.blobGet(blobKey).catch(() => null);
        let arr = (cur && Array.isArray(cur.items)) ? cur.items.slice() : list.slice();
        const idx = arr.findIndex(x => x.id === item.id);
        if (idx >= 0) arr[idx] = item; else arr.unshift(item);
        await window.AA.blobPut(blobKey, { items: arr.slice(0, 5000), updated: Date.now() });
        window.AA.invalidateSeed?.();
        status.textContent = isNew ? 'Created. Live on next page load.' : 'Saved. Live on next page load.';
        status.dataset.kind = 'ok';
        if (typeof onSaved === 'function') onSaved(item);
        setTimeout(close, 700);
      } catch (err) {
        status.textContent = 'Save failed: ' + err.message;
        status.dataset.kind = 'error';
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
        close();
      } catch (e) {
        status.textContent = 'Delete failed: ' + e.message;
        status.dataset.kind = 'error';
      }
    }
  }

  window.AdminEditor = { open };
})();
