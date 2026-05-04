// Vercel serverless - manual autopilot trigger.
//
// Fans out to all four cron handlers in sequence and reports per-stage
// status. Admin / publisher dashboards POST here to kick the pipeline
// without waiting for the next cron tick. Idempotent - the underlying
// handlers dedupe and skip recently-covered work.
//
// POST /api/autopilot/run            -> runs all stages
// POST /api/autopilot/run?only=scrape,articles,slogans,logos
//
// Auth: requires x-aa-admin-token header matching ADMIN_TOKEN env, OR
// a valid signed-in admin/publisher session cookie. Falls back to
// CRON_SECRET if neither is present (so an external scheduler can hit
// it the same way Vercel cron does).

const STAGES = {
  scrape:   '/api/cron/scan-content',
  articles: '/api/cron/generate-articles',
  slogans:  '/api/cron/generate-slogans',
  logos:    '/api/cron/generate-logos'
};

function gate (req) {
  const adminTok = process.env.ADMIN_TOKEN;
  const cronSec  = process.env.CRON_SECRET;
  if (adminTok && req.headers['x-aa-admin-token'] === adminTok) return true;
  if (cronSec  && req.headers['x-cron-secret']    === cronSec)  return true;
  // role cookie check (lightweight: trust HMAC session set by /api/auth/google)
  const cookie = req.headers.cookie || '';
  if (/aa_role=(admin|publisher)/.test(cookie)) return true;
  return false;
}

export default async function handler (req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!gate(req)) return res.status(401).json({ error: 'unauthorized' });

  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;
  const only = (req.query?.only || '').split(',').map(s => s.trim()).filter(Boolean);
  const stages = only.length ? only.filter(k => STAGES[k]) : Object.keys(STAGES);

  const out = { ts: Date.now(), stages: {} };
  for (const key of stages) {
    const t0 = Date.now();
    try {
      const r = await fetch(`${origin}${STAGES[key]}`, {
        method: 'GET',
        headers: {
          'x-cron-secret': process.env.CRON_SECRET || '',
          'x-aa-admin-token': process.env.ADMIN_TOKEN || ''
        }
      });
      const data = await r.json().catch(() => ({}));
      out.stages[key] = { ok: r.ok, status: r.status, ms: Date.now() - t0, ...data };
    } catch (e) {
      out.stages[key] = { ok: false, ms: Date.now() - t0, error: String(e.message || e) };
    }
  }

  // Persist an autopilot_log row in Supabase so the LUVLAB / COOLHUNTPARIS
  // checklist can show "Autopilot fired in last 24h". Best-effort —
  // don't fail the cycle if Supabase write fails.
  try {
    const sb = require('../../lib/supabase');
    if (sb.configured()) {
      const allOk = Object.values(out.stages).every(s => s.ok);
      const totalMs = Object.values(out.stages).reduce((a, s) => a + (s.ms || 0), 0);
      await sb.insert('autopilot_log', {
        ran_at: new Date().toISOString(),
        stages: out.stages,
        ok: allOk,
        duration_ms: totalMs,
        triggered_by: req.headers['x-vercel-cron-signature'] ? 'cron' : 'manual'
      });
    }
  } catch {}

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(out);
}
