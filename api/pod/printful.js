// Vercel serverless — Printful v1 API proxy (account-level token aware)
//
// Auth: set PRINTFUL_API_KEY in Vercel env to the luvlab account-level token.
// Store scoping: this account key spans MANY stores, so every store-scoped
// request MUST send the `X-PF-Store-Id` header or Printful can't tell which
// store you mean. We pin ANARCHISM.AFRICA's store (18296172) as the default;
// override with PRINTFUL_STORE_ID env if needed.
//
// GET  /api/pod/printful?op=status                     — verify AA store reachable
// GET  /api/pod/printful?op=stores                     — list all stores on the token
// GET  /api/pod/printful?op=store_products             — list THIS store's synced products
// GET  /api/pod/printful?op=store_product&id=N         — one synced product + variants
// GET  /api/pod/printful?op=catalog                    — GET /catalog/products (Printful catalog)
// GET  /api/pod/printful?op=product&id=N               — catalog product + variants
// GET  /api/pod/printful?op=mockup_poll&key=TASK_KEY   — poll one mockup task
// POST /api/pod/printful { op:'upload', imageUrl|imageB64, fileName }
// POST /api/pod/printful { op:'product', storeId?, syncProduct, syncVariants }
// POST /api/pod/printful { op:'mockup_start', productId, variantIds, format? }
// POST /api/pod/printful { op:'order', storeId?, recipient, items }

const BASE = 'https://api.printful.com';

// ANARCHISM.AFRICA Printful store. Store IDs are not secret; this guarantees an
// account-level token targets AA even if PRINTFUL_STORE_ID env is unset.
const AA_STORE_ID = '18296172';

function token () {
  const t = process.env.PRINTFUL_API_KEY;
  if (!t) throw new Error('PRINTFUL_API_KEY missing — set the account-level token in Vercel env');
  return t;
}

function configuredStore () {
  return String(process.env.PRINTFUL_STORE_ID || AA_STORE_ID).trim();
}

// Resolve the configured store to a NUMERIC id. Tolerates PRINTFUL_STORE_ID
// being set to a store NAME (e.g. "anarchism.africa") instead of the id —
// a common mistake — by looking it up against /stores. Cached on the warm
// lambda so it costs at most one extra call.
let _resolvedId = null;
async function resolveStoreId () {
  if (_resolvedId) return _resolvedId;
  const cfg = configuredStore();
  if (/^\d+$/.test(cfg)) { _resolvedId = cfg; return _resolvedId; }
  // Non-numeric → treat as a name and look it up.
  const resp = await pf('/stores');
  const stores = resp.result || resp.data || resp;
  const list = Array.isArray(stores) ? stores : [];
  const hit = list.find(s => String(s.name).toLowerCase() === cfg.toLowerCase());
  _resolvedId = hit ? String(hit.id) : AA_STORE_ID; // fall back to AA
  return _resolvedId;
}

// pf(path, init, scopeStoreId?) — when scopeStoreId is given (or true), send the
// X-PF-Store-Id header so an account-level token targets that store.
async function pf (path, init = {}, scope) {
  const headers = {
    Authorization: 'Bearer ' + token(),
    'Content-Type': 'application/json',
    'User-Agent': 'ANARCHISM.AFRICA/1.0',
    ...(init.headers || {})
  };
  const sid = scope === true ? configuredStore() : (scope ? String(scope) : null);
  if (sid) headers['X-PF-Store-Id'] = sid;

  const r = await fetch(BASE + path, { ...init, headers });
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!r.ok) {
    const msg = (body && (body.error?.message || body.error?.reason || body.message || body.error)) || ('HTTP ' + r.status);
    const err = new Error('Printful ' + r.status + ': ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    err.status = r.status; err.body = body;
    throw err;
  }
  return body;
}

export default async function handler (req, res) {
  try {
    if (req.method === 'GET') {
      const op = (req.query.op || '').toString();

      if (op === 'status') {
        // Confirm the token works AND the AA store is present on it.
        const sid = await resolveStoreId();
        const resp = await pf('/stores');
        const stores = resp.result || resp.data || resp;
        const list = Array.isArray(stores) ? stores : [];
        const mine = list.find(s => String(s.id) === sid) || null;
        let productCount = null;
        if (mine) {
          try {
            const p = await pf('/store/products?limit=1', {}, sid);
            productCount = (p.paging && p.paging.total) ?? (Array.isArray(p.result) ? p.result.length : null);
          } catch { /* count is best-effort */ }
        }
        return res.status(200).json({
          connected: !!mine,
          storeId: sid,
          storeName: mine?.name || null,
          storeType: mine?.type || null,
          productCount,
          storesOnToken: list.map(s => ({ id: String(s.id), name: s.name })),
        });
      }

      if (op === 'stores') {
        const resp = await pf('/stores');
        return res.status(200).json(resp);
      }

      if (op === 'store_products') {
        // List THIS store's synced (sellable) products. Account token → header.
        const limit = req.query.limit || 100;
        const offset = req.query.offset || 0;
        const sid = await resolveStoreId();
        let resp;
        try {
          resp = await pf(`/store/products?limit=${limit}&offset=${offset}`, {}, sid);
        } catch (e) {
          // Older stores expose the legacy /sync/products path instead.
          resp = await pf(`/sync/products?limit=${limit}&offset=${offset}`, {}, sid);
        }
        return res.status(200).json(resp);
      }

      if (op === 'store_product') {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'id required' });
        const sid = await resolveStoreId();
        let resp;
        try { resp = await pf(`/store/products/${id}`, {}, sid); }
        catch { resp = await pf(`/sync/products/${id}`, {}, sid); }
        return res.status(200).json(resp);
      }

      if (op === 'catalog') {
        const resp = await pf('/catalog/products');
        return res.status(200).json(resp);
      }

      if (op === 'product') {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'id required' });
        const [info, variants] = await Promise.all([
          pf(`/catalog/products/${id}`),
          pf(`/catalog/products/${id}/variants`)
        ]);
        return res.status(200).json({ product: info.result || info, variants: variants.result || variants });
      }

      if (op === 'mockup_poll') {
        const key = (req.query.key || '').toString();
        if (!key) return res.status(400).json({ error: 'key (task_key) required' });
        const resp = await pf(`/mockup-generator/task?task_key=${encodeURIComponent(key)}`);
        return res.status(200).json(resp.result || resp);
      }

      return res.status(400).json({ error: 'unknown op (try status|stores|store_products|store_product|catalog|product|mockup_poll)' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

    const body = req.body || {};
    const op = body.op;

    if (op === 'upload') {
      const fileName = body.fileName || ('aa-' + Date.now() + '.png');
      let payload;
      if (body.imageUrl) {
        payload = { type: 'default', url: body.imageUrl, filename: fileName, visible: true };
      } else if (body.imageB64) {
        payload = { type: 'default', url: 'data:image/png;base64,' + body.imageB64, filename: fileName, visible: true };
      } else {
        return res.status(400).json({ error: 'imageUrl or imageB64 required' });
      }
      const resp = await pf('/files', { method: 'POST', body: JSON.stringify(payload) });
      return res.status(200).json(resp.result || resp);
    }

    if (op === 'product') {
      // Create a synced product in the AA store. Account token → X-PF-Store-Id.
      const sid = body.storeId ? String(body.storeId) : await resolveStoreId();
      const payload = {
        sync_product: body.syncProduct || { name: 'ANARCHISM.AFRICA — product', thumbnail: '' },
        sync_variants: body.syncVariants || []
      };
      const resp = await pf('/store/products', { method: 'POST', body: JSON.stringify(payload) }, sid);
      return res.status(200).json({ ...(resp.result || resp), store_id: sid });
    }

    if (op === 'mockup_start') {
      const productId = body.productId;
      if (!productId) return res.status(400).json({ error: 'productId required' });
      const payload = {
        variant_ids: body.variantIds || [],
        format: body.format || 'jpg',
        width: body.width || 1200
      };
      const createResp = await pf(`/mockup-generator/task?id=${productId}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const task = createResp.result || createResp;
      const taskKey = task.task_key;
      if (!taskKey) return res.status(500).json({ error: 'No task_key returned from Printful', raw: createResp });
      return res.status(202).json({ task_key: taskKey, status: task.status || 'pending' });
    }

    if (op === 'order') {
      const sid = body.storeId ? String(body.storeId) : await resolveStoreId();
      const payload = {
        recipient: body.recipient,
        items: body.items || [],
        retail_costs: body.retailCosts || null,
        gift: body.gift || null
      };
      const resp = await pf('/orders', { method: 'POST', body: JSON.stringify(payload) }, sid);
      return res.status(200).json({ ...(resp.result || resp), store_id: sid });
    }

    return res.status(400).json({ error: 'unknown op (try upload|product|mockup_start|order)' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: String(e.message || e), body: e.body || null });
  }
}
