// GET /api/media/list — enumerate hero background media that the user
// dropped into /media/ in the repo. Returns [{ name, url, type }] where
// type is 'image' | 'gif' | 'video'. Static-served under /media/<name>.
//
// User's workflow: git add media/whatever.mp4 → next deploy the file
// appears in the home hero rotation automatically. No CMS entry needed.

const fs = require('fs');
const path = require('path');

const IMG = /\.(jpe?g|png|webp|avif)$/i;
const GIF = /\.gif$/i;
const VID = /\.(mp4|webm|mov|m4v)$/i;

module.exports = function handler (req, res) {
  try {
    const dir = path.join(process.cwd(), 'media');
    if (!fs.existsSync(dir)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, files: [] });
    }
    const files = fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .filter(f => IMG.test(f) || GIF.test(f) || VID.test(f))
      .map(name => ({
        name,
        url: '/media/' + name,
        type: VID.test(name) ? 'video' : (GIF.test(name) ? 'gif' : 'image')
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ ok: true, files });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
