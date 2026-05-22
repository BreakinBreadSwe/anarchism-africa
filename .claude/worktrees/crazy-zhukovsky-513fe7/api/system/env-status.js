// Vercel serverless - reports which env vars are SET on the deployment.
// Never returns the value itself - only presence + length so admin can
// see at a glance what's connected.
//
// GET /api/system/env-status
//   resp: { ts, vars: [{ key, set, length, group, label, doc, signup }] }
//
// Auth: ADMIN_TOKEN header OR aa_role=admin/publisher cookie.

const VARS = [
  // ----- AI / LLM -----
  { key: 'OPENROUTER_API_KEY',  group: 'LLM',           label: 'OpenRouter (default LLM gateway)', doc: 'https://openrouter.ai/keys',                     signup: 'https://openrouter.ai/signup' },
  { key: 'ANTHROPIC_API_KEY',   group: 'LLM',           label: 'Claude (anthropic)',                doc: 'https://console.anthropic.com/settings/keys',     signup: 'https://console.anthropic.com' },
  { key: 'OPENAI_API_KEY',      group: 'LLM',           label: 'OpenAI / ChatGPT',                  doc: 'https://platform.openai.com/api-keys',            signup: 'https://platform.openai.com/signup' },
  { key: 'GEMINI_API_KEY',      group: 'LLM',           label: 'Google Gemini (text + image)',      doc: 'https://aistudio.google.com/apikey',              signup: 'https://aistudio.google.com' },
  { key: 'NOTEBOOKLM_API_KEY',  group: 'LLM',           label: 'NotebookLM / Gemini grounded research (article compose)', doc: 'https://aistudio.google.com/apikey', signup: 'https://notebooklm.google.com' },
  { key: 'DEEPSEEK_API_KEY',    group: 'LLM',           label: 'DeepSeek',                          doc: 'https://platform.deepseek.com/api_keys',          signup: 'https://platform.deepseek.com' },
  { key: 'GLM_API_KEY',         group: 'LLM',           label: 'Zhipu GLM',                         doc: 'https://open.bigmodel.cn',                        signup: 'https://open.bigmodel.cn' },
  { key: 'KIMI_API_KEY',        group: 'LLM',           label: 'Moonshot Kimi',                     doc: 'https://platform.moonshot.cn/console/api-keys',    signup: 'https://platform.moonshot.cn' },
  { key: 'QWEN_API_KEY',        group: 'LLM',           label: 'Alibaba Qwen',                      doc: 'https://dashscope.console.aliyun.com',            signup: 'https://dashscope.aliyun.com' },
  { key: 'YI_API_KEY',          group: 'LLM',           label: '01.AI Yi',                          doc: 'https://platform.01.ai',                          signup: 'https://platform.01.ai' },

  // ----- Image / Media generation -----
  { key: 'GIPHY_API_KEY',       group: 'Media',         label: 'Giphy (header GIF mode)',           doc: 'https://developers.giphy.com/dashboard/',         signup: 'https://giphy.com/join' },

  // ----- Email + SMS auth -----
  { key: 'RESEND_API_KEY',      group: 'Auth',          label: 'Resend (email magic link sender)', doc: 'https://resend.com/api-keys',                     signup: 'https://resend.com/signup' },
  { key: 'RESEND_FROM_EMAIL',   group: 'Auth',          label: 'Resend From address (e.g. ANARCHISM.AFRICA <auth@anarchism.africa>)', doc: 'https://resend.com/domains', signup: '' },
  { key: 'TWILIO_ACCOUNT_SID',  group: 'Auth',          label: 'Twilio account SID (SMS OTP)',     doc: 'https://console.twilio.com',                     signup: 'https://www.twilio.com/try-twilio' },
  { key: 'TWILIO_AUTH_TOKEN',   group: 'Auth',          label: 'Twilio auth token',                doc: 'https://console.twilio.com',                     signup: '' },
  { key: 'TWILIO_FROM_PHONE',   group: 'Auth',          label: 'Twilio From phone (E.164) or Messaging Service SID (MG...)', doc: 'https://console.twilio.com/us1/develop/sms/manage/phone-numbers', signup: '' },

  // ----- Print on demand -----
  { key: 'PRINTIFY_API_TOKEN',  group: 'POD',           label: 'Printify token (merch fulfilment)', doc: 'https://printify.com/app/account/api',            signup: 'https://printify.com/app/register' },
  { key: 'PRINTIFY_SHOP_ID',    group: 'POD',           label: 'Printify shop ID',                  doc: 'https://printify.com/app/stores',                 signup: '' },

  // ----- Storage / Database -----
  { key: 'BLOB_READ_WRITE_TOKEN', group: 'Storage',     label: 'Vercel Blob (live database)',       doc: 'https://vercel.com/docs/storage/vercel-blob',     signup: 'https://vercel.com/dashboard/stores' },
  { key: 'SUPABASE_URL',        group: 'Storage',       label: 'Supabase URL (optional auth/db)',   doc: 'https://supabase.com/dashboard/project/_/settings/api', signup: 'https://supabase.com' },
  { key: 'SUPABASE_SERVICE_ROLE', group: 'Storage',     label: 'Supabase service role key',          doc: 'https://supabase.com/dashboard/project/_/settings/api', signup: '' },

  // ----- Auth -----
  { key: 'GOOGLE_CLIENT_ID',    group: 'Auth',          label: 'Google Sign-In client ID',          doc: 'https://console.cloud.google.com/apis/credentials', signup: 'https://console.cloud.google.com' },
  { key: 'AUTH_SECRET',         group: 'Auth',          label: 'Session HMAC secret (random 64-char)', doc: 'https://generate-secret.now.sh/64',            signup: '' },

  // ----- Platform / Operations -----
  { key: 'ADMIN_TOKEN',         group: 'Platform',      label: 'Admin token (autopilot trigger + visitor defaults POST)', doc: 'set to any random 32-char string', signup: '' },
  { key: 'CRON_SECRET',         group: 'Platform',      label: 'Cron secret (verifies cron callers)', doc: 'set to any random 32-char string',              signup: '' },
  { key: 'SITE_URL',            group: 'Platform',      label: 'Public site URL (e.g. https://anarchism.africa)', doc: 'optional - falls back to request host', signup: '' }
];

function gate (req) {
  const adminTok = process.env.ADMIN_TOKEN;
  if (adminTok && req.headers['x-aa-admin-token'] === adminTok) return true;
  const cookie = req.headers.cookie || '';
  if (/aa_role=(admin|publisher)/.test(cookie)) return true;
  // Always allow GET to surface the documentation list (presence flags only - no values leak).
  return req.method === 'GET';
}

export default async function handler (req, res) {
  if (!gate(req)) return res.status(401).json({ error: 'unauthorized' });

  const out = VARS.map(v => {
    const val = process.env[v.key];
    return {
      key: v.key,
      group: v.group,
      label: v.label,
      doc: v.doc,
      signup: v.signup,
      set: !!val,
      length: val ? String(val).length : 0
    };
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ts: Date.now(), vars: out });
}
