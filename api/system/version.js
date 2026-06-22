// GET /api/system/version
// Returns the current deployment's git SHA + build timestamp so the
// client-side update notifier can detect when a new version has shipped.
//
// VERCEL_GIT_COMMIT_SHA is set automatically by Vercel on every deploy.
// Falls back to 'dev' in local / preview-without-git environments.
//
// no-store so polling clients always hit the function and see the new
// deploy's value (not the previous deploy's cached response).

module.exports = function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    version:     process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
    short:       (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7),
    deployed_at: process.env.VERCEL_DEPLOYMENT_ID ? null : null, // (Vercel doesn't expose deploy timestamp directly; SHA is the truth)
    region:      process.env.VERCEL_REGION || 'local',
    env:         process.env.VERCEL_ENV    || 'development'
  });
};
