/* lib/house-ai.js — HOUSE LAB model-agnostic AI helper (server only).
 *
 * Same philosophy as api/ai/chat.js: raw HTTP, keys from env, a fallback
 * chain that skips any provider whose key is missing, and never a key in
 * the browser. Two chains:
 *   VISION_CHAIN — for reading sketches (needs image input)
 *   TEXT_CHAIN   — for writing the pitch (independent / open-weights first)
 *
 * chat({ system, prompt, images:[{mime,data}], json:true, chain })
 *   → { text, provider, model }  or throws if every provider failed.
 */
const VISION_CHAIN = ['claude', 'gemini', 'openai', 'openrouter'];
const TEXT_CHAIN   = ['kimi', 'deepseek', 'qwen', 'openrouter', 'gemini', 'claude', 'openai'];

const CLAUDE_MODEL      = process.env.HOUSE_CLAUDE_MODEL     || 'claude-opus-5';
const GEMINI_MODEL      = process.env.HOUSE_GEMINI_MODEL     || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const OPENAI_MODEL      = process.env.HOUSE_OPENAI_MODEL     || 'gpt-4o-mini';
const OPENROUTER_VISION = process.env.OPENROUTER_VISION_MODEL || 'qwen/qwen2.5-vl-72b-instruct:free';
const OPENROUTER_TEXT   = process.env.OPENROUTER_MODEL        || 'deepseek/deepseek-chat-v3.1:free';

function clean (v) { return String(v == null ? '' : v).replace(/\s+/g, ''); }
function hasKey (p) {
  return !!clean({
    claude: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY, openai: process.env.OPENAI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY, kimi: process.env.KIMI_API_KEY, deepseek: process.env.DEEPSEEK_API_KEY, qwen: process.env.QWEN_API_KEY
  }[p]);
}

async function chat (opts) {
  const images = (opts.images || []).filter(i => i && i.data);
  const chain = (opts.chain || (images.length ? VISION_CHAIN : TEXT_CHAIN)).filter(hasKey);
  if (opts.provider && hasKey(opts.provider)) chain.unshift(opts.provider);
  if (!chain.length) throw Object.assign(new Error('no AI provider configured'), { code: 'NO_PROVIDER' });
  const errors = [];
  for (const p of [...new Set(chain)]) {
    try {
      const text = await dispatch(p, opts, images);
      if (!text || !text.trim()) throw new Error('empty response');
      return { text, provider: p, model: modelFor(p, images.length > 0) };
    } catch (e) {
      errors.push(p + ': ' + String(e.message || e).slice(0, 200));
    }
  }
  throw Object.assign(new Error('all providers failed — ' + errors.join(' | ')), { code: 'ALL_FAILED', errors });
}

function modelFor (p, vision) {
  return { claude: CLAUDE_MODEL, gemini: GEMINI_MODEL, openai: OPENAI_MODEL, openrouter: vision ? OPENROUTER_VISION : OPENROUTER_TEXT,
    kimi: 'kimi-k2-0905-preview', deepseek: 'deepseek-chat', qwen: 'qwen-plus' }[p];
}

function dispatch (p, opts, images) {
  switch (p) {
    case 'claude':     return claude(opts, images);
    case 'gemini':     return gemini(opts, images);
    case 'openai':     return openaiCompat('https://api.openai.com/v1/chat/completions', clean(process.env.OPENAI_API_KEY), OPENAI_MODEL, opts, images);
    case 'openrouter': return openaiCompat('https://openrouter.ai/api/v1/chat/completions', clean(process.env.OPENROUTER_API_KEY), images.length ? OPENROUTER_VISION : OPENROUTER_TEXT, opts, images, {
      'HTTP-Referer': process.env.SITE_URL || 'https://anarchism.africa', 'X-Title': 'ANARCHISM.AFRICA House Lab' });
    case 'kimi':       return openaiCompat(process.env.KIMI_API_URL || 'https://api.moonshot.ai/v1/chat/completions', clean(process.env.KIMI_API_KEY), 'kimi-k2-0905-preview', opts, images);
    case 'deepseek':   return openaiCompat(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions', clean(process.env.DEEPSEEK_API_KEY), 'deepseek-chat', opts, images);
    case 'qwen':       return openaiCompat(process.env.QWEN_API_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', clean(process.env.QWEN_API_KEY), 'qwen-plus', opts, images);
    default: throw new Error('unknown provider ' + p);
  }
}

// Anthropic Messages API — raw HTTP to match the rest of /api. Vision via
// base64 image blocks; server-side refusal fallbacks enabled so a declined
// request is re-run on a fallback model inside the same call.
async function claude (opts, images) {
  const key = clean(process.env.ANTHROPIC_API_KEY);
  const content = images.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } }));
  content.push({ type: 'text', text: opts.prompt });
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: opts.max_tokens || 8000,
    system: opts.system || undefined,
    messages: [{ role: 'user', content }],
    output_config: { effort: opts.effort || 'medium' },
    fallbacks: 'default'
  };
  if (opts.json) body.output_config.format = { type: 'json_schema', schema: opts.json_schema || { type: 'object', additionalProperties: true } };
  const send = (b, beta) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', ...(beta ? { 'anthropic-beta': beta } : {}) },
    body: JSON.stringify(b)
  });
  let r = await send(body, 'server-side-fallback-2026-07-01');
  if (r.status === 400) {
    // Org without the fallback beta / structured-output support: retry once plain.
    const plain = { ...body, output_config: { effort: body.output_config.effort } };
    delete plain.fallbacks;
    r = await send(plain, null);
  }
  if (!r.ok) throw new Error('Claude ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  if (data.stop_reason === 'refusal') throw new Error('Claude refused (' + (data.stop_details && data.stop_details.category) + ')');
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

async function gemini (opts, images) {
  const key = clean(process.env.GEMINI_API_KEY);
  const parts = images.map(i => ({ inline_data: { mime_type: i.mime, data: i.data } }));
  parts.push({ text: opts.prompt });
  const body = {
    systemInstruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
    contents: [{ role: 'user', parts }],
    generationConfig: opts.json ? { responseMimeType: 'application/json' } : undefined
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Gemini ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  const cand = data.candidates && data.candidates[0];
  const text = cand && cand.content && cand.content.parts && cand.content.parts.map(p => p.text || '').join('');
  if (!text) throw new Error('Gemini empty (' + ((cand && cand.finishReason) || 'no candidate') + ')');
  return text;
}

async function openaiCompat (url, key, model, opts, images, extraHeaders = {}) {
  if (!key) throw new Error('key missing');
  const content = images.length
    ? [...images.map(i => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } })), { type: 'text', text: opts.prompt }]
    : opts.prompt;
  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content });
  const body = { model, messages, temperature: opts.json ? 0.2 : 0.7 };
  if (opts.json && !/openrouter/.test(url)) body.response_format = { type: 'json_object' };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, ...extraHeaders }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(model + ' ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

// Pull the first {...} object out of a model reply (handles ```json fences and chatter).
function extractJSON (text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) throw new Error('no JSON object in reply');
  return JSON.parse(s.slice(a, b + 1));
}

function providersConfigured () {
  return { vision: VISION_CHAIN.filter(hasKey), text: TEXT_CHAIN.filter(hasKey) };
}

module.exports = { chat, extractJSON, providersConfigured, VISION_CHAIN, TEXT_CHAIN };
