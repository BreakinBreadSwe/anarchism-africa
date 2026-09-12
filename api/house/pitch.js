// POST /api/house/pitch
//   body: { plan, budget, applicant, site, story, tone: 'formal'|'warm'|'punchy', city_override }
//   resp: { pitch (markdown), source: 'ai'|'template', provider, model }
//
// Writes the letter to the city. The deterministic template is always
// produced first (so there is always a pitch); if a text provider is
// configured the model rewrites it into a persuasive, specific letter using
// ONLY the numbers and programs in the template.
import estimator from '../../lib/house-estimator.js';
import ai from '../../lib/house-ai.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } }, maxDuration: 60 };

const SYSTEM = `You write short, concrete funding pitches to city housing departments on behalf of working families building their own home. Plain English, no jargon, no flattery. Every number and program name must come from the draft you are given — never invent figures, programs or laws. Keep the markdown headings and the budget table. Output markdown only.`;

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { plan: rawPlan, budget: rawBudget, applicant, site, story, tone = 'warm', city, ...budgetOpts } = req.body || {};
  let plan, budget;
  try {
    plan = estimator.normalizePlan(rawPlan);
    budget = rawBudget && rawBudget.items ? rawBudget : estimator.estimateBudget(plan, { city, ...budgetOpts });
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
  const draft = estimator.pitchTemplate(plan, budget, { applicant, site });

  try {
    const r = await ai.chat({
      system: SYSTEM,
      prompt: `Rewrite this draft into the final pitch. Tone: ${tone}. Audience: ${budget.city.dept}, ${budget.city.name}.
${story ? `\nThe family's story, in their words (weave in 2-3 sentences of it, keep their voice):\n"""${String(story).slice(0, 1500)}"""\n` : ''}
Keep: the title, To/From/Re lines, every section heading, the full budget table, the phasing list, the programs list. Make the "ask" and the "why this is good for the city" sections sharper and more specific to ${budget.city.name}. Under 700 words outside the table.

DRAFT:
${draft}`,
      effort: 'low', max_tokens: 6000
    });
    const text = String(r.text || '').trim();
    if (text.length < 300 || !/\|/.test(text)) throw new Error('model dropped the budget table');
    return res.status(200).json({ pitch: text, source: 'ai', provider: r.provider, model: r.model, plan, budget });
  } catch (e) {
    return res.status(200).json({ pitch: draft, source: 'template', provider: null, model: null, plan, budget,
      warning: e.code === 'NO_PROVIDER' ? 'No AI text provider configured — this is the template pitch. Edit it freely.' : 'AI rewrite failed (' + String(e.message || e).slice(0, 140) + ') — this is the template pitch.' });
  }
}
