// Vercel serverless — mailing list subscribe
// POST /api/mailing/subscribe { email, name, segments? }
// Persists to Supabase mailing_list table when configured, else echoes.
export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { email, name, segments = ['general'] } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (url && key) {
    const r = await fetch(`${url}/rest/v1/mailing_list`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ email, name, segments })
    });
    return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
  }
  return res.status(200).json({ ok: true, mode: 'demo', email });
}
