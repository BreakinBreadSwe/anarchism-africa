// Vercel serverless function — model-agnostic AI proxy
//
// POST /api/ai/chat
//   body: { provider, model, messages: [{role, content}, ...] }
//   resp: { text }
//
// Keys are read from Vercel env vars. Add only the providers you use.
//   OPENROUTER_API_KEY    — OpenRouter (free + paid models, default)
//   GEMINI_API_KEY        — Google Gemini (also used by Mark Lab image gen)
//   QWEN_API_KEY          — Alibaba DashScope (Qwen)
//   DEEPSEEK_API_KEY      — DeepSeek
//   KIMI_API_KEY          — Moonshot
//   GLM_API_KEY           — Zhipu
//   YI_API_KEY            — 01.ai
//   ANTHROPIC_API_KEY     — Claude
//   OPENAI_API_KEY        — OpenAI
//
// Default provider is OpenRouter on a free model — drops the cost to zero
// while we're still in beta. Override per request via { provider, model }.

const OPENROUTER_DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
const GEMINI_DEFAULT_MODEL     = 'gemini-1.5-flash';

// Provider chain for the default ('auto') path: try OpenRouter first,
// fall back to Gemini if it fails (rate limit, missing key, network error,
// quota exhausted). Each provider in the chain is tried in order.
const FALLBACK_CHAIN = ['openrouter', 'gemini'];

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { provider, model, messages = [] } = req.body || {};

  // If a specific provider is requested, honor it (no fallback). If the
  // caller passes 'auto' OR omits provider entirely, run the fallback
  // chain so the chat / article generator never goes dark just because
  // OpenRouter rate-limited the free tier.
  const useFallback = !provider || provider === 'auto';
  const chain = useFallback ? FALLBACK_CHAIN : [provider];

  const errors = [];
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i];
    // Only pass the user-supplied model to the FIRST provider — model
    // names don't translate across providers (a Llama model id would
    // make Gemini 404). Fallback providers use their own default.
    const m = (i === 0) ? model : undefined;
    try {
      const text = await dispatch(p, m, messages);
      if (text && String(text).trim()) {
        return res.status(200).json({
          text,
          provider: p,
          model: m || defaultModel(p),
          fallbackUsed: p !== chain[0]
        });
      }
      errors.push({ provider: p, error: 'empty response' });
    } catch (e) {
      errors.push({ provider: p, error: String(e.message || e) });
    }
  }
  return res.status(500).json({ error: 'all providers failed', tried: errors });
}

function defaultModel (p) {
  if (p === 'openrouter') return OPENROUTER_DEFAULT_MODEL;
  if (p === 'gemini')     return GEMINI_DEFAULT_MODEL;
  return undefined;
}

async function dispatch (provider, model, messages) {
  switch (provider) {
    case 'openrouter': return openrouter(model || OPENROUTER_DEFAULT_MODEL, messages);
    case 'gemini':     return gemini(model || 'gemini-1.5-flash', messages);
    case 'qwen':       return openaiCompat('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', process.env.QWEN_API_KEY, model || 'qwen-turbo', messages);
    case 'deepseek':   return openaiCompat('https://api.deepseek.com/chat/completions', process.env.DEEPSEEK_API_KEY, model || 'deepseek-chat', messages);
    case 'kimi':       return openaiCompat('https://api.moonshot.cn/v1/chat/completions', process.env.KIMI_API_KEY, model || 'moonshot-v1-8k', messages);
    case 'glm':        return openaiCompat('https://open.bigmodel.cn/api/paas/v4/chat/completions', process.env.GLM_API_KEY, model || 'glm-4', messages);
    case 'yi':         return openaiCompat('https://api.01.ai/v1/chat/completions', process.env.YI_API_KEY, model || 'yi-large', messages);
    case 'openai':     return openaiCompat('https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY, model || 'gpt-4o-mini', messages);
    case 'claude':     return claude(model || 'claude-haiku-4-5', messages);
    default:           throw new Error('Unknown provider: ' + provider);
  }
}

async function openrouter (model, messages) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY missing — set it in Vercel project env');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   'Bearer ' + key,
      // OpenRouter recommends these to qualify for free-tier ranking & analytics:
      'HTTP-Referer':  process.env.SITE_URL || 'https://anarchism.africa',
      'X-Title':       'ANARCHISM.AFRICA'
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 })
  });
  if (!r.ok) throw new Error('OpenRouter ' + r.status + ' ' + (await r.text()).slice(0, 400));
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

async function gemini (model, messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  const sys = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: sys ? { parts: [{ text: sys }] } : undefined, contents })
  });
  if (!r.ok) throw new Error('Gemini ' + r.status + ' ' + (await r.text()));
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function openaiCompat (url, key, model, messages) {
  if (!key) throw new Error('API key missing for ' + url);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model, messages, temperature: 0.7 })
  });
  if (!r.ok) throw new Error(url + ' ' + r.status + ' ' + (await r.text()));
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

async function claude (model, messages) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  const sys = messages.find(m => m.role === 'system')?.content || '';
  const msgs = messages.filter(m => m.role !== 'system');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system: sys, messages: msgs, max_tokens: 1024 })
  });
  if (!r.ok) throw new Error('Claude ' + r.status + ' ' + (await r.text()));
  const data = await r.json();
  return data.content?.[0]?.text || '';
}
