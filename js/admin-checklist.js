/* ANARCHISM.AFRICA — Pipeline checklist for LUVLAB (admin) + COOLHUNTPARIS
 * (publisher). Polls /api/system/health, renders a grouped checklist with
 * pass/warn/fail marks and an "action" button for each failing/warning row
 * that fires the relevant cron / autopilot endpoint inline.
 *
 * Mount: any <div id="aa-checklist-mount"></div> on the page. The widget
 * paints into it on load and refreshes every 30s.
 */
(function () {
  if (typeof document === 'undefined') return;

  const POLL_MS = 30000;
  const ICON = { pass: '✓', warn: '!', fail: '×' };

  function el (tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style') e.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else e.setAttribute(k, v);
    }
    children.flat().forEach(c => {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  async function fetchHealth () {
    const r = await fetch('/api/system/health', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
    if (!r.ok) throw new Error(`Health endpoint returned ${r.status}`);
    return r.json();
  }

  async function fireAction (action, button) {
    if (!action || !action.url) return;
    const orig = button.textContent;
    button.disabled = true;
    button.textContent = 'Running…';
    try {
      const r = await fetch(action.url, {
        method: action.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });
      const data = await r.json().catch(() => ({}));
      button.textContent = r.ok ? 'Done — refreshing…' : 'Failed';
      // Refresh the whole checklist after a short pause so the user sees the new state
      setTimeout(() => render().catch(() => {}), 1200);
    } catch (err) {
      button.textContent = 'Error';
      console.error('checklist action error', err);
    } finally {
      setTimeout(() => { button.disabled = false; if (button.textContent !== orig) button.textContent = orig; }, 2500);
    }
  }

  function buildSummaryPills (counts, overall) {
    return el('div', { class: 'aa-checklist-summary' },
      el('span', { class: `aa-checklist-pill pass` }, ICON.pass + ' ' + (counts.pass || 0) + ' OK'),
      el('span', { class: `aa-checklist-pill warn` }, ICON.warn + ' ' + (counts.warn || 0) + ' Warn'),
      el('span', { class: `aa-checklist-pill fail` }, ICON.fail + ' ' + (counts.fail || 0) + ' Fail')
    );
  }

  function buildItem (it) {
    const parts = [
      el('span', { class: 'aa-checklist-mark' }, ICON[it.status] || '?'),
      el('div', {},
        el('div', { class: 'aa-checklist-label' }, it.label),
        el('div', { class: 'aa-checklist-detail' }, it.detail || '')
      )
    ];
    if (it.action && (it.status !== 'pass' || /trigger|fire|generate/i.test(it.action.label || ''))) {
      const btn = el('button', {
        class: 'aa-checklist-action',
        type: 'button',
        title: it.action.label
      }, it.action.label);
      btn.addEventListener('click', () => fireAction(it.action, btn));
      parts.push(btn);
    } else {
      parts.push(el('span'));
    }
    return el('div', { class: 'aa-checklist-item', dataset: { status: it.status } }, ...parts);
  }

  function groupItems (items) {
    const map = new Map();
    items.forEach(it => {
      const g = it.group || 'Other';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(it);
    });
    return Array.from(map.entries());
  }

  async function render () {
    const mount = document.getElementById('aa-checklist-mount');
    if (!mount) return;
    let data;
    try { data = await fetchHealth(); }
    catch (err) {
      mount.innerHTML = '';
      mount.appendChild(el('div', { class: 'aa-checklist' },
        el('div', { class: 'aa-checklist-head' }, el('h3', {}, 'Pipeline checklist')),
        el('div', { class: 'aa-checklist-error' }, 'Could not load health: ' + err.message)
      ));
      return;
    }
    const role = (mount.dataset.role || 'LUVLAB').toUpperCase();
    const title = role === 'PUBLISHER' || role === 'COOLHUNTPARIS'
      ? 'COOLHUNTPARIS pipeline checklist'
      : 'LUVLAB pipeline checklist';

    const head = el('div', { class: 'aa-checklist-head' },
      el('h3', {}, title),
      buildSummaryPills(data.counts || {}, data.overall),
      el('div', { class: 'aa-checklist-actions' },
        el('button', {
          class: 'btn ghost',
          type: 'button',
          onclick: () => render().catch(() => {})
        }, 'Refresh'),
        el('button', {
          class: 'btn primary',
          type: 'button',
          onclick: e => fireAction({ url: '/api/autopilot/run', method: 'POST', label: 'Fire autopilot' }, e.target)
        }, 'Fire autopilot now')
      )
    );

    const body = el('div', { class: 'aa-checklist-body' });
    const groups = groupItems(data.items || []);
    if (!groups.length) body.appendChild(el('div', { class: 'aa-checklist-empty' }, 'No checks reported.'));
    groups.forEach(([groupName, list]) => {
      body.appendChild(el('div', { class: 'aa-checklist-group' }, groupName));
      list.forEach(it => body.appendChild(buildItem(it)));
    });

    mount.innerHTML = '';
    mount.appendChild(el('div', { class: 'aa-checklist' }, head, body));
  }

  function start () {
    render().catch(err => console.error('checklist render error', err));
    setInterval(() => render().catch(() => {}), POLL_MS);
    // Refresh when the tab regains focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') render().catch(() => {});
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AA = window.AA || {};
  window.AA.checklist = { refresh: render };
})();
