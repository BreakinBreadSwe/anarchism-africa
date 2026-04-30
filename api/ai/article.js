// Vercel serverless — Article Lab pipeline.
//
// POST /api/ai/article
//   body: { step, payload, provider?, model? }
//
// Steps (each returns the next stage; client orchestrates):
//   - "outline"   { topic, angle?, length?, audience? }
//                  → { outline: { title, hook, sections: [{heading, beats:[]}] } }
//   - "research"  { topic, sectionHeading, beats }
//                  → { notes: string, sources: [{title, hint}] }      // factual notes; user verifies
//   - "draft"     { outline, notes? }
//                  → { draft: string }                                  // full article, markdown
//   - "polish"    { draft, voice? }
//                  → { polished: string }                               // tone/voice tightened
//   - "headline"  { draft }
//                  → { titles: [string], deck: string, blurb: string }
//
// All steps proxy to /api/ai/chat (which defaults to OpenRouter free models).
// Editorial responsibility stays with the publisher — every output is a draft,
// every fact must be verified by hand. This pipeline is a research + writing
// assistant, not a fact source of truth.

import handler from './chat.js';

const SYSTEM = `You are an editorial assistant for ANARCHISM.AFRICA — a 360° afrofuturist platform on afro-anarchism across Africa and the diaspora. Stewards: LUVLAB (admin) and COOLHUNTPARIS (publisher / curator). Style: rigorous, plain-spoken, anti-jargon, anti-academic-bloat; respects the reader; refuses fabrication. When you don't know something, say so. Never invent quotes from real people. Never assign positions to named individuals you can't verify. Always flag what the human editor must verify before publishing.`;

const VOICE = `voice: COOLHUNTPARIS magazine — long-form essayistic, plain-spoken, present tense, sparing on metaphor, generous on specifics. Cite names, places, dates, page numbers when you can. Write for an afro-anarchist reader who already knows the basics. Don't sermonise. Don't pad.`;

async function callChat ({ messages, provider, model }) {
  // Reuse the chat handler in-process by faking req/res.
  let captured;
  const fakeReq = { method: 'POST', body: { messages, provider, model } };
  const fakeRes = {
    statusCode: 200,
    status (c) { this.statusCode = c; return this; },
    json (obj)  { captured = obj; return this; }
  };
  await handler(fakeReq, fakeRes);
  if (fakeRes.statusCode !== 200) throw new Error(captured?.error || 'chat failed');
  return captured.text;
}

function tryJSON (s) {
  if (!s) return null;
  // strip code fences if model wrapped output
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (m ? m[1] : s).trim();
  try { return JSON.parse(candidate); } catch {}
  // try to find first { ... } or [ ... ]
  const first = candidate.indexOf('{'); const last = candidate.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(candidate.slice(first, last + 1)); } catch {}
  }
  return null;
}

export default async function handler_article (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { step, payload = {}, provider, model } = req.body || {};
  try {
    switch (step) {
      case 'outline':   return res.status(200).json(await stepOutline(payload, provider, model));
      case 'research':  return res.status(200).json(await stepResearch(payload, provider, model));
      case 'draft':     return res.status(200).json(await stepDraft(payload, provider, model));
      case 'polish':    return res.status(200).json(await stepPolish(payload, provider, model));
      case 'headline':  return res.status(200).json(await stepHeadline(payload, provider, model));
      default:          return res.status(400).json({ error: 'unknown step: ' + step });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

// Re-export so Vercel uses the right handler name on this route file.
export { handler_article as default };

async function stepOutline (p, provider, model) {
  const { topic, angle = '', length = 1500, audience = 'general afro-anarchist reader' } = p;
  const prompt = `
Topic: ${topic}
Editorial angle: ${angle || '(not set — propose one)'}
Target length: ~${length} words
Audience: ${audience}

Produce a JSON outline. Schema:
{
  "title":   "working title (sharp, specific, no clickbait)",
  "hook":    "1–2 sentence opening that grounds the piece in a concrete moment, not abstraction",
  "angle":   "the editorial argument in one sentence",
  "sections":[
    { "heading": "...", "beats": ["specific point 1","specific point 2", ...] }
  ],
  "verify_before_publishing": ["facts/claims the human editor must check"]
}
Return ONLY valid JSON, no prose around it.`;
  const text    = await callChat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], provider, model });
  const outline = tryJSON(text);
  if (!outline) return { outline: null, raw: text };
  return { outline };
}

async function stepResearch (p, provider, model) {
  const { topic, sectionHeading, beats = [] } = p;
  const prompt = `
For the article on "${topic}", produce research notes for the section titled "${sectionHeading}".
Beats to cover: ${JSON.stringify(beats)}

Return concise factual notes the editor can verify. ${VOICE}

Format:
NOTES
- bullet, fact-shaped, attribute by name where you can.

SOURCES TO CHECK
- short list of likely-authoritative sources (book titles + year, archive names, journal names, official documents). Don't invent URLs. The editor will verify and locate them.

UNCERTAIN
- anything you're guessing at — flag explicitly so the editor doesn't accidentally publish it as fact.`;
  const notes = await callChat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], provider, model });
  return { notes };
}

async function stepDraft (p, provider, model) {
  const { outline, notes = '' } = p;
  const prompt = `
Write the full article from this outline. ${VOICE}
Output Markdown. Use H2 (##) for sections. No bibliographies (the editor adds those). Do not invent quotes. If a fact would need a citation you can't supply, mark it inline as [verify].

Outline:
${JSON.stringify(outline, null, 2)}

Optional research notes the writer should weave in:
${notes || '(none)'}
`;
  const draft = await callChat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], provider, model });
  return { draft };
}

async function stepPolish (p, provider, model) {
  const { draft, voice = VOICE } = p;
  const prompt = `
Polish the following article. Goals:
- Tighten weak sentences.
- Remove jargon, padding, restate-the-obvious openings.
- Keep [verify] flags exactly where they are; the editor checks those.
- Preserve the structure and Markdown headings.
- Do NOT change quotations or named claims.

${voice}

ARTICLE:
${draft}`;
  const polished = await callChat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], provider, model });
  return { polished };
}

async function stepHeadline (p, provider, model) {
  const { draft } = p;
  const prompt = `
Read this article and propose:
- 5 candidate titles (short, specific, no clickbait, no colon-and-subtitle padding)
- 1 deck (≤ 18 words) for use under the title
- 1 blurb (≤ 40 words) for the index/library card

Return JSON: { "titles": [..5..], "deck": "...", "blurb": "..." }

ARTICLE:
${draft}`;
  const text = await callChat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], provider, model });
  const parsed = tryJSON(text);
  if (!parsed) return { titles: [], deck: '', blurb: '', raw: text };
  return parsed;
}
