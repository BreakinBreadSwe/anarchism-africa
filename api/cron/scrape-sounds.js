// Cron: /api/cron/scrape-sounds  — runs daily (or on-demand with admin token)
//
// Scrapes open-licensed Afro-anarchist audio from the Internet Archive.
// Results are stored in Vercel Blob at sound-library/manifest.json.
//
// Internet Archive search API is public — no key required.
// All items kept must have a Creative Commons licence URL.
//
// Categories assigned by tag/subject inspection:
//   music        — songs, albums, afrobeat, afrofunk, jazz, amapiano ...
//   spoken-word  — speeches, lectures, poetry, interviews
//   radio        — radio programmes, broadcasts, shows
//   documentary  — audio documentaries, oral histories
//   field        — field recordings, ambient, soundscape
//
// Blob shape:  { tracks: [...], updated: ISO-string, total: n }
// Track shape: { id, title, artist, category, subcategory, audio, page,
//               source, license, licenseUrl, year, description, image, tags }

import { list, put } from '@vercel/blob';

const BLOB_KEY    = 'sound-library/manifest.json';
const IA_SEARCH   = 'https://archive.org/advancedsearch.php';
const IA_META     = 'https://archive.org/metadata';
const IA_IMG      = 'https://archive.org/services/img';
const IA_DOWNLOAD = 'https://archive.org/download';
const ROWS_PER_Q  = 30; // items per IA query

// ── Search query batches ─────────────────────────────────────────────────────
// Each entry is a tuple of [IA query string, default category, subcategory].
// Lower index = higher priority (kept when deduping).
const QUERIES = [
  // Afro-anarchist / liberation music
  ['subject:africa AND subject:anarchism AND mediatype:audio',               'music',       'anarchist'  ],
  ['subject:africa AND subject:liberation AND mediatype:audio',              'music',       'liberation' ],
  ['subject:pan-african AND mediatype:audio',                                'music',       'panafrican' ],
  // Afrobeat, afrofunk, highlife etc
  ['subject:afrobeat AND mediatype:audio',                                   'music',       'afrobeat'   ],
  ['subject:afrofunk AND mediatype:audio',                                   'music',       'afrofunk'   ],
  ['subject:highlife AND subject:africa AND mediatype:audio',                'music',       'highlife'   ],
  ['subject:amapiano AND mediatype:audio',                                   'music',       'amapiano'   ],
  ['subject:afrojazz AND mediatype:audio',                                   'music',       'afrojazz'   ],
  ['subject:kwela AND mediatype:audio',                                      'music',       'kwela'      ],
  ['subject:mbaqanga AND mediatype:audio',                                   'music',       'mbaqanga'   ],
  ['subject:kuduro AND mediatype:audio',                                     'music',       'kuduro'     ],
  ['subject:kwaito AND mediatype:audio',                                     'music',       'kwaito'     ],
  ['subject:gnawa AND mediatype:audio',                                      'music',       'gnawa'      ],
  // Spoken word / lectures / speeches
  ['subject:africa AND subject:"spoken word" AND mediatype:audio',           'spoken-word', 'spoken-word'],
  ['subject:"black power" AND mediatype:audio',                              'spoken-word', 'speech'     ],
  ['subject:africa AND subject:speech AND mediatype:audio',                  'spoken-word', 'speech'     ],
  ['subject:africa AND subject:lecture AND mediatype:audio',                 'spoken-word', 'lecture'    ],
  // Radio programmes
  ['subject:africa AND subject:radio AND mediatype:audio',                   'radio',       'broadcast'  ],
  ['collection:pacifica_radio_archives AND subject:africa',                  'radio',       'pacifica'   ],
  ['collection:pacifica_radio_archives AND subject:liberation',              'radio',       'pacifica'   ],
  // Documentaries / oral history
  ['subject:africa AND subject:documentary AND mediatype:audio',             'documentary', 'documentary'],
  ['subject:africa AND subject:"oral history" AND mediatype:audio',          'documentary', 'oral-history'],
  // Field recordings / soundscapes
  ['subject:africa AND subject:"field recording" AND mediatype:audio',       'field',       'field'      ],
  ['subject:africa AND subject:soundscape AND mediatype:audio',              'field',       'ambient'    ],
  // Open netlabels — CC licensed African / diaspora music
  ['collection:netlabels AND subject:africa AND mediatype:audio',            'music',       'netlabel'   ],
  ['collection:opensource_audio AND subject:africa AND mediatype:audio',     'music',       'open'       ],

  // ── REVOLUTIONARY FIGURES — speeches, interviews, recordings ─────────────────
  ['creator:"Thomas Sankara" AND mediatype:audio',                           'spoken-word', 'sankara'    ],
  ['creator:"Fela Kuti" AND mediatype:audio',                                'music',       'fela'       ],
  ['subject:"Fela Kuti" AND mediatype:audio',                                'music',       'fela'       ],
  ['creator:"Amilcar Cabral" AND mediatype:audio',                           'spoken-word', 'cabral'     ],
  ['creator:"Patrice Lumumba" AND mediatype:audio',                          'spoken-word', 'lumumba'    ],
  ['creator:"Walter Rodney" AND mediatype:audio',                            'spoken-word', 'rodney'     ],
  ['creator:"Steve Biko" AND mediatype:audio',                               'spoken-word', 'biko'       ],
  ['creator:"Kwame Nkrumah" AND mediatype:audio',                            'spoken-word', 'nkrumah'    ],
  ['creator:"Frantz Fanon" AND mediatype:audio',                             'spoken-word', 'fanon'      ],
  ['creator:"Malcolm X" AND subject:africa AND mediatype:audio',             'spoken-word', 'malcolm-x'  ],
  ['creator:"Angela Davis" AND mediatype:audio',                             'spoken-word', 'angela-davis'],
  ['creator:"Miriam Makeba" AND mediatype:audio',                            'music',       'miriam-makeba'],
  ['creator:"Hugh Masekela" AND mediatype:audio',                            'music',       'masekela'   ],
  ['creator:"Tony Allen" AND mediatype:audio',                               'music',       'tony-allen'  ],
  ['creator:"Sun Ra" AND mediatype:audio',                                   'music',       'sun-ra'     ],
  ['creator:"Linton Kwesi Johnson" AND mediatype:audio',                     'spoken-word', 'dub-poetry' ],
  ['creator:"Gil Scott-Heron" AND mediatype:audio',                          'spoken-word', 'spoken-word'],
  ['creator:"Last Poets" AND mediatype:audio',                               'spoken-word', 'spoken-word'],

  // ── SOUTH AFRICAN STRUGGLE & FREEDOM MUSIC ───────────────────────────────────
  ['subject:"struggle songs" AND subject:africa AND mediatype:audio',        'music',       'struggle'   ],
  ['subject:"freedom songs" AND subject:africa AND mediatype:audio',         'music',       'struggle'   ],
  ['subject:"anti-apartheid" AND mediatype:audio',                           'music',       'anti-apartheid'],
  ['subject:"Radio Freedom" AND mediatype:audio',                            'radio',       'freedom-radio'],

  // ── GRIOT / ORAL TRADITION ────────────────────────────────────────────────────
  ['subject:griot AND mediatype:audio',                                      'spoken-word', 'griot'      ],
  ['subject:"oral tradition" AND subject:africa AND mediatype:audio',        'spoken-word', 'oral'       ],

  // ── JAZZ & DIASPORA ───────────────────────────────────────────────────────────
  ['subject:"free jazz" AND subject:africa AND mediatype:audio',             'music',       'free-jazz'  ],
  ['subject:"Ethiopian jazz" AND mediatype:audio',                           'music',       'ethiojazz'  ],
  ['subject:mbalax AND mediatype:audio',                                     'music',       'mbalax'     ],
  ['subject:soukous AND mediatype:audio',                                    'music',       'soukous'    ],
  ['subject:benga AND mediatype:audio',                                      'music',       'benga'      ],
  ['subject:makossa AND mediatype:audio',                                    'music',       'makossa'    ],

  // ── TRADITIONAL INSTRUMENTS ───────────────────────────────────────────────────
  ['subject:mbira AND mediatype:audio',                                      'music',       'mbira'      ],
  ['subject:kora AND subject:africa AND mediatype:audio',                    'music',       'kora'       ],
  ['subject:balafon AND mediatype:audio',                                    'music',       'balafon'    ],
  ['subject:sabar AND mediatype:audio',                                      'music',       'sabar'      ],

  // ── POETRY / SPOKEN WORD ──────────────────────────────────────────────────────
  ['subject:poetry AND subject:africa AND mediatype:audio',                  'spoken-word', 'poetry'     ],
  ['subject:"dub poetry" AND mediatype:audio',                               'spoken-word', 'dub-poetry' ],
  ['subject:"praise poetry" AND subject:africa AND mediatype:audio',         'spoken-word', 'praise-poetry'],

  // ── ROOTS REGGAE / DUB ────────────────────────────────────────────────────────
  ['subject:reggae AND subject:africa AND mediatype:audio',                  'music',       'reggae'     ],
  ['subject:"roots reggae" AND mediatype:audio',                             'music',       'roots'      ],
  ['subject:rastafari AND mediatype:audio',                                  'music',       'roots'      ],

  // ── COMMUNITY & PIRATE RADIO ──────────────────────────────────────────────────
  ['collection:pacifica_radio_archives AND subject:"black power"',           'radio',       'pacifica'   ],
  ['subject:"community radio" AND subject:africa AND mediatype:audio',       'radio',       'community'  ],

  // ── DEEP ETHNOMUSICOLOGY ──────────────────────────────────────────────────────
  ['subject:"ethnomusicology" AND subject:africa AND mediatype:audio',       'field',       'ethnomusicology'],
  ['subject:"music of Mali" AND mediatype:audio',                            'music',       'mali'       ],
  ['subject:"music of Ghana" AND mediatype:audio',                           'music',       'ghana'      ],
  ['subject:"music of Nigeria" AND mediatype:audio',                         'music',       'nigeria'    ],
  ['subject:"music of Congo" AND mediatype:audio',                           'music',       'congo'      ],
  ['subject:"music of Zimbabwe" AND mediatype:audio',                        'music',       'zimbabwe'   ],
  ['subject:"music of Senegal" AND mediatype:audio',                         'music',       'senegal'    ],
  ['subject:"music of Ethiopia" AND mediatype:audio',                        'music',       'ethiopia'   ],
];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function iaSearch (q, rows = ROWS_PER_Q) {
  const params = new URLSearchParams({
    q,
    'fl[]': 'identifier,title,creator,year,subject,description,licenseurl,downloads',
    rows,
    page: 1,
    output: 'json',
    sort: 'downloads desc',  // most-played first
  });
  const r = await fetch(`${IA_SEARCH}?${params}`, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) return [];
  const body = await r.json();
  return body?.response?.docs || [];
}

async function iaGetAudioFile (identifier) {
  // Fetch the item metadata to find the best playable audio file.
  // Prefer 128-kbps MP3 → any MP3 → OGG.
  try {
    const r = await fetch(`${IA_META}/${identifier}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const meta = await r.json();
    const files = meta.files || [];
    const prefer = (ext) => files.find(f =>
      f.name?.toLowerCase().endsWith(ext) &&
      !f.name.includes('_spectrogram') &&
      !f.name.includes('_sample') &&
      (f.format || '').toLowerCase().includes(ext.replace('.',''))
    );
    const mp3_128 = files.find(f => f.name?.toLowerCase().endsWith('.mp3') && f.bitrate === '128');
    const mp3     = prefer('.mp3');
    const ogg     = prefer('.ogg');
    const pick    = mp3_128 || mp3 || ogg;
    if (!pick) return null;
    return `${IA_DOWNLOAD}/${identifier}/${encodeURIComponent(pick.name)}`;
  } catch {
    return null;
  }
}

function normaliseLicense (url) {
  if (!url) return null;
  if (url.includes('creativecommons.org')) {
    const m = url.match(/licenses\/([^/]+)\/([^/]+)/);
    if (m) return `CC ${m[1].toUpperCase()} ${m[2]}`;
    if (url.includes('/publicdomain/zero')) return 'CC0';
    if (url.includes('/publicdomain/mark'))  return 'Public Domain';
    return 'CC';
  }
  if (url.includes('publicdomain')) return 'Public Domain';
  return null;
}

function isOpenLicense (url) {
  if (!url) return false;
  return url.includes('creativecommons.org') || url.includes('publicdomain');
}

function extractTags (subjects) {
  if (!subjects) return [];
  const raw = Array.isArray(subjects) ? subjects : [subjects];
  return raw
    .flatMap(s => s.split(/[;,]/))
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 1 && s.length < 40)
    .slice(0, 8);
}

// ── Read / write manifest ────────────────────────────────────────────────────
async function readManifest () {
  try {
    const { blobs } = await list({ prefix: 'sound-library/manifest' });
    const f = blobs.find(b => b.pathname === BLOB_KEY);
    if (f) {
      const r = await fetch(f.url, { cache: 'no-store' });
      if (r.ok) return await r.json();
    }
  } catch {}
  return { tracks: [], updated: null, total: 0 };
}

async function writeManifest (data) {
  await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json',
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler (req, res) {
  const cronSecret  = process.env.CRON_SECRET;
  const adminToken  = process.env.AA_ADMIN_TOKEN || '';
  const isCron      = !!req.headers['x-vercel-cron-signature'];
  const isAdmin     = adminToken && req.headers['x-aa-admin-token'] === adminToken;

  if (cronSecret && !isCron && !isAdmin) {
    if (req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const existing   = await readManifest();
  const existingIds = new Set((existing.tracks || []).map(t => t.id));
  const newTracks  = [];
  const summary    = { queries: 0, found: 0, open: 0, withAudio: 0, added: 0, errors: [] };

  for (const [q, category, subcategory] of QUERIES) {
    try {
      const docs = await iaSearch(q);
      summary.queries++;
      summary.found += docs.length;

      for (const doc of docs) {
        const id = `ia-${doc.identifier}`;
        if (existingIds.has(id)) continue; // already stored

        if (!isOpenLicense(doc.licenseurl)) continue;
        summary.open++;

        // Get the actual audio file URL (costs one extra request per new item)
        const audioUrl = await iaGetAudioFile(doc.identifier);
        if (!audioUrl) continue;
        summary.withAudio++;

        const license = normaliseLicense(doc.licenseurl);

        newTracks.push({
          id,
          title:       doc.title || doc.identifier,
          artist:      Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || ''),
          category,
          subcategory,
          audio:       audioUrl,
          page:        `https://archive.org/details/${doc.identifier}`,
          source:      'archive.org',
          license,
          licenseUrl:  doc.licenseurl || null,
          year:        doc.year ? parseInt(doc.year, 10) : null,
          description: (doc.description || '').slice(0, 280),
          image:       `${IA_IMG}/${doc.identifier}`,
          tags:        extractTags(doc.subject),
        });

        existingIds.add(id);
        summary.added++;

        // Limit metadata fetches per run to avoid timeouts (each costs ~200ms)
        if (summary.withAudio >= 250) break;
      }
    } catch (e) {
      summary.errors.push(`${q.slice(0, 40)}: ${e.message}`);
    }
    if (summary.withAudio >= 250) break;
  }

  const allTracks = [...(existing.tracks || []), ...newTracks];
  const manifest  = { tracks: allTracks, updated: new Date().toISOString(), total: allTracks.length };
  await writeManifest(manifest);

  return res.status(200).json({ ok: true, summary, totalStored: allTracks.length });
}
