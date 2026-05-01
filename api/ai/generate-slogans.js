// Vercel serverless — afro-anarchist slogan generator for merch.
//
// Runs the OpenRouter/Gemini chat pipeline to mint short, punchy slogans
// suitable for t-shirts, posters, stickers, and zines. Each call returns
// N slogans across requested categories. Slogans are queued at
// content/merch/slogans.json so the publisher (or the auto-merch cron)
// can turn them into actual print-ready designs via api/merch/generate-shirt.
//
// POST /api/ai/generate-slogans
//   body: {
//     count?: number (1..16, default 8),
//     categories?: string[]  // afro-punk | afro-funk | afro-futurist | afro-anarchist
//                            // | decolonial | abolition | pan-african | all
//     persist?: boolean      // if true, also write to content/merch/slogans.json
//   }
//   resp: { items: [{ id, text, category, font_hint, created_at }] }

import { put } from '@vercel/blob';

const SLOGAN_KEY = 'content/merch/slogans.json';
const PUBLIC_BLOB_BASE = 'https://blob.vercel-storage.com';

const CATEGORIES = ['afro-anarchist', 'afro-punk', 'afro-funk', 'afro-futurist', 'decolonial', 'abolition', 'pan-african'];

const SYSTEM = `You are the slogan-writer for ANARCHISM.AFRICA — an afrofuturist 360° on afro-anarchism. Output is for t-shirts, posters, stickers, zines. House voice:
- punchy, short (2–7 words preferred; max 12)
- in-the-tradition: Sankara, Fanon, Cabral, Lorde, Biko, Malcolm X, Kuwasi Balagoon, Ervin
- never violent toward individuals; structural critique only
- never quote a real person verbatim — original work, in their lineage
- never religious slurs, never targeting any group by ethnicity
- mix English with African-language phrases where it lands (Yoruba, Swahili, Wolof, Twi, Amharic, Lingala)
- afrofuturist when relevant: cosmic, machinic, oceanic, ancestral
- afro-punk when relevant: stark, oppositional, body-political
- avoid clichés: "stay woke", "good vibes", "Africa rising", "mama Africa"
Return ONLY valid JSON: { "slogans": [{ "text": "…", "category": "…" }] } — no commentary, no markdown.`;

async function callChat (messages) {
  // Inline the chat dispatch — keep dependencies minimal
  const provider = 'openrouter';
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY missing');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
      'HTTP-Referer': process.env.SITE_URL || 'https://anarchism.africa',
      'X-Title': 'ANARCHISM.AFRICA'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages, temperature: 0.95
    })
  });
  if (!r.ok) throw new Error('OpenRouter ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

function tryJSON (s) {
  if (!s) return null;
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (m ? m[1] : s).trim();
  try { return JSON.parse(candidate); } catch {}
  const first = candidate.indexOf('{'); const last = candidate.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(candidate.slice(first, last + 1)); } catch {}
  }
  return null;
}

async function pullRecentRejects () {
  // Steer away from previously rejected slogan patterns
  try {
    const r = await fetch(`${PUBLIC_BLOB_BASE}/content/feedback/merch.json?ts=${Date.now()}`);
    if (!r.ok) return '';
    const d = await r.json();
    return (d.items || [])
      .filter(x => x.action === 'reject')
      .slice(0, 8)
      .map(x => `(${x.reason || 'reject'}) "${(x.note || x.meta?.text || '').slice(0, 60)}"`)
      .join(' | ').slice(0, 500);
  } catch { return ''; }
}

async function readSlogans () {
  try {
    const r = await fetch(`${PUBLIC_BLOB_BASE}/${SLOGAN_KEY}?ts=${Date.now()}`);
    if (!r.ok) return { items: [], updated: 0 };
    return await r.json();
  } catch { return { items: [], updated: 0 }; }
}
async function writeSlogans (data) {
  return put(SLOGAN_KEY, JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json'
  });
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = req.body || {};
  const count = Math.min(16, Math.max(1, parseInt(body.count, 10) || 8));
  const cats  = (Array.isArray(body.categories) && body.categories.length)
    ? body.categories.filter(c => CATEGORIES.includes(c) || c === 'all')
    : ['all'];
  const persist = body.persist !== false;   // default ON for cron triggers
  const wantedCats = cats.includes('all') ? CATEGORIES : cats;

  const feedback = await pullRecentRejects();
  const fbBlock = feedback ? ` Avoid these patterns the editors have rejected: ${feedback}.` : '';

  const userPrompt = `Generate ${count} slogans across these categories: ${wantedCats.join(', ')}.
Distribute the count roughly evenly across categories.${fbBlock}
Return JSON only.`;

  try {
    const text = await callChat([
      { role: 'system', content: SYSTEM },
      { role: 'user',   content: userPrompt }
    ]);
    const parsed = tryJSON(text);
    const raw = parsed?.slogans || [];
    if (!raw.length) return res.status(200).json({ items: [], raw: text.slice(0, 600) });

    const ts = Date.now();
    const items = raw.map((s, i) => ({
      id: 'slo_' + ts.toString(36) + '_' + i,
      text: String(s.text || '').slice(0, 200).trim(),
      category: wantedCats.includes(s.category) ? s.category : (wantedCats[0] || 'afro-anarchist'),
      font_hint: s.font_hint || null,
      created_at: ts,
      status: 'pending'
    })).filter(s => s.text.length >= 3);

    if (persist && items.length) {
      const cur = await readSlogans();
      const list = Array.isArray(cur.items) ? cur.items : [];
      // de-dupe by exact text
      const seen = new Set(list.map(x => x.text.toLowerCase()));
      const fresh = items.filter(s => !seen.has(s.text.toLowerCase()));
      list.unshift(...fresh);
      await writeSlogans({ items: list.slice(0, 500), updated: ts });
      return res.status(200).json({ items: fresh, total: list.length, deduped: items.length - fresh.length });
    }
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
