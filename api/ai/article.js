// Vercel serverless — Article Lab pipeline.
//
// POST /api/ai/article
//   body: { step, payload, provider?, model? }
//
// Steps (each returns the next stage; client orchestrates):
//   - "outline"   { topic, angle?, length?, audience? }
//                  -> { outline: { title, hook, sections: [{heading, beats:[]}] } }
//   - "research"  { topic, sectionHeading, beats, grounded? }
//                  -> { notes: string, sources: [{title, hint}] }      // factual notes; user verifies
//                     If grounded:true and NOTEBOOKLM_API_KEY (Google AI Studio
//                     grounded model) is set, runs through the grounded model
//                     and returns sources[] from web grounding.
//   - "draft"     { outline, notes? }
//                  -> { draft: string }                                 // full article, markdown
//   - "polish"    { draft, voice? }
//                  -> { polished: string }                              // tone/voice tightened
//   - "headline"  { draft }
//                  -> { titles: [string], deck: string, blurb: string }
//   - "media"     { topic, draft, sections? }
//                  -> { hero_image, gallery:[], embeds:[], pull_quotes:[],
//                       stats:[{label,value,unit,source}], related_topics:[] }
//                     Suggests visual + multimedia assets to enrich the article
//                     when rendered on item.html.
//   - "compose"   { topic, angle?, length?, audience?, voice?, grounded? }
//                  -> { article: { id, title, deck, blurb, body (markdown),
//                                  hero_image, gallery, embeds, pull_quotes,
//                                  stats, sources, verify, ts } }
//                     End-to-end: runs outline -> research (per section) -> draft
//                     -> polish -> headline -> media in one server-side call.
//                     Output is the complete article record ready to persist.
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
      case 'media':     return res.status(200).json(await stepMedia(payload, provider, model));
      case 'compose':   return res.status(200).json(await stepCompose(payload, provider, model));
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
  const { topic, sectionHeading, beats = [], grounded = false } = p;

  // Grounded path: use Google AI Studio's grounded generation (Gemini with
  // Google Search grounding) when NOTEBOOKLM_API_KEY (or GEMINI_API_KEY) is set.
  // Returns notes + sources[] with real URLs scraped from grounding metadata.
  if (grounded) {
    const grounded_out = await runGrounded(topic, sectionHeading, beats);
    if (grounded_out) return grounded_out;
    // fall through to ungrounded if grounded path failed
  }

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
- anything you're guessing at - flag explicitly so the editor doesn't accidentally publish it as fact.`;
  const notes = await callChat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], provider, model });
  return { notes, sources: [], grounded: false };
}

// Google AI Studio grounded generation - same key as NotebookLM personal use.
// Returns { notes, sources:[{title,uri}], grounded:true } on success, null on failure.
async function runGrounded (topic, sectionHeading, beats) {
  const key = process.env.NOTEBOOKLM_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text:
        `Research notes for the section "${sectionHeading}" of an article on "${topic}".\n` +
        `Beats: ${JSON.stringify(beats)}\n\n` +
        `Use grounded web search. Produce 6-12 fact-shaped bullets. Attribute names, dates, places. Flag anything uncertain. Plain text, no markdown.` }]}],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 }
    };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    const data = await r.json();
    const cand = data?.candidates?.[0];
    const notes = cand?.content?.parts?.map(p => p.text).filter(Boolean).join('\n').trim() || '';
    const grounding = cand?.groundingMetadata || cand?.citationMetadata || {};
    const chunks = grounding.groundingChunks || grounding.citations || [];
    const sources = chunks.map(c => ({
      title: c.web?.title || c.title || '',
      uri:   c.web?.uri   || c.uri   || ''
    })).filter(s => s.uri);
    return { notes, sources, grounded: true };
  } catch (e) {
    return null;
  }
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

// ----- stepMedia -----------------------------------------------------------
// Suggests visual + multimedia enrichment for the article. Outputs schema
// the item.html renderer expects: hero_image, gallery, embeds, pull_quotes,
// stats, related_topics. AI-generated suggestions only - the editor confirms.
async function stepMedia (p, provider, model) {
  const { topic, draft, sections = [] } = p;
  const prompt = `
For an article on "${topic}", suggest multimedia enrichment a publisher could add.
Use only what would genuinely strengthen the piece - don't pad.

Return JSON:
{
  "hero_image": { "query": "specific image search query for an Unsplash/Wikimedia hero", "alt": "..." },
  "gallery":    [ { "query": "...", "alt": "...", "caption": "..." } ],   // 0-4 items
  "embeds":     [ { "kind": "video|audio", "platform": "youtube|vimeo|bandcamp|soundcloud", "search_query": "...", "why": "..." } ],   // 0-3 items
  "pull_quotes": [ "short, sharp line lifted from the draft" ],   // 1-3
  "stats":      [ { "label": "...", "value": "...", "unit": "...", "source": "name + year, no URL invention" } ],   // 0-6
  "related_topics": [ "..." ]   // 3-6 short tags for cross-linking
}

ARTICLE DRAFT:
${(draft || '').slice(0, 6000)}

Return ONLY valid JSON.`;
  const text = await callChat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], provider, model });
  const parsed = tryJSON(text);
  if (!parsed) return { hero_image: null, gallery: [], embeds: [], pull_quotes: [], stats: [], related_topics: [], raw: text };
  return parsed;
}

// ----- stepCompose ---------------------------------------------------------
// End-to-end article composer. Runs every stage server-side and returns the
// complete article record ready for the publisher to review and persist.
async function stepCompose (p, provider, model) {
  const { topic, angle = '', length = 1500, audience = 'general afro-anarchist reader', voice = VOICE, grounded = true } = p;
  const ts = Date.now();

  // 1. Outline
  const { outline } = await stepOutline({ topic, angle, length, audience }, provider, model);
  if (!outline) return { article: null, error: 'outline failed' };

  // 2. Research per section (grounded if NOTEBOOKLM_API_KEY/GEMINI_API_KEY set)
  const allNotes = [];
  const allSources = [];
  for (const sec of (outline.sections || []).slice(0, 6)) {
    try {
      const { notes, sources = [] } = await stepResearch(
        { topic, sectionHeading: sec.heading, beats: sec.beats || [], grounded },
        provider, model
      );
      if (notes) allNotes.push(`## ${sec.heading}\n${notes}`);
      for (const src of sources) if (src.uri && !allSources.find(x => x.uri === src.uri)) allSources.push(src);
    } catch {}
  }
  const notes = allNotes.join('\n\n');

  // 3. Draft
  const { draft } = await stepDraft({ outline, notes }, provider, model);

  // 4. Polish
  const { polished } = await stepPolish({ draft, voice }, provider, model);
  const body = polished || draft || '';

  // 5. Headlines
  const head = await stepHeadline({ draft: body }, provider, model);

  // 6. Media suggestions
  const media = await stepMedia({ topic, draft: body, sections: outline.sections }, provider, model);

  const id = (head?.titles?.[0] || outline.title || topic)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '-' + ts;

  const article = {
    id,
    kind: 'article',
    title: head?.titles?.[0] || outline.title || topic,
    title_alts: head?.titles || [],
    deck: head?.deck || outline.hook || '',
    blurb: head?.blurb || '',
    body,                                  // markdown
    hero_image: media?.hero_image || null,
    gallery:    media?.gallery    || [],
    embeds:     media?.embeds     || [],
    pull_quotes: media?.pull_quotes || [],
    stats:      media?.stats      || [],
    related_topics: media?.related_topics || [],
    sources:    allSources,                // grounded URLs when available
    verify:     outline?.verify_before_publishing || [],
    grounded:   !!allSources.length,
    topic, angle, audience,
    ts,
    status: 'draft'
  };
  return { article };
}
