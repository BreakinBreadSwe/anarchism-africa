// Vercel Cron — daily slogan generator. Calls /api/ai/generate-slogans with
// persist:true so the queue at content/merch/slogans.json keeps growing
// with rejection-aware variety. The publisher reviews them in Merch Lab
// and approved ones become t-shirt designs via api/merch/generate-shirt.
export default async function handler (req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && !req.headers['x-vercel-cron-signature']) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;
  try {
    const r = await fetch(`${origin}/api/ai/generate-slogans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 8, categories: ['all'], persist: true })
    });
    const data = await r.json();
    return res.status(200).json({ ok: r.ok, ...data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
