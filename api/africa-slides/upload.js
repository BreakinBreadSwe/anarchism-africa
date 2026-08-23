// POST /api/africa-slides/upload
//
// Client-direct upload token handler. Uses @vercel/blob/client's
// handleUpload flow so files stream DIRECTLY from the browser to
// Vercel Blob storage — the request never carries the file bytes
// through this serverless function.
//
// This bypasses Vercel's 4.5 MB serverless FUNCTION_PAYLOAD_TOO_LARGE
// cap that was blocking users trying to upload GIFs or larger images
// through the previous raw-stream endpoint. The new limit is Vercel
// Blob's own 500 MB (per single file), well past anything the CMS
// needs.
//
// Flow:
//   1. Client (js/africa-hero-cms.js uploadFile) imports
//      @vercel/blob/client and calls upload(pathname, file, {
//         handleUploadUrl: '/api/africa-slides/upload'
//      })
//   2. The client SDK POSTs a small JSON envelope here asking for a
//      short-lived signed URL.
//   3. handleUpload() issues the token and returns JSON to the client.
//   4. The client PUTs the file bytes DIRECTLY to Blob storage.
//   5. Blob storage calls back to this endpoint with the completion
//      event; onUploadCompleted logs it (no-op for the CMS).
//
// Auth: same admin/publisher gate as the sibling africa-slides endpoint.

const { handleUpload } = require('@vercel/blob/client');
const { readSession }  = require('../auth/_session.js');

module.exports = async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method not allowed' }); }
  const gate = await allowWrite(req);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });

  try {
    // The client SDK sends a JSON envelope. Vercel's default body parser
    // handles it — we don't need the raw-stream config anymore.
    let body = req.body;
    if (!body || typeof body === 'string') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    }

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname /* , clientPayload */) => {
        // Enforce our naming scheme + limits. The client-supplied
        // pathname is trusted only for the extension — we prefix
        // 'africa-hero/uploads/' + Date.now() ourselves for safety.
        return {
          allowedContentTypes: [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
            'video/mp4', 'video/webm', 'video/quicktime',
            'application/octet-stream'
          ],
          addRandomSuffix:      false,
          maximumSizeInBytes:   500 * 1024 * 1024,
          cacheControlMaxAge:   60 * 60 * 24 * 365,
          tokenPayload:         JSON.stringify({}),
        };
      },
      onUploadCompleted: async ({ blob /* , tokenPayload */ }) => {
        // Blob storage pings us after the direct upload succeeds. The
        // CMS re-fetches /api/africa-slides/media on its own; nothing
        // to persist here.
        try { console.log('[upload] direct-to-blob completed:', blob.pathname, blob.size); } catch {}
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e).slice(0, 400) });
  }
};

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
