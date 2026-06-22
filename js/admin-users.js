/* ANARCHISM.AFRICA — Admin: Users & Roles
 *
 * Auth: session cookie (aa_session, role=admin) is sent automatically via
 *       credentials:'include'. A manual x-aa-admin-token override is available
 *       in the "Advanced" collapse for headless / service-account access.
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

  // ── Auth headers ──────────────────────────────────────────────────────────
  // Session cookie is sent automatically. Optionally append x-aa-admin-token
  // if the override input is filled in.
  function authHeaders (contentType = true) {
    const h = {};
    if (contentType) h['Content-Type'] = 'application/json';
    const tok = ($('#users-token-override')?.value || '').trim();
    if (tok) h['x-aa-admin-token'] = tok;
    return h;
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
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:${col}22;color:${col};border:1px solid ${col}44">${role}</span>`;
  }

  // ── Load + render users ───────────────────────────────────────────────────
  async function loadUsers () {
    setStatus('#users-status', 'Loading…');
    try {
      const r = await fetch('/api/users/list', {
        credentials: 'include',
        headers: authHeaders(false)
      });
      const data = await r.json();
      if (r.status === 401) {
        setStatus('#users-status', '⚠ Not authorised — sign in as admin or enter a token override.', 'error');
        return;
      }
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
      const joined = u.createdAt
        ? new Date(u.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
        : '—';
      return `<tr data-uid="${u.id}">
        <td class="mono" style="font-size:.82rem">${u.email}</td>
        <td><b>${u.name || '—'}</b></td>
        <td>${rolePill(u.role || 'consumer')}</td>
        <td style="color:var(--muted);font-size:.85rem">${u.city || '—'}</td>
        <td class="mono" style="font-size:.72rem;color:var(--muted)">${joined}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn ghost" style="font-size:.72rem;padding:4px 10px"
              data-action="edit" data-uid="${u.id}">Edit</button>
            <button class="btn ghost" style="font-size:.72rem;padding:4px 10px"
              data-action="magic" data-uid="${u.id}" data-email="${u.email}" title="Send magic link">✉ Link</button>
            <button class="btn ghost" style="font-size:.72rem;padding:4px 10px;color:var(--red,#e74c3c)"
              data-action="delete" data-uid="${u.id}" data-name="${u.name || u.email}">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Inline role-change shortcut on pill click ─────────────────────────────
  // (Also triggered via full Edit form — this is just a quick-toggle.)
  async function cycleRole (uid) {
    const user = usersCache.find(u => u.id === uid);
    if (!user) return;
    const next = ROLES[(ROLES.indexOf(user.role || 'consumer') + 1) % ROLES.length];
    if (!confirm(`Change ${user.name || user.email}'s role from ${user.role} → ${next}?`)) return;
    await patchUser({ id: uid, role: next });
  }

  // ── User form (add / edit) ────────────────────────────────────────────────
  function openForm (user = null) {
    const panel = $('#user-form-panel');
    if (!panel) return;
    $('#user-form-title', panel).textContent = user ? 'Edit user' : 'Add user';
    $('#uf-id',    panel).value = user?.id    || '';
    $('#uf-email', panel).value = user?.email || '';
    $('#uf-name',  panel).value = user?.name  || '';
    $('#uf-city',  panel).value = user?.city  || '';
    const roleEl = $('#uf-role', panel);
    if (roleEl) roleEl.value = user?.role || 'consumer';
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
    await patchUser(id ? { id, name, role, city } : { email, name, role, city }, '#uf-status');
  }

  async function patchUser (payload, statusSel = '#users-status') {
    try {
      const r = await fetch('/api/users/upsert', {
        method: 'POST', credentials: 'include',
        headers: authHeaders(), body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) { setStatus(statusSel, data.error || 'Error ' + r.status, 'error'); return; }
      const isNew = !payload.id;
      setStatus(statusSel, isNew ? 'User added ✓' : 'Saved ✓', 'ok');
      if (payload.id) {
        const idx = usersCache.findIndex(u => u.id === payload.id);
        if (idx !== -1) usersCache[idx] = data.user;
      } else {
        usersCache.unshift(data.user);
      }
      renderTable();
      if (!isNew) setTimeout(closeForm, 700);
    } catch (e) {
      setStatus(statusSel, 'Network error: ' + e.message, 'error');
    }
  }

  // ── Delete user ───────────────────────────────────────────────────────────
  async function deleteUser (id, label) {
    if (!confirm(`Delete ${label}?\nThis cannot be undone.`)) return;
    try {
      const r = await fetch('/api/users/delete?id=' + encodeURIComponent(id), {
        method: 'DELETE', credentials: 'include', headers: authHeaders(false)
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
    if (!confirm(`Send a magic sign-in link to ${email}?`)) return;
    setStatus('#users-status', `Sending magic link to ${email}…`);
    try {
      const r = await fetch('/api/users/send-magic-link', {
        method: 'POST', credentials: 'include',
        headers: authHeaders(), body: JSON.stringify({ email })
      });
      const data = await r.json();
      if (!r.ok) { setStatus('#users-status', 'Error: ' + (data.error || r.status), 'error'); return; }
      setStatus('#users-status', `Magic link sent to ${email} ✓`, 'ok');
    } catch (e) {
      setStatus('#users-status', 'Network error: ' + e.message, 'error');
    }
  }

  // ── Role passcodes ────────────────────────────────────────────────────────
  // Stub: the passcode UI was removed in 2026-06 (shared role passcodes are
  // insecure — one leak compromises everyone with that role). All callers
  // remain so window.AdminUsers.loadPasscodes still exists; this no-ops
  // instead of network-erroring on its missing DOM nodes + locked endpoint.
  async function loadPasscodes () { /* no-op — feature deprecated */ }

  function renderPasscodeGrid (roles) {
    const grid = $('#passcode-grid');
    if (!grid) return;
    grid.innerHTML = ROLES.map(role => {
      const col    = ROLE_COLORS[role] || '#888';
      const hasCode = !!roles[role];
      return `
<div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
    ${rolePill(role)}
    <span style="font-size:.72rem;color:${hasCode ? 'var(--green,#2ecc71)' : 'var(--muted)'}" id="pc-status-${role}">
      ${hasCode ? '● set' : '○ none'}
    </span>
  </div>
  <input type="password" id="pc-input-${role}"
    placeholder="${hasCode ? 'Replace passcode…' : 'Set a passcode…'}"
    autocomplete="new-password"
    style="padding:8px 12px;border:1px solid var(--line);background:var(--bg-2);color:var(--fg);border-radius:7px;font:inherit;font-size:.82rem;width:100%;box-sizing:border-box"/>
  <div style="display:flex;gap:6px">
    <button class="btn primary" style="font-size:.75rem;padding:5px 12px;flex:1" data-pc-save="${role}">Save</button>
    ${hasCode ? `<button class="btn ghost" style="font-size:.75rem;padding:5px 12px;color:var(--red,#e74c3c)" data-pc-clear="${role}">Clear</button>` : ''}
  </div>
</div>`;
    }).join('');

    grid.querySelectorAll('[data-pc-save]').forEach(btn =>
      btn.addEventListener('click', () => savePasscode(btn.dataset.pcSave, false)));
    grid.querySelectorAll('[data-pc-clear]').forEach(btn =>
      btn.addEventListener('click', () => savePasscode(btn.dataset.pcClear, true)));
  }

  async function savePasscode (role, clear = false) {
    const code = clear ? '' : ($('#pc-input-' + role)?.value || '').trim();
    if (!clear && !code) {
      setStatus('#passcode-status', 'Enter a passcode first.', 'error'); return;
    }
    if (!clear && code.length < 4) {
      setStatus('#passcode-status', 'Passcode must be at least 4 characters.', 'error'); return;
    }
    setStatus('#passcode-status', (clear ? 'Clearing' : 'Saving') + ` passcode for ${role}…`);
    try {
      const r = await fetch('/api/auth/passcodes-admin', {
        method: 'POST', credentials: 'include',
        headers: authHeaders(), body: JSON.stringify({ role, code })
      });
      const data = await r.json();
      if (!r.ok) { setStatus('#passcode-status', 'Error: ' + (data.error || r.status), 'error'); return; }
      setStatus('#passcode-status', (clear ? 'Cleared' : 'Saved') + ` passcode for ${role} ✓`, 'ok');
      await loadPasscodes();
    } catch (e) {
      setStatus('#passcode-status', 'Network error: ' + e.message, 'error');
    }
  }

  // ── Wire DOM ──────────────────────────────────────────────────────────────
  function init () {
    // Refresh button
    $('#users-refresh-btn')?.addEventListener('click', () => { loadUsers(); loadPasscodes(); });

    // Add user button
    $('#users-add-btn')?.addEventListener('click', () => openForm(null));

    // Form buttons
    $('#uf-submit')?.addEventListener('click', submitForm);
    $('#uf-cancel')?.addEventListener('click', closeForm);

    // Table delegation (edit / delete / magic-link)
    $('#user-rows')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, uid, name: label, email } = btn.dataset;
      if (action === 'edit')   { const u = usersCache.find(u => u.id === uid); if (u) openForm(u); }
      if (action === 'delete') { deleteUser(uid, label); }
      if (action === 'magic')  { sendMagicLink(email); }
    });

    // Token override — Enter key
    $('#users-token-override')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { loadUsers(); loadPasscodes(); }
    });

    // Auto-load on first init (session is already active for admin users)
    loadUsers();
    loadPasscodes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AdminUsers = { loadUsers, loadPasscodes };
})();
