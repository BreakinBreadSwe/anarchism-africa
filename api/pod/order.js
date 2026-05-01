// Vercel serverless — sustainable POD order proxy
//
// POST /api/pod/order
//   body: { provider, sku, variant, quantity, ship_to: {...} }
//   resp: { id, status, eta_days, carbon_g }
//
// Stub implementation. Real wiring per provider:
//   - stanley_stella  (via Printful)  → https://api.printful.com/orders
//   - teemill                        → https://teemill.com/omnis/v3/api/...
//   - gelato_eco                     → https://order.gelatoapis.com/v4/orders
//   - ohh_deer                       → manual XML feed for FSC paper goods
//
// Keys live in env vars: PRINTFUL_API_KEY, TEEMILL_API_KEY, GELATO_API_KEY

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { provider = 'stanley_stella', sku, variant, quantity = 1, ship_to } = req.body || {};
  // Real call would route here; for the demo we echo a sensible response.
  res.status(200).json({
    id:       'ord_' + Date.now(),
    provider,
    sku,
    variant,
    quantity,
    ship_to,
    status:   'received',
    eta_days: 7,
    carbon_g: estimateCarbon(provider, quantity)
  });
}

function estimateCarbon (provider, qty) {
  const base = { stanley_stella: 2400, teemill: 900, fairshare: 2200, gelato_eco: 2600, ohh_deer: 600 };
  return (base[provider] || 2500) * qty;
}
