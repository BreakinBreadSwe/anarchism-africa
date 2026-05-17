// Vercel serverless — Printful v2 API proxy
// PRINTFUL_API_KEY required in Vercel env. PRINTFUL_STORE_ID optional.
//
// GET  /api/pod/printful?op=catalog                    — GET /catalog/products
// GET  /api/pod/printful?op=product&id=N               — GET /catalog/products/{id}/variants
// GET  /api/pod/printful?op=stores                     — GET /stores
// GET  /api/pod/printful?op=mockup_poll&key=TASK_KEY   — poll one mockup task (no blocking loop)
// POST /api/pod/printful { op:'upload', imageUrl|imageB64, fileName }
// POST /api/pod/printful { op:'product', storeId?, productId?, syncProduct, syncVariants }
// POST /api/pod/printful { op:'mockup_start', productId, variantIds, format? }  → returns { task_key, status:'pending' }
// POST /api/pod/printful { op:'order', storeId?, recipient, items }
//
// Mockup generation is async: call mockup_start, receive task_key, then
// poll mockup_poll from the browser every 2–3 s until status === 'completed'.

const BASE = 'https://api.printful.com';

function token () {
  const t = process.env.PRINTFUL_API_KEY;
  if (!t) throw new Error('PRINTFUL_API_KEY missing — set in Vercel env');
  return t;
}

async function pf (path, init = {}) {
  const r = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token(),
      'Content-Type': 'application/json',
      'User-Agent': 'ANARCHISM.AFRICA/1.0',
      ...(init.headers || {})
    }
  });
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

async function defaultStoreId () {
  if (process.env.PRINTFUL_STORE_ID) return process.env.PRINTFUL_STORE_ID;
  const resp = await pf('/stores');
  const stores = resp.result || resp.data || resp;
  if (!Array.isArray(stores) || !stores.length) throw new Error('No Printful stores found');
  return String(stores[0].id);
}

// No blocking poll loop — mockup generation uses two separate ops:
//   mockup_start → POST to Printful, returns { task_key }
//   mockup_poll  → single GET check, called repeatedly by the browser client

export default async function handler (req, res) {
  try {
    if (req.method === 'GET') {
      const op = (req.query.op || '').toString();

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

      if (op === 'stores') {
        const resp = await pf('/stores');
        return res.status(200).json(resp);
      }

      if (op === 'mockup_poll') {
        // Single status check — no loop, no sleep. Browser calls this repeatedly.
        const key = (req.query.key || '').toString();
        if (!key) return res.status(400).json({ error: 'key (task_key) required' });
        const resp = await pf(`/mockup-generator/task?task_key=${encodeURIComponent(key)}`);
        const task = resp.result || resp;
        // status is one of: pending | completed | failed
        return res.status(200).json(task);
      }

      return res.status(400).json({ error: 'unknown op (try catalog|product|stores|mockup_poll)' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

    const body = req.body || {};
    const op = body.op;

    if (op === 'upload') {
      // POST /files
      const fileName = body.fileName || ('aa-' + Date.now() + '.png');
      let payload;
      if (body.imageUrl) {
        payload = { type: 'default', url: body.imageUrl, filename: fileName, visible: true };
      } else if (body.imageB64) {
        // Printful file upload expects a URL; for base64 we embed as data URI
        payload = { type: 'default', url: 'data:image/png;base64,' + body.imageB64, filename: fileName, visible: true };
      } else {
        return res.status(400).json({ error: 'imageUrl or imageB64 required' });
      }
      const resp = await pf('/files', { method: 'POST', body: JSON.stringify(payload) });
      return res.status(200).json(resp.result || resp);
    }

    if (op === 'product') {
      // POST /stores/{id}/products
      const storeId = body.storeId || await defaultStoreId();
      const payload = {
        sync_product: body.syncProduct || { name: 'ANARCHISM.AFRICA — product', thumbnail: '' },
        sync_variants: body.syncVariants || []
      };
      const resp = await pf(`/stores/${storeId}/products`, { method: 'POST', body: JSON.stringify(payload) });
      return res.status(200).json({ ...(resp.result || resp), store_id: storeId });
    }

    if (op === 'mockup_start') {
      // Fire the mockup task and return task_key immediately — no blocking poll.
      // The browser polls GET ?op=mockup_poll&key=TASK_KEY every 2–3 s until
      // status === 'completed' | 'failed'.
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
      // POST /orders
      const storeId = body.storeId || await defaultStoreId();
      const payload = {
        recipient: body.recipient,
        items: body.items || [],
        retail_costs: body.retailCosts || null,
        gift: body.gift || null
      };
      const resp = await pf('/orders', { method: 'POST', body: JSON.stringify(payload) });
      return res.status(200).json({ ...(resp.result || resp), store_id: storeId });
    }

    return res.status(400).json({ error: 'unknown op (try upload|product|mockup_start|order)' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: String(e.message || e), body: e.body || null });
  }
}
