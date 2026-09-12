/* js/house-lab.js — HOUSE LAB controller (ES module).
 * Flow: sketch + notes → /api/house/parse → editable plan → 3D (house-3d.js)
 *       → budget (lib/house-estimator.js, same code as /api/house/budget)
 *       → /api/house/pitch → save (localStorage + /api/house/projects).
 */
import { createViewer } from './house-3d.js';

const E = window.HouseEstimator;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const LS_KEY = 'aa.house.projects';

const state = {
  images: [],            // [{ mime, data(base64), url }]
  plan: E.normalizePlan(E.mergePlans(E.parseNotes($('#notes').value), E.defaultPlan())),
  budget: null,
  pitch: '',
  pitchSource: '',
  projectId: null,
  cloud: null            // null=unknown, false=unavailable, true=available
};

/* ───────────────────────────── 1 · SKETCH ───────────────────────────── */
const drop = $('#drop'), fileInput = $('#files'), thumbs = $('#thumbs');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
document.addEventListener('paste', e => { const fs = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/')); if (fs.length) addFiles(fs); });

async function addFiles (files) {
  for (const f of Array.from(files || [])) {
    if (!f.type.startsWith('image/')) continue;
    if (state.images.length >= 4) { setStatus('#parseStatus', 'Four images max — remove one first.', 'warn'); break; }
    try { state.images.push(await downscale(f)); } catch (e) { setStatus('#parseStatus', 'Could not read ' + f.name, 'err'); }
  }
  renderThumbs();
}
// Shrink to ≤1280px JPEG so 4 photos stay well under the API body limit.
function downscale (file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(img.src);
      resolve({ mime: 'image/jpeg', data: url.split(',')[1], url, name: file.name });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
function renderThumbs () {
  thumbs.innerHTML = state.images.map((im, i) => `<figure><img src="${im.url}" alt="sketch ${i + 1}" /><button type="button" data-i="${i}" title="remove">×</button></figure>`).join('');
  thumbs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.images.splice(+b.dataset.i, 1); renderThumbs(); }));
}

$('#btnParse').addEventListener('click', () => parse(false));
$('#btnNotesOnly').addEventListener('click', () => parse(true));

async function parse (notesOnly) {
  const notes = $('#notes').value.trim();
  const btn = $('#btnParse'); btn.disabled = true;
  setStatus('#parseStatus', notesOnly ? 'Parsing notes…' : (state.images.length ? 'Reading the sketch… (10–40 s)' : 'No image — parsing notes…'));
  try {
    let data;
    if (notesOnly || !state.images.length) {
      // Local path — identical logic to the server's notes fallback, no round trip.
      const np = E.parseNotes(notes);
      const hasCore = np.rooms.some(r => !['porch', 'garage'].includes(r.type));
      const merged = hasCore ? np : E.mergePlans(np, E.defaultPlan());
      merged.source = np.rooms.length || np.features.ac_units.length ? 'notes' : 'default';
      data = { plan: E.normalizePlan(merged), source: merged.source, warnings: [], found: np.found };
      // Still ask the server when it might have AI on the notes alone? Not needed — the parser is deterministic.
    } else {
      const r = await fetch('/api/house/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: state.images.map(i => ({ mime: i.mime, data: i.data })), notes, units: $('#units').value }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || ('HTTP ' + r.status));
      data = await r.json();
    }
    data.plan.name = $('#planName').value.trim() || data.plan.name;
    setPlan(data.plan, { relayout: false });
    const f = data.found || {};
    const bits = [];
    if (data.source === 'ai') bits.push(`sketch read by ${data.provider}${data.model ? ' · ' + data.model : ''}` + (data.plan.confidence ? ` · confidence ${Math.round(data.plan.confidence * 100)}%` : ''));
    if (data.source === 'notes') bits.push('plan built from notes' + (f.ac ? ` · ${f.ac} AC entr${f.ac > 1 ? 'ies' : 'y'}` : '') + (f.porches ? ` · ${f.porches} porch` : '') + (f.beds ? ` · ${f.beds} bed` : ''));
    if (data.source === 'default') bits.push('default bungalow');
    if (data.labels_seen && data.labels_seen.length) bits.push('labels: ' + data.labels_seen.slice(0, 12).join(', '));
    setStatus('#parseStatus', [...bits, ...(data.warnings || [])].join(' — '), (data.warnings || []).length ? 'warn' : 'ok');
    location.hash = '#s2';
  } catch (e) {
    setStatus('#parseStatus', 'Failed: ' + e.message + ' — try "Notes only".', 'err');
  } finally { btn.disabled = false; }
}

/* ───────────────────────────── 2 · PLAN ───────────────────────────── */
const roomsBody = $('#roomsTable tbody'), acBody = $('#acTable tbody');

function setPlan (plan, { relayout = false } = {}) {
  if (relayout) for (const r of plan.rooms) { r.x = null; r.y = null; }
  state.plan = E.normalizePlan(plan);
  renderPlan();
  viewer.setPlan(state.plan);
  budget();
}
// Read the form back into a plan object (without normalizing coordinates unless asked).
function readPlan () {
  const p = state.plan;
  p.name = $('#planName').value.trim() || p.name;
  p.stories = +$('#stories').value || 1;
  p.wall_height = +$('#wallH').value || 9;
  p.roof = { type: $('#roofType').value, pitch: +$('#roofPitch').value };
  p.rooms = $$('#roomsTable tbody tr').map(tr => ({
    id: tr.dataset.id, name: tr.querySelector('.name').value, type: tr.querySelector('.type').value,
    w: +tr.querySelector('.w').value, d: +tr.querySelector('.d').value,
    x: tr.querySelector('.x').value === '' ? null : +tr.querySelector('.x').value,
    y: tr.querySelector('.y').value === '' ? null : +tr.querySelector('.y').value,
    level: +tr.querySelector('.level').value, side: tr.querySelector('.side').value || null
  }));
  p.features.ac_units = $$('#acTable tbody tr').map(tr => ({ count: +tr.querySelector('.count').value || 1, type: tr.querySelector('.actype').value, location: tr.querySelector('.loc').value }));
  p.features.solar = $('#fSolar').checked; p.features.basement = $('#fBasement').checked;
  return p;
}
function renderPlan () {
  const p = state.plan;
  $('#planName').value = p.name; $('#stories').value = p.stories; $('#wallH').value = p.wall_height;
  $('#roofType').value = p.roof.type; $('#roofPitch').value = p.roof.pitch;
  $('#fSolar').checked = !!p.features.solar; $('#fBasement').checked = !!p.features.basement;
  const typeOpts = t => E.ROOM_TYPES.map(x => `<option ${x === t ? 'selected' : ''}>${x}</option>`).join('');
  const sideOpts = s => ['', 'front', 'back', 'left', 'right'].map(x => `<option value="${x}" ${x === (s || '') ? 'selected' : ''}>${x || '—'}</option>`).join('');
  roomsBody.innerHTML = p.rooms.map(r => `<tr data-id="${r.id}">
    <td><input class="name" value="${esc(r.name)}" /></td><td><select class="type">${typeOpts(r.type)}</select></td>
    <td class="num"><input class="w" type="number" min="2" step="0.5" value="${r.w}" /></td><td class="num"><input class="d" type="number" min="2" step="0.5" value="${r.d}" /></td>
    <td class="num"><input class="x" type="number" step="0.5" value="${r.x}" /></td><td class="num"><input class="y" type="number" step="0.5" value="${r.y}" /></td>
    <td><input class="level" type="number" min="0" max="3" value="${r.level}" style="width:48px" /></td><td><select class="side">${sideOpts(r.side)}</select></td>
    <td><button class="x-del x" type="button" title="remove">×</button></td></tr>`).join('');
  const acOpts = t => ['window', 'split', 'central', 'portable'].map(x => `<option ${x === t ? 'selected' : ''}>${x}</option>`).join('');
  acBody.innerHTML = p.features.ac_units.map(u => `<tr>
    <td class="num"><input class="count" type="number" min="1" max="12" value="${u.count}" /></td><td><select class="actype">${acOpts(u.type)}</select></td>
    <td><input class="loc" value="${esc(u.location)}" style="width:150px" /></td><td><button class="x-del x" type="button">×</button></td></tr>`).join('');
  const T = p.totals;
  $('#chips').innerHTML = [
    ['conditioned', T.conditioned_sqft.toLocaleString() + ' sqft'], ['footprint', `${T.footprint.w}×${T.footprint.d} ft`], ['stories', p.stories],
    ['bed / bath', `${T.bedrooms} / ${T.bathrooms}`], ['porch', T.porch_sqft ? T.porch_sqft + ' sqft' : '—'], ['garage', T.garage_sqft ? T.garage_sqft + ' sqft' : '—'],
    ['AC units', T.ac_units || '—'], ['source', p.source]
  ].map(([k, v]) => `<span class="hl-chip">${k} <b>${v}</b></span>`).join('');
  $('#jsonBox').value = JSON.stringify(p, null, 2);
  $('#legend').textContent = `1 unit = 1 ft · ${p.rooms.length} rooms · ${p.roof.type} roof`;
}
function esc (s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Any edit in the plan panel → re-normalize + rebuild. Coordinates are kept
// (so nudging X moves one room); type/size edits keep coordinates too.
let editTimer;
$('#s2').addEventListener('input', e => {
  if (e.target.closest('#jsonBox')) return;
  clearTimeout(editTimer); editTimer = setTimeout(() => setPlan(readPlan()), 250);
});
$('#s2').addEventListener('change', e => { if (e.target.closest('#jsonBox')) return; clearTimeout(editTimer); setPlan(readPlan()); });
$('#s2').addEventListener('click', e => {
  const del = e.target.closest('.x-del'); if (!del) return;
  const tr = del.closest('tr'); const p = readPlan();
  if (tr.closest('#roomsTable')) p.rooms = p.rooms.filter(r => r.id !== tr.dataset.id);
  else p.features.ac_units.splice(Array.from(acBody.children).indexOf(tr), 1);
  setPlan(p);
});
$('#btnAddRoom').addEventListener('click', () => { const p = readPlan(); p.rooms.push({ name: 'New room', type: 'other', w: 10, d: 10, level: 0, x: null, y: null }); setPlan(p); });
$('#btnAddAc').addEventListener('click', () => { const p = readPlan(); p.features.ac_units.push({ count: 1, type: 'window', location: 'back porch' }); setPlan(p); });
$('#btnRelayout').addEventListener('click', () => setPlan(readPlan(), { relayout: true }));
$('#btnJson').addEventListener('click', () => $('#jsonWrap').classList.toggle('hl-hidden'));
$('#btnApplyJson').addEventListener('click', () => { try { setPlan(JSON.parse($('#jsonBox').value)); } catch (e) { alert('Bad JSON: ' + e.message); } });
$('#btnCopyJson').addEventListener('click', () => navigator.clipboard?.writeText($('#jsonBox').value));
$('#planName').addEventListener('input', () => { state.plan.name = $('#planName').value; });

/* ───────────────────────────── 3 · 3D ───────────────────────────── */
const viewer = createViewer($('#viewer'));
$$('.hl-viewbar [data-view]').forEach(b => b.addEventListener('click', () => viewer.frame(b.dataset.view)));
$('#btnRoof').addEventListener('click', e => { e.target.textContent = viewer.toggleRoof() ? 'Roof off' : 'Roof on'; });
$('#btnLabels').addEventListener('click', e => { e.target.textContent = viewer.toggleLabels() ? 'Labels off' : 'Labels on'; viewer.setPlan(state.plan); });
$('#btnObj').addEventListener('click', () => download(slug(state.plan.name) + '.obj', viewer.exportOBJ(), 'text/plain'));
$('#btnPng').addEventListener('click', () => { const a = document.createElement('a'); a.href = viewer.snapshot(1600).replace('image/jpeg', 'image/octet-stream'); a.download = slug(state.plan.name) + '.jpg'; a.click(); });

/* ───────────────────────────── 4 · BUDGET ───────────────────────────── */
const citySel = $('#city');
citySel.innerHTML = E.CITIES.map(c => `<option value="${c.id}" ${c.id === 'detroit' ? 'selected' : ''}>${c.name} — ${c.region} (×${c.index.toFixed(2)})</option>`).join('');
$('#s4').addEventListener('input', () => { $('#sweatLabel').textContent = $('#sweat').value + '%'; $('#customCityWrap').style.display = citySel.value === 'custom' ? '' : 'none'; budget(); });

function budgetOpts () {
  return { city: citySel.value, index: citySel.value === 'custom' ? +$('#customIndex').value : undefined, quality: $('#quality').value,
    sweat_equity: +$('#sweat').value / 100, owner_equity: +$('#equity').value || 0, land_cost: +$('#land').value || 0,
    applicant: $('#applicant').value, site: $('#site').value, story: $('#story').value, tone: $('#tone').value };
}
function budget () {
  const b = state.budget = E.estimateBudget(state.plan, budgetOpts());
  const m = n => E.money(n);
  $('#bigNumbers').innerHTML = `
    <div><small>construction</small><strong>${m(b.construction_total)}</strong></div>
    <div><small>per sq ft</small><strong>${m(b.per_sqft)}</strong></div>
    <div><small>total incl. land</small><strong>${m(b.total)}</strong></div>
    <div><small>owner brings</small><strong>${m(b.owner_equity)}</strong></div>
    <div class="ask"><small>ask to ${b.city.name}</small><strong>${m(b.ask)}</strong></div>`;
  $('#budgetTable tbody').innerHTML = b.items.map(i => `<tr><td>${esc(i.label)}${i.note ? ` <span class="hl-fine">${esc(i.note)}</span>` : ''}</td><td class="num">${i.qty.toLocaleString()}</td><td>${i.unit}</td><td class="num">${i.unit === 'project' ? '' : m(i.rate)}</td><td class="num">${m(i.cost)}</td></tr>`).join('')
    + `<tr class="sub"><td colspan="4">Hard cost</td><td class="num">${m(b.hard_cost)}</td></tr>`
    + (b.land_cost ? `<tr class="sub"><td colspan="4">Land</td><td class="num">${m(b.land_cost)}</td></tr>` : '')
    + `<tr class="total"><td colspan="4">Total</td><td class="num">${m(b.total)}</td></tr>`;
  $('#phases').innerHTML = b.phases.map(p => `<li>${esc(p.name)} — <b>${m(p.cost)}</b></li>`).join('');
  $('#programs').innerHTML = b.city.programs.map(p => `<li><b>${esc(p.name)}</b> — ${esc(p.what)}</li>`).join('') + (b.city.land_hint ? `<li><b>Land</b> — ${esc(b.city.land_hint)}</li>` : '') || '<li>No programs on file for this city — add them to the pitch by hand.</li>';
  $('#disclaimer').textContent = `${b.disclaimer} City index ${b.city.index} · finish ${b.inputs.quality} · sweat equity ${Math.round(b.inputs.sweat_equity * 100)}%.`;
}

/* ───────────────────────────── 5 · PITCH ───────────────────────────── */
$('#btnPitch').addEventListener('click', async () => {
  const btn = $('#btnPitch'); btn.disabled = true; setStatus('#pitchStatus', 'Writing…');
  const o = budgetOpts();
  const body = { plan: state.plan, budget: state.budget, applicant: o.applicant, site: o.site, story: o.story, tone: o.tone, city: o.city };
  try {
    const r = await fetch('/api/house/pitch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    setPitch(data.pitch, data.source);
    setStatus('#pitchStatus', data.source === 'ai' ? `Written by ${data.provider} · ${data.model}` : (data.warning || 'Template pitch'), data.source === 'ai' ? 'ok' : 'warn');
  } catch (e) {
    // Offline / no API: the template lives in the shared library too.
    setPitch(E.pitchTemplate(state.plan, state.budget, { applicant: o.applicant, site: o.site }), 'template');
    setStatus('#pitchStatus', 'API unreachable (' + e.message + ') — template pitch generated locally.', 'warn');
  } finally { btn.disabled = false; }
});
function setPitch (md, source) {
  state.pitch = md; state.pitchSource = source;
  $('#pitch').innerHTML = renderMd(md); $('#pitchEdit').value = md;
}
$('#btnPitchEdit').addEventListener('click', e => {
  const editing = $('#pitchEditWrap').classList.toggle('hl-hidden') === false;
  $('#pitch').classList.toggle('hl-hidden', editing);
  e.target.textContent = editing ? 'Preview' : 'Edit text';
  if (!editing) setPitch($('#pitchEdit').value, state.pitchSource);
});
$('#btnCopyPitch').addEventListener('click', () => navigator.clipboard?.writeText(state.pitch));
$('#btnMd').addEventListener('click', () => download(slug(state.plan.name) + '-pitch.md', state.pitch || E.pitchTemplate(state.plan, state.budget, budgetOpts()), 'text/markdown'));
$('#btnPrint').addEventListener('click', () => window.print());

// Minimal markdown → HTML for the pitch (headings, bold, lists, tables, paragraphs).
function renderMd (md) {
  const lines = String(md || '').split('\n'); const out = []; let list = null, table = null;
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  const flush = () => { if (list) { out.push(`</${list}>`); list = null; } if (table) { out.push('</tbody></table>'); table = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\|/.test(l)) {
      const cells = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (cells.every(c => /^:?-+:?$/.test(c))) continue;
      if (!table) { if (list) { out.push(`</${list}>`); list = null; } out.push('<table><tbody>'); table = true; }
      out.push('<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>'); continue;
    }
    if (table) { out.push('</tbody></table>'); table = null; }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = l.match(/^[-*]\s+(.*)/))) { if (list !== 'ul') { flush(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^\d+\.\s+(.*)/))) { if (list !== 'ol') { flush(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (!l.trim()) { flush(); }
    else { if (list) { out.push(`</${list}>`); list = null; } out.push(`<p>${inline(l)}</p>`); }
  }
  flush(); return out.join('\n');
}

/* ───────────────────────────── SAVE / LOAD ───────────────────────────── */
function localProjects () { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function localSave (list) { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {} }
async function cloudList () {
  if (state.cloud === false) return [];
  try { const r = await fetch('/api/house/projects'); if (!r.ok) { state.cloud = false; return []; } state.cloud = true; return (await r.json()).projects || []; }
  catch { state.cloud = false; return []; }
}
async function refreshProjects () {
  const local = localProjects(), cloud = await cloudList();
  const byId = new Map(); for (const p of local) byId.set(p.id, { ...p, where: 'local' });
  for (const p of cloud) byId.set(p.id, { ...(byId.get(p.id) || {}), ...p, where: byId.has(p.id) ? 'both' : 'cloud' });
  const all = [...byId.values()].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  $('#projects').innerHTML = '<option value="">— saved projects —</option>' + all.map(p => `<option value="${p.id}" ${p.id === state.projectId ? 'selected' : ''}>${esc(p.name)} · ${new Date(p.updated_at).toLocaleString()} ${p.where === 'local' ? '' : '☁'}</option>`).join('');
  state.allProjects = all;
}
$('#btnSave').addEventListener('click', async () => {
  const id = state.projectId || ('hp_' + Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, '0')).join(''));
  const project = { id, name: state.plan.name, plan: state.plan, options: budgetOpts(), pitch: state.pitch, thumbnail: viewer.snapshot(320), updated_at: new Date().toISOString() };
  const list = localProjects().filter(p => p.id !== id); list.unshift(project); localSave(list.slice(0, 30));
  state.projectId = id;
  let msg = 'Saved in this browser.';
  try {
    const r = await fetch('/api/house/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project }) });
    if (r.ok) msg += ' Saved to the cloud (' + ((await r.json()).storage || 'cloud') + ').';
    else if (r.status === 401) msg += ' Sign in on the main site to also save to the cloud.';
    else msg += ' Cloud save unavailable (' + r.status + ').';
  } catch { msg += ' Offline — cloud save skipped.'; }
  setStatus('#saveStatus', msg, 'ok'); refreshProjects();
});
$('#btnLoad').addEventListener('click', () => {
  const p = (state.allProjects || []).find(x => x.id === $('#projects').value); if (!p) return;
  state.projectId = p.id; setPlan(p.plan);
  const o = p.options || {};
  if (o.city) citySel.value = o.city; if (o.quality) $('#quality').value = o.quality;
  if (o.sweat_equity != null) $('#sweat').value = Math.round(o.sweat_equity * 100);
  if (o.owner_equity != null) $('#equity').value = o.owner_equity; if (o.land_cost != null) $('#land').value = o.land_cost;
  ['applicant', 'site', 'story', 'tone'].forEach(k => { if (o[k] != null) $('#' + k).value = o[k]; });
  $('#sweatLabel').textContent = $('#sweat').value + '%'; budget();
  if (p.pitch) setPitch(p.pitch, 'saved');
  setStatus('#saveStatus', 'Loaded “' + p.name + '”.', 'ok');
});
$('#btnDelete').addEventListener('click', async () => {
  const id = $('#projects').value; if (!id || !confirm('Delete this saved project?')) return;
  localSave(localProjects().filter(p => p.id !== id));
  if (state.cloud) await fetch('/api/house/projects?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
  if (state.projectId === id) state.projectId = null;
  setStatus('#saveStatus', 'Deleted.', 'ok'); refreshProjects();
});

/* ───────────────────────────── utils / boot ───────────────────────────── */
function setStatus (sel, msg, kind = '') { const el = $(sel); el.textContent = msg; el.className = 'hl-status ' + kind; }
function slug (s) { return String(s || 'house').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'house'; }
function download (name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

renderPlan(); viewer.setPlan(state.plan); budget(); refreshProjects();
window.HouseLab = { state, setPlan, viewer, E };
