// POST /api/africa-slides/upload — multipart file → uploaded to Vercel
// Blob under 'africa-hero/uploads/<timestamp>-<name>'. Returns { url,
// pathname, size, contentType }. The CMS calls this from the file
// picker, then uses the returned url as the src of a new slide.
//
// Auth: same admin/publisher gate as the sibling africa-slides endpoint.

const { readSession } = require('../auth/_session.js');

module.exports = async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method not allowed' }); }
  const gate = await allowWrite(req);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });

  try {
    const { put } = require('@vercel/blob');
    // The client uploads raw bytes with:
    //   Content-Type: <mime>
    //   x-filename: <original name>
    // Simpler than parsing multipart for a single-file endpoint.
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const raw = req.headers['x-filename'] || 'upload.bin';
    const safe = String(raw).replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key  = `africa-hero/uploads/${Date.now()}-${safe}`;

    // Collect the request body as a Buffer.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (!body.length) return res.status(400).json({ error: 'empty upload body' });
    if (body.length > 60 * 1024 * 1024) return res.status(413).json({ error: 'file exceeds 60 MB' });

    const blob = await put(key, body, {
      access:              'public',
      contentType,
      addRandomSuffix:     false,
      cacheControlMaxAge:  60 * 60 * 24 * 365
    });
    return res.status(200).json({
      ok: true,
      url:         blob.url,
      pathname:    blob.pathname,
      size:        body.length,
      contentType
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 400) });
  }
};

// Disable Vercel's default JSON body parser so req is a raw readable stream.
module.exports.config = { api: { bodyParser: false } };

async function allowWrite (req) {
  const adminTok = process.env.AA_ADMIN_TOKEN;
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
