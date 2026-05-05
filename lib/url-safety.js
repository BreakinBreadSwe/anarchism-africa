/* lib/url-safety.js — shared URL validation for any code path that stores or
 * fetches a URL on behalf of a user (admin save, scraper enqueue, link verifier).
 *
 * Two concerns, both addressed here:
 *
 *   1. Scheme whitelist — reject `javascript:`, `data:`, `file:`, `ftp:` etc.
 *      so a malicious feed entry or admin paste can't ship a click-to-XSS link
 *      to the public site. Only http(s) is allowed.
 *
 *   2. SSRF guard — for URLs we *fetch* server-side (link verifier), reject
 *      hostnames that resolve to loopback / RFC-1918 / link-local / cloud
 *      metadata so the verifier can't be tricked into probing internal
 *      infrastructure with our credentials.
 *
 * Both checks are syntactic — we don't do DNS resolution. An attacker who
 * controls a DNS record can still rebind to a private IP after the check.
 * For the verifier's threat model (publishing 4xx/2xx/timeout to a row in the
 * DB, no body forwarding) this is acceptable; tighten with DNS-pinned fetch
 * if the verifier ever starts forwarding response bodies.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,        // link-local + AWS IMDS
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT
  /^::1$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^metadata\.google\.internal$/i,
  /\.internal$/i,
  /\.local$/i
];

function parseSafe (url) {
  if (!url || typeof url !== 'string') return null;
  try { return new URL(url); }
  catch { return null; }
}

/* Returns true iff the URL parses AND uses an http(s) scheme. */
function isPublicScheme (url) {
  const u = parseSafe(url);
  return !!(u && ALLOWED_SCHEMES.has(u.protocol));
}

/* Returns true iff the URL is safe to fetch from server-side code:
 * public scheme + hostname not in the private/metadata blocklist. */
function isSafeToFetch (url) {
  const u = parseSafe(url);
  if (!u || !ALLOWED_SCHEMES.has(u.protocol)) return false;
  // Node's URL.hostname keeps brackets around IPv6 literals — strip them so
  // `[::1]` matches the `^::1$` pattern. Lower-case for case-insensitive
  // hex-digit matching of fc00::/fe80:: ranges.
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  for (const p of PRIVATE_HOST_PATTERNS) if (p.test(host)) return false;
  return true;
}

/* Sanitise an object's URL-bearing fields in place — invalid URLs are deleted
 * (not silently coerced) so the caller's validation surface stays explicit.
 * Returns the list of fields that were dropped. */
function dropUnsafeUrls (obj, fields = ['external_url', 'source_url', 'url', 'audio', 'video', 'image']) {
  const dropped = [];
  for (const f of fields) {
    if (obj[f] != null && obj[f] !== '' && !isPublicScheme(obj[f])) {
      dropped.push(f);
      delete obj[f];
    }
  }
  return dropped;
}

module.exports = {
  isPublicScheme,
  isSafeToFetch,
  dropUnsafeUrls,
  ALLOWED_SCHEMES
};
