/* ANARCHISM.AFRICA — Admin: Users & Roles
 *
 * Handles the #view-users section in admin.html:
 *   - Live user table: list, add, edit inline, delete, send magic link
 *   - Role passcodes panel: set / clear per-role passcodes
 *
 * All write operations require the AA_ADMIN_TOKEN sent as x-aa-admin-token.
 * The token is read from the #users-admin-token input which the admin fills
 * in (we never store it except in the input value itself).
 */
(function () {
  const $ = (s, c = document) => c.querySelector(s);

  const ROLES = ['consumer', 'ambassador', 'partner', 'merch', 'publisher', 'admin'];
  const ROLE_COLORS = {
    admin:      '#e74c3c',
    publisher:  '#9b59b6',
    merch:      '#e67e22',
    partner:    '#2980b9',
    ambassador: '#27ae60',
    consumer:   '#7f8c8d'
  };

  let usersCache = [];

  // ── Token helper ──────────────────────────────────────────────────────────
  function adminToken () {
    return ($('#users-admin-token')?.value || '').trim();
  }
  function authHeaders () {
    return { 'Content-Type': 'application/json', 'x-aa-admin-token': adminToken() };
  }

  // ── Status helpers ────────────────────────────────────────────────────────
  function setStatus (sel, msg, kind = '') {
    const el = $(sel);
    if (!el) return;
    el.textContent = msg;
    el.style.color = kind === 'error' ? 'var(--red,#e74c3c)'
                   : kind === 'ok'    ? 'var(--green,#2ecc71)'
                   : 'var(--muted)';
  }

  // ── Role pill HTML ────────────────────────────────────────────────────────
  function rolePill (role) {
    const col = ROLE_COLORS[role] || '#888';
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:${col}22;color:${col};border:1px solid ${col}55">${role}</span>`;
  }

  // ── Load + render users ───────────────────────────────────────────────────
  async function loadUsers () {
    const token = adminToken();
    if (!token) { setStatus('#users-status', 'Enter your admin token first.', 'error'); return; }
    setStatus('#users-status', 'Loading…');
    try {
      const r = await fetch('/api/users/list', {
        headers: { 'x-aa-admin-token': token }
      });
      const data = await r.json();
      if (!r.ok) { setStatus('#users-status', 'Error: ' + (data.error || r.status), 'error'); return; }
      usersCache = data.users || [];
      renderTable();
      setStatus('#users-status', `${usersCache.length} user${usersCache.length !== 1 ? 's' : ''} loaded.`, 'ok');
    } catch (e) {
      setStatus('#users-status', 'Network error: ' + e.message, 'error');
    }
  }

  function renderTable () {
    const tbody = $('#user-rows');
    if (!tbody) return;
    if (!usersCache.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:16px">No users yet — add one below.</td></tr>';
      return;
    }
    tbody.innerHTML = usersCache.map(u => {
      const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—';
      return `<tr data-uid="${u.id}">
        <td class="mono" style="font-size:.82rem">${u.email}</td>
        <td><b>${u.name || '—'}</b></td>
        <td>${rolePill(u.role || 'consumer')}</td>
        <td style="color:var(--muted);font-size:.85rem">${u.city || '—'}</td>
        <td class="mono" style="font-size:.72rem;color:var(--muted)">${joined}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn ghost" style="font-size:.72rem;padding:4px 10px" data-action="edit"      data-uid="${u.id}">Edit</button>
            <button class="btn ghost" style="font-size:.72rem;padding:4px 10px" data-action="magic"     data-uid="${u.id}" data-email="${u.email}" title="Send magic link">✉ Link</button>
            <button class="btn ghost" style="font-size:.72rem;padding:4px 10px;color:var(--red,#e74c3c)" data-action="delete" data-uid="${u.id}" data-name="${u.name || u.email}">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── User form (add / edit) ────────────────────────────────────────────────
  function openForm (user = null) {
    const panel = $('#user-form-panel');
    if (!panel) return;
    $('h3#user-form-title', panel).textContent = user ? 'Edit user' : 'Add user';
    $('#uf-id',    panel).value  = user?.id    || '';
    $('#uf-email', panel).value  = user?.email || '';
    $('#uf-name',  panel).value  = user?.name  || '';
    $('#uf-city',  panel).value  = user?.city  || '';
    const roleEl = $('#uf-role', panel);
    if (roleEl) roleEl.value = user?.role || 'consumer';
    // Email is read-only when editing
    $('#uf-email', panel).readOnly = !!user;
    panel.removeAttribute('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setStatus('#uf-status', '');
  }
  function closeForm () {
    const panel = $('#user-form-panel');
    if (panel) panel.setAttribute('hidden', '');
  }

  async function submitForm () {
    const panel = $('#user-form-panel');
    const id    = $('#uf-id',    panel)?.value?.trim();
    const email = $('#uf-email', panel)?.value?.trim().toLowerCase();
    const name  = $('#uf-name',  panel)?.value?.trim();
    const role  = $('#uf-role',  panel)?.value;
    const city  = $('#uf-city',  panel)?.value?.trim();

    if (!id && !email) { setStatus('#uf-status', 'Email required.', 'error'); return; }
    setStatus('#uf-status', 'Saving…');

    const payload = id ? { id, name, role, city } : { email, name, role, city };
    try {
      const r = await fetch('/api/users/upsert', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) { setStatus('#uf-status', data.error || 'Error ' + r.status, 'error'); return; }

      setStatus('#uf-status', id ? 'Updated ✓' : 'Added ✓', 'ok');
      // Patch local cache
      if (id) {
        const idx = usersCache.findIndex(u => u.id === id);
        if (idx !== -1) usersCache[idx] = data.user;
      } else {
        usersCache.unshift(data.user);
      }
      renderTable();
      setTimeout(closeForm, 800);
    } catch (e) {
      setStatus('#uf-status', 'Network error: ' + e.message, 'error');
    }
  }

  // ── Delete user ───────────────────────────────────────────────────────────
  async function deleteUser (id, label) {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      const r = await fetch('/api/users/delete?id=' + encodeURIComponent(id), {
        method: 'DELETE', headers: { 'x-aa-admin-token': adminToken() }
      });
      const data = await r.json();
      if (!r.ok) { alert('Delete failed: ' + (data.error || r.status)); return; }
      usersCache = usersCache.filter(u => u.id !== id);
      renderTable();
      setStatus('#users-status', 'User removed.', 'ok');
    } catch (e) { alert('Delete error: ' + e.message); }
  }

  // ── Send magic link ───────────────────────────────────────────────────────
  async function sendMagicLink (email) {
    setStatus('#users-status', 'Sending magic link to ' + email + '…');
    try {
      const r = await fetch('/api/users/send-magic-link', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ email })
      });
      const data = await r.json();
      if (!r.ok) { setStatus('#users-status', 'Error: ' + (data.error || r.status), 'error'); return; }
      setStatus('#users-status', 'Magic link sent to ' + email + ' ✓', 'ok');
    } catch (e) {
      setStatus('#users-status', 'Network error: ' + e.message, 'error');
    }
  }

  // ── Role passcodes ────────────────────────────────────────────────────────
  async function loadPasscodes () {
    const token = adminToken();
    if (!token) { setStatus('#passcode-status', 'Enter your admin token first.', 'error'); return; }
    try {
      const r = await fetch('/api/auth/passcodes-admin', {
        headers: { 'x-aa-admin-token': token }
      });
      const data = await r.json();
      if (!r.ok) { setStatus('#passcode-status', 'Error: ' + (data.error || r.status), 'error'); return; }
      renderPasscodeGrid(data.roles || {});
    } catch (e) {
      setStatus('#passcode-status', 'Network error: ' + e.message, 'error');
    }
  }

  function renderPasscodeGrid (roles) {
    const grid = $('#passcode-grid');
    if (!grid) return;
    grid.innerHTML = ROLES.map(role => {
      const col = ROLE_COLORS[role] || '#888';
      const hasCode = !!roles[role];
      return `
<div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
    ${rolePill(role)}
    <span style="font-size:.72rem;color:${hasCode ? 'var(--green,#2ecc71)' : 'var(--muted)'}" id="pc-status-${role}">${hasCode ? '● code set' : '○ no code'}</span>
  </div>
  <input type="password" id="pc-input-${role}" placeholder="${hasCode ? 'Enter new code to change…' : 'Set a passcode…'}"
    autocomplete="new-password"
    style="padding:8px 12px;border:1px solid var(--line);background:var(--bg-2);color:var(--fg);border-radius:7px;font:inherit;font-size:.82rem;width:100%;box-sizing:border-box"/>
  <div style="display:flex;gap:6px">
    <button class="btn primary" style="font-size:.75rem;padding:5px 12px;flex:1" data-pc-save="${role}">Save</button>
    ${hasCode ? `<button class="btn ghost" style="font-size:.75rem;padding:5px 12px;color:var(--red,#e74c3c)" data-pc-clear="${role}" title="Remove passcode for ${role}">Clear</button>` : ''}
  </div>
</div>`;
    }).join('');

    // Bind events
    grid.querySelectorAll('[data-pc-save]').forEach(btn => {
      btn.addEventListener('click', () => savePasscode(btn.dataset.pcSave, false));
    });
    grid.querySelectorAll('[data-pc-clear]').forEach(btn => {
      btn.addEventListener('click', () => savePasscode(btn.dataset.pcClear, true));
    });
  }

  async function savePasscode (role, clear = false) {
    const code = clear ? '' : ($('#pc-input-' + role)?.value || '').trim();
    if (!clear && !code) {
      setStatus('#passcode-status', 'Enter a passcode to save.', 'error'); return;
    }
    if (!clear && code.length < 4) {
      setStatus('#passcode-status', 'Passcode must be at least 4 characters.', 'error'); return;
    }
    setStatus('#passcode-status', (clear ? 'Clearing' : 'Saving') + ' passcode for ' + role + '…');
    try {
      const r = await fetch('/api/auth/passcodes-admin', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ role, code })
      });
      const data = await r.json();
      if (!r.ok) { setStatus('#passcode-status', 'Error: ' + (data.error || r.status), 'error'); return; }
      setStatus('#passcode-status', (clear ? 'Cleared' : 'Saved') + ' passcode for ' + role + ' ✓', 'ok');
      // Reload grid to reflect updated state
      await loadPasscodes();
    } catch (e) {
      setStatus('#passcode-status', 'Network error: ' + e.message, 'error');
    }
  }

  // ── Wire DOM ──────────────────────────────────────────────────────────────
  function init () {
    // Load button
    $('#users-load-btn')?.addEventListener('click', () => {
      loadUsers();
      loadPasscodes();
    });
    // Enter key in token field
    $('#users-admin-token')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { loadUsers(); loadPasscodes(); }
    });
    // Add user button
    $('#users-add-btn')?.addEventListener('click', () => openForm(null));
    // Form buttons
    $('#uf-submit')?.addEventListener('click', submitForm);
    $('#uf-cancel')?.addEventListener('click', closeForm);

    // Table delegation (edit / delete / magic-link)
    $('#user-rows')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const uid    = btn.dataset.uid;
      if (action === 'edit') {
        const user = usersCache.find(u => u.id === uid);
        if (user) openForm(user);
      }
      if (action === 'delete') {
        deleteUser(uid, btn.dataset.name);
      }
      if (action === 'magic') {
        sendMagicLink(btn.dataset.email);
      }
    });
  }

  // Run after DOM ready (this file loads deferred via admin.html)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AdminUsers = { loadUsers, loadPasscodes };
})();
