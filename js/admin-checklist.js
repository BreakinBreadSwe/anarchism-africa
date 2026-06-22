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
    if (!action) return;

    /* ── External link — open in new tab ───────────────────────────── */
    if (action.type === 'link') {
      if (action.url) window.open(action.url, '_blank', 'noopener noreferrer');
      return;
    }

    /* ── Generate random secret client-side, copy to clipboard ─────── */
    if (action.type === 'gen-secret') {
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      const secret = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      const row    = button.closest('.aa-checklist-item');
      const detail = row && row.querySelector('.aa-checklist-detail');

      function showInstructions (copied) {
        if (!detail) return;
        detail.innerHTML = '';
        const wrap = document.createElement('span');
        wrap.style.cssText = 'font-size:.78rem;line-height:1.6;color:var(--fg)';
        if (copied) {
          wrap.innerHTML = '<strong style="color:var(--accent)">✓ Copied!</strong> '
            + 'Vercel → Project → Settings → Environment Variables → Add&nbsp;'
            + '<code style="background:var(--bg-2);padding:1px 6px">' + (action.key || 'SECRET') + '</code>'
            + '&nbsp;= (paste) → Save → Redeploy → Refresh here.';
        } else {
          wrap.innerHTML = 'Copy this secret:<br>'
            + '<code style="user-select:all;background:var(--bg-2);padding:4px 8px;display:block;margin:4px 0;word-break:break-all">' + secret + '</code>'
            + 'Vercel → Project → Settings → Environment Variables → Add&nbsp;'
            + '<code style="background:var(--bg-2);padding:1px 6px">' + (action.key || 'SECRET') + '</code>'
            + '&nbsp;= (paste) → Save → Redeploy.';
        }
        detail.appendChild(wrap);
      }

      try {
        await navigator.clipboard.writeText(secret);
        showInstructions(true);
        button.textContent = '✓ Copied to clipboard';
      } catch {
        showInstructions(false);
        button.textContent = 'See secret above ↑';
      }
      button.disabled = true;
      setTimeout(() => { button.disabled = false; button.textContent = action.label; }, 8000);
      return;
    }

    /* ── Internal API call (default) ────────────────────────────────── */
    if (!action.url) return;
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
    // Pills double as filters: click to show only items of that status,
    // click again (or click the active one) to clear. State lives in
    // .aa-checklist-summary[data-filter] + .aa-checklist-body[data-filter];
    // CSS rules in styles.css hide non-matching .aa-checklist-item rows.
    const onPillClick = (status, summary) => {
      const body = document.querySelector('.aa-checklist-body');
      const current = summary.dataset.filter || '';
      const next = current === status ? '' : status;
      if (next) {
        summary.dataset.filter = next;
        if (body) body.dataset.filter = next;
      } else {
        delete summary.dataset.filter;
        if (body) delete body.dataset.filter;
      }
      summary.querySelectorAll('.aa-checklist-pill').forEach(p => {
        p.classList.toggle('is-active', p.dataset.status === next);
      });
    };
    const pill = (status, text) => el('button', {
      type: 'button',
      class: `aa-checklist-pill ${status}`,
      dataset: { status },
      title: `Show only ${status.toUpperCase()} (click again to clear)`,
      onclick: (e) => onPillClick(status, e.currentTarget.parentElement)
    }, text);
    return el('div', { class: 'aa-checklist-summary' },
      pill('pass', ICON.pass + ' ' + (counts.pass || 0) + ' OK'),
      pill('warn', ICON.warn + ' ' + (counts.warn || 0) + ' Warn'),
      pill('fail', ICON.fail + ' ' + (counts.fail || 0) + ' Fail')
    );
  }

  function buildItem (it) {
    const center = el('div', {},
      el('div', { class: 'aa-checklist-label' }, it.label),
      el('div', { class: 'aa-checklist-detail' }, it.detail || '')
    );
    // If the item ships a help block, render it as an expandable accordion
    // under the row. Closed by default; click "?" to expand.
    if (it.help) {
      const helpBox = el('div', { class: 'aa-checklist-help', hidden: 'hidden' });
      // Render the help text as paragraphs split on newlines (we encode
      // WHAT/WHY/HOW/WHERE on separate lines server-side).
      String(it.help).split(/\n+/).forEach(line => {
        const m = line.match(/^([A-Z]+(?:\s\([^)]+\))?):\s*(.*)$/);
        if (m) {
          helpBox.appendChild(el('p', {},
            el('strong', { class: 'aa-checklist-help-tag' }, m[1] + ': '),
            m[2]
          ));
        } else if (line.trim()) {
          helpBox.appendChild(el('p', {}, line));
        }
      });
      const helpBtn = el('button', {
        class: 'aa-checklist-helpbtn',
        type: 'button',
        'aria-label': 'Show instructions',
        title: 'Show / hide instructions'
      }, '?');
      helpBtn.addEventListener('click', () => {
        const open = !helpBox.hidden;
        if (open) helpBox.setAttribute('hidden', 'hidden'); else helpBox.removeAttribute('hidden');
        helpBtn.classList.toggle('open', !open);
      });
      center.appendChild(helpBtn);
      center.appendChild(helpBox);
    }

    const parts = [
      el('span', { class: 'aa-checklist-mark' }, ICON[it.status] || '?'),
      center
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
    const role = (mount.dataset.role || 'admin').toUpperCase();
    const title = role === 'PUBLISHER' || role === 'publisher'
      ? 'A.A. publisher checklist'
      : 'A.A. admin checklist';

    const head = el('div', { class: 'aa-checklist-head' },
      el('h3', {}, title),
      buildSummaryPills(data.counts || {}, data.overall),
      el('div', { class: 'aa-checklist-actions' },
        el('button', {
          class: 'btn ghost',
          type: 'button',
          onclick: (e) => {
            const btn = e.currentTarget;
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Refreshing…';
            render()
              .then(() => { btn.textContent = 'Updated ✓'; })
              .catch(err => { btn.textContent = 'Failed'; console.error('checklist refresh', err); })
              .finally(() => {
                setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 1200);
              });
          }
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
