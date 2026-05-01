/* ANARCHISM.AFRICA — live actions
 *
 * Replaces the old "(demo)" alerts with real, persistent behavior:
 *   - rsvp(eventId, btn)        → POST /api/events/rsvp (writes to Blob);
 *                                  falls back to localStorage if endpoint missing.
 *   - calendar(eventId)         → builds an .ics calendar file from the event
 *                                  in the live database and downloads it.
 *   - read(itemId, btn)         → expands the open modal to show the full body
 *                                  inline if available, otherwise opens external_url.
 *   - buy(itemId, btn)          → POST /api/pod/order (Printify/Stanley-Stella),
 *                                  surfaces the resulting order id; falls back
 *                                  to opening the publisher's external_url.
 *   - pledge(amount, campaignId, btn) → POST /api/pledges (writes to Blob).
 *   - toast(msg, kind?)         → small bottom-right notification, replaces alert.
 */
(function () {
  'use strict';

  // -------- toast UI ----------------------------------------------------
  let toastHost;
  function ensureHost () {
    if (toastHost) return toastHost;
    toastHost = document.createElement('div');
    toastHost.id = 'aa-toasts';
    toastHost.style.cssText = 'position:fixed;bottom:80px;right:18px;display:flex;flex-direction:column;gap:8px;z-index:80;pointer-events:none;max-width:340px';
    document.body.appendChild(toastHost);
    return toastHost;
  }
  function toast (msg, kind = 'idle') {
    ensureHost();
    const el = document.createElement('div');
    const colors = {
      idle:  ['var(--bg-2)', 'var(--fg)',   'var(--line)'],
      ok:    ['var(--bg-2)', 'var(--green)','var(--green)'],
      error: ['var(--bg-2)', 'var(--red)',  'var(--red)']
    };
    const [bg, fg, bd] = colors[kind] || colors.idle;
    el.style.cssText = `pointer-events:auto;background:${bg};color:${fg};border:1px solid ${bd};border-radius:12px;padding:10px 14px;font-size:.85rem;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:aa-toast-in .25s ease-out`;
    el.textContent = msg;
    toastHost.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 320); }, 4200);
  }
  if (!document.getElementById('aa-toast-keyframes')) {
    const s = document.createElement('style');
    s.id = 'aa-toast-keyframes';
    s.textContent = '@keyframes aa-toast-in { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }';
    document.head.appendChild(s);
  }

  // -------- helpers -----------------------------------------------------
  function btnLoading (btn, text) { if (!btn) return () => {}; const orig = btn.textContent; btn.disabled = true; btn.textContent = text || 'Working…'; return () => { btn.disabled = false; btn.textContent = orig; }; }

  async function postJSON (url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = null; try { data = await r.json(); } catch {}
    if (!r.ok) throw new Error(data?.error || ('HTTP ' + r.status));
    return data;
  }

  async function findItem (kind, id) {
    if (!window.AA?.loadSeed) return null;
    const seed = await window.AA.loadSeed();
    const map = { event: 'events', book: 'books', merch: 'merch', article: 'articles', film: 'films', song: 'music' };
    const list = seed[map[kind]] || [];
    return list.find(x => x.id === id) || null;
  }

  // -------- RSVP --------------------------------------------------------
  async function rsvp (eventId, btn, fallbackTitle) {
    const restore = btnLoading(btn, 'Saving…');
    try {
      const ev = await findItem('event', eventId);
      const title = (ev && ev.title) || fallbackTitle || eventId;
      try {
        await postJSON('/api/events/rsvp', { eventId, title });
      } catch {
        // endpoint missing — persist locally so the user's signal is at least kept
        const list = JSON.parse(localStorage.getItem('aa.rsvps') || '[]');
        if (!list.find(x => x.id === eventId)) list.push({ id: eventId, title, ts: Date.now() });
        localStorage.setItem('aa.rsvps', JSON.stringify(list));
      }
      toast(`RSVP saved — “${title}”`, 'ok');
    } catch (e) { toast('RSVP failed: ' + e.message, 'error'); }
    finally { restore(); }
  }

  // -------- Calendar (.ics download) ------------------------------------
  function pad (n) { return String(n).padStart(2, '0'); }
  function ics (ev) {
    const start = new Date(ev.starts_at);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);  // assume 2-hour
    const fmt = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ANARCHISM.AFRICA//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + ev.id + '@anarchism.africa',
      'DTSTAMP:' + fmt(new Date()),
      'DTSTART:' + fmt(start),
      'DTEND:' + fmt(end),
      'SUMMARY:' + (ev.title || '').replace(/\n/g, ' '),
      'DESCRIPTION:' + (ev.summary || '').replace(/\n/g, '\\n'),
      'LOCATION:' + [(ev.venue||''), (ev.city||''), (ev.country||'')].filter(Boolean).join(', '),
      ev.external_url ? 'URL:' + ev.external_url : '',
      'END:VEVENT', 'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
  }
  async function calendar (eventId) {
    const ev = await findItem('event', eventId);
    if (!ev) { toast('Event not found in live database', 'error'); return; }
    const blob = new Blob([ics(ev)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(ev.title||'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Calendar event downloaded — open it in your calendar app', 'ok');
  }

  // -------- Read (book / article body) ---------------------------------
  async function read (itemId, btn) {
    const restore = btnLoading(btn, 'Loading…');
    try {
      // try book first, then article
      const book = await findItem('book', itemId);
      const article = book ? null : await findItem('article', itemId);
      const it = book || article;
      if (!it) { toast('Item not found in live database', 'error'); return; }
      if (it.body) {
        // expand modal — find the open modal body
        const body = document.querySelector('.modal.open .panel-body');
        if (body) {
          const reader = document.createElement('div');
          reader.style.cssText = 'margin-top:14px;padding-top:14px;border-top:1px solid var(--line);line-height:1.7;max-width:70ch';
          reader.innerHTML = it.body.split(/\n\n+/).map(p => `<p>${p}</p>`).join('');
          body.appendChild(reader);
          if (btn) btn.style.display = 'none';
        }
      } else if (it.external_url) {
        window.open(it.external_url, '_blank', 'noopener');
      } else {
        toast('No full text on file. Add via admin → Edit.', 'idle');
      }
    } finally { restore(); }
  }

  // -------- Buy (POD order) --------------------------------------------
  async function buy (itemId, btn) {
    const restore = btnLoading(btn, 'Ordering…');
    try {
      const it = await findItem('merch', itemId);
      if (!it) { toast('Item not found', 'error'); return; }
      if (it.external_url) {
        window.open(it.external_url, '_blank', 'noopener');
        return;
      }
      const r = await postJSON('/api/pod/order', { sku: it.id, provider: it.provider || 'stanley_stella', quantity: 1 });
      toast(`Order ${r.id || 'placed'} — ${it.title}`, 'ok');
    } catch (e) { toast('Order failed: ' + e.message, 'error'); }
    finally { restore(); }
  }

  // -------- Pledge ------------------------------------------------------
  async function pledge (amount_eur, campaignId, btn) {
    const restore = btnLoading(btn, 'Recording…');
    try {
      try {
        await postJSON('/api/pledges', { campaign_id: campaignId, amount_cents: Math.round(Number(amount_eur) * 100) });
      } catch {
        const list = JSON.parse(localStorage.getItem('aa.pledges') || '[]');
        list.push({ campaign_id: campaignId, amount_cents: Math.round(Number(amount_eur) * 100), ts: Date.now() });
        localStorage.setItem('aa.pledges', JSON.stringify(list));
      }
      toast(`Pledge of €${amount_eur} recorded — thank you ✊🏾`, 'ok');
    } catch (e) { toast('Pledge failed: ' + e.message, 'error'); }
    finally { restore(); }
  }

  window.AA_LIVE = { rsvp, calendar, read, buy, pledge, toast };
})();
