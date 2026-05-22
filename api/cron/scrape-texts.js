// Vercel Cron — daily text / pamphlet / book scraper.
//
// Scrapes open-licensed afro-anarchist texts from the Internet Archive.
// Results stored in Vercel Blob at text-library/manifest.json.
//
// Internet Archive search API — public, no key required.
// Only CC / public-domain items are kept.
//
// Text types:
//   pamphlet   — short texts, zines, leaflets
//   book       — long-form monographs, collected essays
//   thesis     — academic dissertations
//   periodical — journals, newsletters, magazines
//   speech     — transcripts, speeches, manifestos
//
// Blob shape:  { texts: [...], updated: ISO-string, total: n }
// Text shape:  { id, title, author, type, year, description,
//               page, pdf, epub, thumb, license, licenseUrl,
//               language, tags, downloads }

import { list, put } from '@vercel/blob';

const BLOB_KEY    = 'text-library/manifest.json';
const IA_SEARCH   = 'https://archive.org/advancedsearch.php';
const IA_META     = 'https://archive.org/metadata';
const IA_IMG      = 'https://archive.org/services/img';
const IA_DL       = 'https://archive.org/download';
const ROWS_PER_Q  = 30;

// ── Search queries ────────────────────────────────────────────────────────────
// [IA query, type, priority]
const QUERIES = [
  // Core anarchist theory — Africa
  ['subject:"African anarchism" AND mediatype:texts',                                  'pamphlet'  ],
  ['subject:"anarchism" AND subject:"africa" AND mediatype:texts',                     'book'      ],
  ['subject:"black anarchism" AND mediatype:texts',                                    'pamphlet'  ],
  ['subject:"anarchism" AND subject:"diaspora" AND mediatype:texts',                   'book'      ],
  ['creator:"Sam Mbah" AND mediatype:texts',                                           'book'      ],
  ['creator:"Lorenzo Komboa Ervin" AND mediatype:texts',                               'pamphlet'  ],
  ['creator:"Kuwasi Balagoon" AND mediatype:texts',                                    'pamphlet'  ],
  ['creator:"Modibo Kadalie" AND mediatype:texts',                                     'book'      ],

  // Pan-African liberation theory — the canon
  ['creator:"Frantz Fanon" AND mediatype:texts',                                       'book'      ],
  ['creator:"Walter Rodney" AND mediatype:texts',                                      'book'      ],
  ['creator:"Kwame Nkrumah" AND mediatype:texts',                                      'book'      ],
  ['creator:"Amilcar Cabral" AND mediatype:texts',                                     'speech'    ],
  ['creator:"Thomas Sankara" AND mediatype:texts',                                     'speech'    ],
  ['creator:"Steve Biko" AND mediatype:texts',                                         'book'      ],
  ['creator:"Patrice Lumumba" AND mediatype:texts',                                    'speech'    ],
  ['creator:"Julius Nyerere" AND mediatype:texts',                                     'book'      ],
  ['creator:"Aimé Césaire" AND mediatype:texts',                                       'book'      ],
  ['creator:"CLR James" AND mediatype:texts',                                          'book'      ],
  ['creator:"W.E.B. Du Bois" AND subject:africa AND mediatype:texts',                  'book'      ],
  ['creator:"Marcus Garvey" AND mediatype:texts',                                      'speech'    ],
  ['creator:"Claudia Jones" AND mediatype:texts',                                      'pamphlet'  ],
  ['creator:"Malcolm X" AND mediatype:texts',                                          'speech'    ],
  ['creator:"Angela Davis" AND mediatype:texts',                                       'book'      ],
  ['creator:"Assata Shakur" AND mediatype:texts',                                      'book'      ],
  ['creator:"George Jackson" AND mediatype:texts',                                     'book'      ],
  ['creator:"Cedric Robinson" AND mediatype:texts',                                    'book'      ],
  ['creator:"Achille Mbembe" AND mediatype:texts',                                     'book'      ],
  ['creator:"bell hooks" AND subject:race AND mediatype:texts',                        'book'      ],

  // Decolonial / pan-African theory — broader
  ['subject:"pan-africanism" AND mediatype:texts',                                     'book'      ],
  ['subject:"decolonization" AND subject:"africa" AND mediatype:texts',                'book'      ],
  ['subject:"national liberation" AND subject:"africa" AND mediatype:texts',           'book'      ],
  ['subject:"anticolonialism" AND subject:"africa" AND mediatype:texts',               'book'      ],
  ['subject:"ujamaa" AND mediatype:texts',                                             'book'      ],
  ['subject:"sankarism" AND mediatype:texts',                                          'pamphlet'  ],
  ['subject:"black power" AND mediatype:texts',                                        'book'      ],
  ['subject:"black panther party" AND mediatype:texts',                                'pamphlet'  ],
  ['subject:"ANC" AND subject:"liberation" AND mediatype:texts',                       'pamphlet'  ],
  ['subject:"SWAPO" AND mediatype:texts',                                              'pamphlet'  ],
  ['subject:"FRELIMO" AND mediatype:texts',                                            'pamphlet'  ],
  ['subject:"MPLA" AND mediatype:texts',                                               'pamphlet'  ],

  // Radical ecology / commons / mutual aid
  ['subject:"mutual aid" AND subject:"africa" AND mediatype:texts',                    'pamphlet'  ],
  ['subject:"commons" AND subject:"africa" AND mediatype:texts',                       'book'      ],
  ['subject:"ubuntu" AND subject:"political" AND mediatype:texts',                     'book'      ],

  // Radical periodicals — journals, newsletters, zines
  ['subject:"radical" AND subject:"africa" AND mediatype:texts AND year:[1960 TO 2000]','periodical'],
  ['collection:americana AND subject:"africa" AND subject:"liberation" AND mediatype:texts', 'book' ],
  ['collection:opensource AND subject:"anarchism" AND mediatype:texts',                'pamphlet'  ],
  ['collection:opensource AND subject:"pan-africanism" AND mediatype:texts',           'book'      ],

  // Afrofuturism / speculative fiction (open access)
  ['subject:"afrofuturism" AND mediatype:texts',                                       'book'      ],
  ['creator:"Octavia Butler" AND mediatype:texts',                                     'book'      ],

  // Music history / oral tradition
  ['subject:"afrobeat" AND mediatype:texts',                                           'book'      ],
  ['subject:"griot" AND mediatype:texts',                                              'book'      ],
  ['subject:"oral tradition" AND subject:"africa" AND mediatype:texts',                'book'      ],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function iaSearch (q, rows = ROWS_PER_Q) {
  const params = new URLSearchParams({
    q,
    'fl[]': 'identifier,title,creator,year,subject,description,licenseurl,downloads,language',
    rows,
    page:   1,
    output: 'json',
    sort:   'downloads desc',
  });
  const r = await fetch(`${IA_SEARCH}?${params}`, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) return [];
  const body = await r.json();
  return body?.response?.docs || [];
}

async function iaGetTextFiles (identifier) {
  // Returns { pdf, epub } — prefer lower-resolution PDFs for bandwidth.
  try {
    const r = await fetch(`${IA_META}/${identifier}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return {};
    const meta = await r.json();
    const files = meta.files || [];

    const pdf = files.find(f =>
      f.name?.toLowerCase().endsWith('.pdf') &&
      !f.name.includes('_text') &&
      !f.name.includes('_orig')
    );
    const epub = files.find(f => f.name?.toLowerCase().endsWith('.epub'));

    return {
      pdf:  pdf  ? `${IA_DL}/${identifier}/${encodeURIComponent(pdf.name)}`  : null,
      epub: epub ? `${IA_DL}/${identifier}/${encodeURIComponent(epub.name)}` : null,
    };
  } catch {
    return {};
  }
}

function isOpenLicense (url) {
  if (!url) return false;
  return url.includes('creativecommons.org') || url.includes('publicdomain');
}

function normaliseLicense (url) {
  if (!url) return null;
  if (url.includes('publicdomain/zero')) return 'CC0';
  if (url.includes('publicdomain/mark'))  return 'Public Domain';
  const m = url.match(/licenses\/([^/]+)\/([^/]+)/);
  if (m) return `CC ${m[1].toUpperCase()} ${m[2]}`;
  if (url.includes('creativecommons.org')) return 'CC';
  return null;
}

function extractTags (subjects) {
  if (!subjects) return [];
  const raw = Array.isArray(subjects) ? subjects : [subjects];
  return raw
    .flatMap(s => s.split(/[;,]/))
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 1 && s.length < 50)
    .slice(0, 10);
}

// ── Manifest helpers ───────────────────────────────────────────────────────────
async function readManifest () {
  try {
    const { blobs } = await list({ prefix: 'text-library/manifest' });
    const f = blobs.find(b => b.pathname === BLOB_KEY);
    if (f) {
      const r = await fetch(f.url, { cache: 'no-store' });
      if (r.ok) return await r.json();
    }
  } catch {}
  return { texts: [], updated: null, total: 0 };
}

async function writeManifest (data) {
  await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json',
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler (req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const adminToken = process.env.AA_ADMIN_TOKEN || '';
  const isCron     = !!req.headers['x-vercel-cron-signature'];
  const isAdmin    = adminToken && req.headers['x-aa-admin-token'] === adminToken;

  if (cronSecret && !isCron && !isAdmin) {
    if (req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const existing    = await readManifest();
  const existingIds = new Set((existing.texts || []).map(t => t.id));
  const newTexts    = [];
  const summary     = { queries: 0, found: 0, open: 0, withFile: 0, added: 0, errors: [] };

  for (const [q, type] of QUERIES) {
    try {
      const docs = await iaSearch(q);
      summary.queries++;
      summary.found += docs.length;

      for (const doc of docs) {
        const id = `ia-text-${doc.identifier}`;
        if (existingIds.has(id)) continue;
        if (!isOpenLicense(doc.licenseurl)) continue;
        summary.open++;

        // Resolve actual file URLs
        const files = await iaGetTextFiles(doc.identifier);
        if (!files.pdf && !files.epub) continue;
        summary.withFile++;

        newTexts.push({
          id,
          title:       doc.title || doc.identifier,
          author:      Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || ''),
          type,
          year:        doc.year ? parseInt(doc.year, 10) : null,
          description: (doc.description || '').slice(0, 400),
          page:        `https://archive.org/details/${doc.identifier}`,
          pdf:         files.pdf  || null,
          epub:        files.epub || null,
          thumb:       `${IA_IMG}/${doc.identifier}`,
          license:     normaliseLicense(doc.licenseurl),
          licenseUrl:  doc.licenseurl || null,
          language:    doc.language   || 'en',
          tags:        extractTags(doc.subject),
          downloads:   doc.downloads  || 0,
          source:      'archive.org',
        });

        existingIds.add(id);
        summary.added++;

        // Cap per-run fetches to avoid hitting the 300s function limit
        if (summary.withFile >= 200) break;
      }
    } catch (e) {
      summary.errors.push(`${q.slice(0, 50)}: ${e.message}`);
    }
    if (summary.withFile >= 200) break;
  }

  const allTexts = [...(existing.texts || []), ...newTexts];
  const manifest = { texts: allTexts, updated: new Date().toISOString(), total: allTexts.length };
  await writeManifest(manifest);

  return res.status(200).json({ ok: true, summary, totalStored: allTexts.length });
}
