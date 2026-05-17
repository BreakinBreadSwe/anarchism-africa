// Vercel serverless — POD services overview
// GET /api/pod/overview
//
// Returns metadata for each print-on-demand service, with live connection
// status for services whose API keys are present in env.
// Cache-Control: max-age=60

const SERVICES = [
  {
    id: 'printify',
    name: 'Printify',
    endpoint: 'https://api.printify.com/v1',
    docs: 'https://developers.printify.com',
    features: ['catalog', 'upload', 'products', 'publish', 'variants', 'orders'],
    products: ['tshirt', 'poster', 'mug', 'towel', 'tote', 'hoodie', 'sticker', 'phone-case'],
    printAreas: ['front', 'back', 'sleeve', 'neck', 'full'],
    fileFormats: ['PNG', 'JPG', 'SVG'],
    maxFileSize: '200MB',
    envVar: 'PRINTIFY_API_TOKEN',
  },
  {
    id: 'printful',
    name: 'Printful',
    endpoint: 'https://api.printful.com',
    docs: 'https://developers.printful.com',
    features: ['catalog', 'upload', 'products', 'mockups', 'orders', 'shipping'],
    products: ['tshirt', 'poster', 'mug', 'towel', 'tote', 'hoodie', 'embroidery'],
    printAreas: ['front', 'back', 'sleeve', 'full'],
    fileFormats: ['PNG', 'JPG', 'SVG', 'PDF'],
    maxFileSize: '200MB',
    envVar: 'PRINTFUL_API_KEY',
  },
  {
    id: 'gelato',
    name: 'Gelato',
    endpoint: 'https://order.gelato.com/api/v3',
    docs: 'https://dashboard.gelato.com/docs',
    features: ['catalog', 'orders', 'shipping', 'tracking'],
    products: ['tshirt', 'poster', 'mug', 'tote', 'hoodie', 'cards', 'notebook'],
    printAreas: ['front', 'back', 'full'],
    fileFormats: ['PNG', 'PDF'],
    maxFileSize: '100MB',
    envVar: 'GELATO_API_KEY',
  },
  {
    id: 'teemill',
    name: 'Teemill',
    endpoint: 'https://teemill.com/omnis/v3',
    docs: 'https://teemill.com/info/api/',
    features: ['catalog', 'products', 'orders', 'eco-certified'],
    products: ['tshirt', 'tote', 'hoodie', 'vest', 'sweatshirt'],
    printAreas: ['front', 'back'],
    fileFormats: ['PNG'],
    maxFileSize: '50MB',
    envVar: 'TEEMILL_API_KEY',
  },
];

async function pingPrintify () {
  const token = process.env.PRINTIFY_API_TOKEN;
  const r = await fetch('https://api.printify.com/v1/shops.json', {
    headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'ANARCHISM.AFRICA/1.0' }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  return Array.isArray(data) ? data.length : 0;
}

async function pingPrintful () {
  const token = process.env.PRINTFUL_API_KEY;
  const r = await fetch('https://api.printful.com/stores', {
    headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'ANARCHISM.AFRICA/1.0' }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  const stores = data.result || data.data || data;
  return Array.isArray(stores) ? stores.length : 0;
}

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const results = await Promise.all(SERVICES.map(async svc => {
    const envVal = process.env[svc.envVar];
    const hasKey = Boolean(envVal && envVal.trim());

    let connected = false;
    let shopCount = 0;
    let note = '';

    if (hasKey) {
      try {
        if (svc.id === 'printify') {
          shopCount = await pingPrintify();
          connected = true;
        } else if (svc.id === 'printful') {
          shopCount = await pingPrintful();
          connected = true;
        } else {
          // Gelato, Teemill: key is present but proxy not implemented yet
          connected = false;
          note = 'API key set — proxy coming soon';
        }
      } catch (err) {
        connected = false;
        note = 'Key set but ping failed: ' + (err.message || String(err));
      }
    }

    return {
      id: svc.id,
      name: svc.name,
      connected,
      endpoint: svc.endpoint,
      docs: svc.docs,
      features: svc.features,
      products: svc.products,
      printAreas: svc.printAreas,
      fileFormats: svc.fileFormats,
      maxFileSize: svc.maxFileSize,
      envVar: svc.envVar,
      shopCount,
      note,
    };
  }));

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).json({ services: results });
}
