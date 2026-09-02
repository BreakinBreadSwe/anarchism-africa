// lib/relevance.js — topical filter for ANARCHISM.AFRICA
//
// Every scraped item must relate to at least one of:
//   - Africa (any African country, region, city, language, culture)
//   - Pan-Africanism / African-diaspora identity + politics
//   - Afro-anarchism / Black anarchism / Africa-facing autonomism
//   - Disruption of the status quo by militants OR artists WHOSE
//     work is about / for / from Africa or the African diaspora
//
// A story that's radical but has no Africa/diaspora hook (e.g. a Billy
// Bragg interview about UK Labour and Marx) MUST NOT enter the queue.
//
// score(item) returns 0..N where N grows with signal strength. Items
// scoring 0 are off-topic. Callers typically reject < 1.
//
// Public API:
//   const { score, isRelevant, reason } = require('./relevance').relevance(item);

'use strict';

// Weight buckets — order matters for `reason` short-circuit reporting.
// Africa/diaspora + name signals count harder than pure ideology signals,
// because our scope is Africa-first, not anarchism-first.
const AFRICA_HARD = [
  // Countries + regions
  'africa', 'african', 'africans', 'sahel', 'maghreb', 'saharan', 'horn of africa',
  'west africa', 'east africa', 'north africa', 'south africa', 'central africa',
  // Every African country name and demonym (short list — regexes catch more)
  'nigeria', 'nigerian', 'ghana', 'ghanaian', 'kenya', 'kenyan', 'ethiopia', 'ethiopian',
  'senegal', 'senegalese', 'mali', 'malian', 'burkina', 'burkinabé', 'burkinabe',
  'zimbabwe', 'zimbabwean', 'mozambique', 'mozambican', 'angola', 'angolan',
  'sudan', 'sudanese', 'egypt', 'egyptian', 'morocco', 'moroccan', 'algeria', 'algerian',
  'tunisia', 'tunisian', 'libya', 'libyan', 'cameroon', 'cameroonian', 'congo', 'congolese',
  'drc', 'rwanda', 'rwandan', 'burundi', 'burundian', 'uganda', 'ugandan', 'tanzania', 'tanzanian',
  'zambia', 'zambian', 'namibia', 'namibian', 'botswana', 'botswanan', 'lesotho',
  'malawi', 'malawian', 'madagascar', 'madagascan', 'malagasy', 'ivory coast', 'ivorian',
  "côte d'ivoire", 'gambia', 'gambian', 'guinea', 'guinean', 'guinea-bissau', 'bissau-guinean',
  'sierra leone', 'sierra leonean', 'liberia', 'liberian', 'togo', 'togolese', 'benin', 'beninese',
  'niger', 'nigerien', 'chad', 'chadian', 'somalia', 'somali', 'djibouti', 'djiboutian',
  'eritrea', 'eritrean', 'cape verde', 'cape verdean', 'sao tome', 'são tomé', 'equatorial guinea',
  'gabon', 'gabonese', 'central african republic', 'south sudan', 'mauritania', 'mauritanian',
  'seychelles', 'comoros', 'mauritius', 'mauritian',
  // Major cities
  'lagos', 'nairobi', 'cairo', 'johannesburg', 'accra', 'addis ababa', 'dakar', 'kinshasa',
  'abidjan', 'khartoum', 'algiers', 'tunis', 'casablanca', 'harare', 'kampala', 'dar es salaam',
  'luanda', 'maputo', 'kigali', 'ouagadougou', 'bamako', 'yaoundé', 'yaounde', 'brazzaville',
  'lomé', 'lome', 'lusaka', 'freetown', 'monrovia',
  // Peoples + languages + heritage
  'yoruba', 'igbo', 'hausa', 'zulu', 'xhosa', 'swahili', 'amharic', 'wolof', 'fulani',
  'kongo', 'kikongo', 'amazigh', 'berber', 'twa', 'san', 'ashanti', 'akan', 'ewe',
  'oromo', 'tigray', 'nubian', 'nubia', 'kikuyu', 'luo', 'maasai', 'himba',
  'sotho', 'tswana', 'ndebele', 'shona', 'chichewa', 'gikuyu',
  // Diaspora + Pan-African
  'panafrican', 'pan-african', 'panafricanism', 'pan-africanism', 'afropean', 'afrolatin',
  'afro-latin', 'afro-caribbean', 'caribbean', 'jamaica', 'jamaican', 'haiti', 'haitian',
  'trinidad', 'barbados', 'cuban', 'bahian', 'salvador da bahia', 'brazil.*african',
  'african.*diaspora', 'black diaspora', 'diaspora.*black', 'black atlantic',
  // Diaspora Black subcultures / identity markers
  'blackness', 'black liberation', 'black panther', 'black anarchism', 'black autonomy',
  'black radical', 'black feminist', 'black queer', 'afrofuturism', 'afrofuturist',
  'africanfuturism', 'afrofunk', 'afrobeat', 'afrobeats', 'afropunk', 'afro-punk',
  'amapiano', 'gqom', 'kwaito', 'highlife', 'kizomba', 'coupé décalé', 'coupe decale',
  'reggae', 'dancehall', 'soca', 'griot', 'juju music',
  // Landmark figures + movements
  'sankara', 'lumumba', 'nkrumah', 'cabral', 'biko', 'mandela', 'fanon', 'rodney',
  'garvey', 'du bois', 'malcolm x', 'assata', 'kwame ture', 'stokely carmichael',
  'audre lorde', 'ngũgĩ', 'ngugi', 'chinua achebe', 'wole soyinka', 'nnedi okorafor',
  'octavia butler', 'ashanti alston', 'kuwasi balagoon', 'kom\'boa ervin', "kom'boa",
  'ella baker', 'harriet tubman', 'winnie mandela', 'ellen johnson', 'wangari maathai',
  'chimamanda', 'fela kuti', 'miriam makeba', 'zanele muholi', 'kehinde wiley', 'el anatsui',
  'bekolo', 'mambéty', 'mambety', 'sissako', 'wanuri kahiu', 'saul williams', 'moor mother',
  'janelle monáe', 'monae', 'sun ra', 'jean-pierre bekolo', 'julie dash', 'daughters of the dust',
  // Movement / event names
  'rhodesmustfall', 'feesmustfall', 'endsars', 'blacklivesmatter', 'blm', 'ferguson',
  'sharpeville', 'soweto', 'apartheid', 'kalakuta', 'chale wote', 'fespaco', 'dakar biennale',
  'kwibuka', 'mau mau', 'ujamaa', 'ubuntu', 'sankofa', 'kemet', 'kemetic', 'rastafari',
  // Movements + political frames adjacent to the site's mission
  'decolonial', 'decolonis', 'decoloniz', 'colonial', 'anti-colonial', 'anticolonial',
  'neocolonial', 'postcolonial', 'négritude', 'negritude', 'consciencism'
];

// Weaker signals — anarchism / autonomy / art without an Africa hook.
// These count HALF, and don't rescue an item on their own if AFRICA_HARD
// is entirely absent (the whole point of the filter).
const IDEOLOGY_SOFT = [
  'anarchism', 'anarchist', 'anarchy', 'autonomy', 'autonomism',
  'mutual aid', 'commons', 'abolition', 'liberation', 'revolution', 'militant',
  'radical', 'insurrection', 'zapatista', 'rojava', 'kurdish',
  'artist', 'artists', 'sound art', 'installation', 'biennale', 'griot',
  'poet', 'poetry', 'novelist', 'literature', 'cinema', 'filmmaker',
  'director', 'photographer', 'photography', 'muralist', 'graffiti',
  'punk', 'jazz', 'hip-hop', 'hip hop', 'dub', 'improvisation', 'archive'
];

// Explicit disqualifiers — the story is CLEARLY somewhere else geographically
// or thematically and has no obvious African / diaspora hook. Match against
// text; even one strong non-African signal without any AFRICA_HARD signal
// halves the final score. (Weak, not fatal — we don't want to over-filter.)
const NON_AFRICAN_NOISE = [
  'billy bragg', 'boris johnson', 'brexit', 'jeremy corbyn', 'keir starmer',
  'donald trump.*(?!africa)', 'putin.*(?!africa)', 'ukraine.*(?!african)',
  'french election', 'italian election', 'german election', 'catalan',
  'welsh', 'scottish', 'irish', 'nordic', 'scandinavian', 'canadian',
  'new zealand', 'australian.*(?!africa)'
];

const AFRICA_RE   = new RegExp('\\b(' + AFRICA_HARD.map(escapeRe).join('|') + ')\\b', 'gi');
const IDEO_RE     = new RegExp('\\b(' + IDEOLOGY_SOFT.map(escapeRe).join('|') + ')\\b', 'gi');
const NOISE_RE    = new RegExp('(' + NON_AFRICAN_NOISE.join('|') + ')', 'gi');

function escapeRe (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function relevance (item) {
  const bag = [
    item.title || '',
    item.subtitle || '',
    item.summary || '',
    item.deck || '',
    item.body ? String(item.body).slice(0, 3000) : '',
    (item.tags || []).join(' '),
    item.source_name || item.source || '',
    item.author || '',
    item.category || ''
  ].join(' ').toLowerCase();

  const africa = (bag.match(AFRICA_RE) || []).length;
  const ideo   = (bag.match(IDEO_RE)   || []).length;
  const noise  = (bag.match(NOISE_RE)  || []).length;

  // Score model: Africa signal counts full; ideology counts half; every
  // non-African-noise signal penalises by 1 (bounded at -3). An item with
  // zero Africa signal + noise present is definitively off-topic.
  let score = africa + (ideo * 0.5) - Math.min(noise, 3);
  if (score < 0) score = 0;

  // Hard floor: NO africa signal AND source isn't Africa-first → drop.
  const africaSource = /africa|okay|thecontinent|afropunk|panafric|black.?agenda|newframe|pambazuka|chimurenga|africasacountry|daraja/i.test(item.source_name || item.source || '');
  const isRelevant = africa >= 1 || (africaSource && score >= 1);

  let reason = '';
  if (!isRelevant) {
    if (africa === 0 && ideo === 0)  reason = 'no africa or ideology signals';
    else if (africa === 0)           reason = `no africa signal (ideology=${ideo}, noise=${noise})`;
    else                              reason = `score too low (${score.toFixed(2)})`;
  } else {
    reason = `africa=${africa} ideo=${ideo} noise=${noise} score=${score.toFixed(2)}`;
  }

  return { score, isRelevant, reason, africa, ideo, noise };
}

module.exports = { relevance, AFRICA_RE, IDEO_RE, NOISE_RE };
