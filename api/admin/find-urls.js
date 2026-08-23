// POST /api/admin/find-urls  { topic, count?: 8 }
//
// AI-assisted URL discovery. The admin gives a topic; the LLM proposes N
// authoritative source URLs (Wikipedia biographies, africasacountry.com
// essays, bandcamp daily reviews, museum sites, festival sites, etc.).
// The response is a review list — nothing is scraped or ingested here.
// The admin picks the URLs they like, and the client fires them through
// /api/content/ingest-urls.
//
// Auth: same admin/publisher gate. Same env-var unification as the rest
// of the codebase — accepts either ADMIN_TOKEN or AA_ADMIN_TOKEN.

const { readSession } = require('../auth/_session.js');

module.exports = async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method not allowed' }); }
  const gate = await allowWrite(req);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const topic = String(body?.topic || '').trim();
  const count = Math.max(1, Math.min(20, Number(body?.count) || 8));
  if (!topic) return res.status(400).json({ error: 'body.topic required' });

  const messages = [
    { role: 'system', content: `You are a research assistant for ANARCHISM.AFRICA — an afro-anarchist library focused on Africa and its diaspora across contemporary art, film, literature, music, radio, events, and liberation history. Your job: given a topic, propose ${count} REAL publicly-accessible URLs that would be good primary sources to mirror into the library. Prefer:
- en.wikipedia.org (rich, cite-able, stable)
- africasacountry.com, chimurengachronic.co.za, therepublic.com.ng, roarmag.org, theanarchistlibrary.org
- daily.bandcamp.com / okayafrica.com / dazeddigital.com / newframe.com / mail-and-guardian
- Artist websites and museum pages
STRICT rules:
- Never invent URLs. Every URL must be one you know actually exists.
- No aggregator pages, no listicles, no Pinterest/Instagram/Facebook URLs, no gated academic paywalls.
- Diverse — spread across the topic, don't cluster all on one site.
Respond as JSON: { "urls": [{ "url": "https://…", "why": "one-sentence reason" }, ...] }` },
    { role: 'user', content: `Topic: ${topic}` }
  ];

  try {
    // Reuse our chat handler in-process — same LLM router that Article Lab uses.
    const chat = require('../ai/chat.js');
    const fakeReq = {
      method: 'POST',
      headers: {},
      body: { messages, provider: process.env.OPENROUTER_API_KEY ? 'openrouter' : undefined }
    };
    let responsePayload = null;
    const fakeRes = {
      statusCode: 200,
      setHeader: () => {},
      status (n) { this.statusCode = n; return this; },
      json (obj) { responsePayload = obj; return this; },
      end () {}
    };
    // The chat handler is CommonJS default export in some builds, ES default in others.
    const chatHandler = chat.default || chat;
    await chatHandler(fakeReq, fakeRes);
    if (fakeRes.statusCode !== 200 || !responsePayload) {
      return res.status(500).json({ error: 'AI chat failed', detail: responsePayload });
    }
    const text = responsePayload.text || responsePayload.reply || responsePayload.content || '';
    // Extract JSON — LLMs often wrap in ```json fences.
    const m = text.match(/\{[\s\S]*"urls"[\s\S]*\}/);
    if (!m) return res.status(200).json({ topic, count, urls: [], raw: text.slice(0, 2000) });
    let parsed = null;
    try { parsed = JSON.parse(m[0]); } catch (e) {
      return res.status(200).json({ topic, count, urls: [], raw: text.slice(0, 2000), parse_error: String(e.message).slice(0, 200) });
    }
    const urls = Array.isArray(parsed?.urls) ? parsed.urls.filter(u => u?.url).slice(0, count) : [];
    return res.status(200).json({ topic, count, urls, provider: responsePayload.provider });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 400) });
  }
};

async function allowWrite (req) {
  const adminTok = (process.env.ADMIN_TOKEN || process.env.AA_ADMIN_TOKEN);
  const cronSec  = process.env.CRON_SECRET;
  if (!adminTok && !cronSec) return { ok: true };
  const hdrTok = req.headers['x-admin-token'] || req.headers['x-aa-admin-token'];
  if (adminTok && hdrTok === adminTok) return { ok: true };
  try {
    const sess = readSession(req);
    if (sess && (sess.role === 'admin' || sess.role === 'publisher')) return { ok: true };
  } catch {}
  return { ok: false, status: 401, reason: 'admin or publisher required' };
}
