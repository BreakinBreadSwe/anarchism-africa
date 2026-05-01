// Vercel serverless — Printify API wrapper
// PRINTIFY_API_TOKEN required in Vercel env. PRINTIFY_SHOP_ID optional.
//
// GET  /api/pod/printify?op=shops                — list shops
// GET  /api/pod/printify?op=blueprints           — catalogue
// GET  /api/pod/printify?op=blueprint&id=N       — variants for one
// GET  /api/pod/printify?op=variants&id=N&pp=N
// POST /api/pod/printify  body { op:'upload', imageUrl|imageB64, fileName }
// POST /api/pod/printify  body { op:'product', shopId?, blueprintId, printProviderId,
//                                 title, description, variants:[{id, price}],
//                                 printAreas:[{ position, imageId, scale?, x?, y? }],
//                                 tags? }
// POST /api/pod/printify  body { op:'publish', shopId?, productId }

const BASE = 'https://api.printify.com/v1';

function token () {
  const t = process.env.PRINTIFY_API_TOKEN;
  if (!t) throw new Error('PRINTIFY_API_TOKEN missing — set in Vercel env');
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
  let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!r.ok) {
    const msg = (body && (body.message || body.error || body.errors)) || ('HTTP ' + r.status);
    const err = new Error('Printify ' + r.status + ': ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    err.status = r.status; err.body = body;
    throw err;
  }
  return body;
}

async function defaultShopId () {
  if (process.env.PRINTIFY_SHOP_ID) return process.env.PRINTIFY_SHOP_ID;
  const shops = await pf('/shops.json');
  if (!Array.isArray(shops) || !shops.length) throw new Error('No Printify shops connected');
  return String(shops[0].id);
}

export default async function handler (req, res) {
  try {
    if (req.method === 'GET') {
      const op = (req.query.op || '').toString();
      if (op === 'shops')      return res.status(200).json(await pf('/shops.json'));
      if (op === 'blueprints') return res.status(200).json(await pf('/catalog/blueprints.json'));
      if (op === 'blueprint') {
        const id = req.query.id; if (!id) return res.status(400).json({ error: 'id required' });
        const [bp, providers] = await Promise.all([
          pf(`/catalog/blueprints/${id}.json`),
          pf(`/catalog/blueprints/${id}/print_providers.json`)
        ]);
        return res.status(200).json({ blueprint: bp, print_providers: providers });
      }
      if (op === 'variants') {
        const id = req.query.id, pp = req.query.pp;
        if (!id || !pp) return res.status(400).json({ error: 'id and pp required' });
        return res.status(200).json(await pf(`/catalog/blueprints/${id}/print_providers/${pp}/variants.json`));
      }
      return res.status(400).json({ error: 'unknown op (try shops|blueprints|blueprint|variants)' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

    const body = req.body || {};
    const op = body.op;

    if (op === 'upload') {
      const payload = body.imageUrl
        ? { file_name: body.fileName || ('aa-' + Date.now() + '.png'), url: body.imageUrl }
        : { file_name: body.fileName || ('aa-' + Date.now() + '.png'), contents: body.imageB64 };
      if (!payload.url && !payload.contents) return res.status(400).json({ error: 'imageUrl or imageB64 required' });
      const r = await pf('/uploads/images.json', { method: 'POST', body: JSON.stringify(payload) });
      return res.status(200).json(r);
    }
    if (op === 'product') {
      const shopId = body.shopId || await defaultShopId();
      const variants = (body.variants || []).map(v => ({ id: v.id, price: v.price, is_enabled: v.is_enabled !== false }));
      const printAreas = (body.printAreas || []).map(pa => ({
        variant_ids: pa.variantIds || variants.map(v => v.id),
        placeholders: [{
          position: pa.position || 'front',
          images: [{ id: pa.imageId, x: pa.x ?? 0.5, y: pa.y ?? 0.5, scale: pa.scale ?? 1, angle: pa.angle ?? 0 }]
        }]
      }));
      const product = {
        title: body.title || 'ANARCHISM.AFRICA — merch',
        description: body.description || '',
        blueprint_id: body.blueprintId,
        print_provider_id: body.printProviderId,
        variants,
        print_areas: printAreas,
        tags: body.tags || ['anarchism','africa','afrofuturist','aa']
      };
      const r = await pf(`/shops/${shopId}/products.json`, { method: 'POST', body: JSON.stringify(product) });
      return res.status(200).json({ ...r, shop_id: shopId });
    }
    if (op === 'publish') {
      const shopId = body.shopId || await defaultShopId();
      const productId = body.productId;
      if (!productId) return res.status(400).json({ error: 'productId required' });
      const channels = body.channels || { title: true, description: true, images: true, variants: true, tags: true };
      const r = await pf(`/shops/${shopId}/products/${productId}/publish.json`, { method: 'POST', body: JSON.stringify(channels) });
      return res.status(200).json({ ok: true, ...r, shop_id: shopId });
    }
    return res.status(400).json({ error: 'unknown op (try upload|product|publish)' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: String(e.message || e), body: e.body || null });
  }
}
