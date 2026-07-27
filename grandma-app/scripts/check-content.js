/**
 * Verifies every translated content pack still lines up with English.
 *
 *   node scripts/check-content.js
 *
 * Translations drift silently: an entry gets added to English and the other
 * packs quietly fall a remedy short, or a `region` gets translated and the
 * filter stops matching. This fails loudly instead.
 */
const fs = require('fs');
const path = require('path');

const CONTENT = path.join(__dirname, '..', 'src', 'data', 'content');
const CATEGORIES = ['home-remedies', 'herbs-roots', 'dietary-systems', 'fasting'];
const BASE = 'en';

const load = (lang, file) =>
  JSON.parse(fs.readFileSync(path.join(CONTENT, lang, `${file}.json`), 'utf8'));

const languages = fs
  .readdirSync(CONTENT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const problems = [];
const note = (msg) => problems.push(msg);

// Region values must stay identical across packs: they are keys, not prose.
const baseRegions = new Set();
for (const file of CATEGORIES) {
  for (const r of load(BASE, file).remedies) baseRegions.add(r.region);
}
for (const s of load(BASE, 'stories').stories) {
  if (s.region) baseRegions.add(s.region);
}

// Every region key needs a label in every locale file, or the UI shows the key.
const LOCALES = path.join(__dirname, '..', 'src', 'i18n', 'locales');
for (const lang of languages) {
  const localeFile = path.join(LOCALES, `${lang}.json`);
  if (!fs.existsSync(localeFile)) continue;
  const regions = JSON.parse(fs.readFileSync(localeFile, 'utf8')).regions || {};
  for (const key of baseRegions) {
    if (!regions[key]) note(`${lang}.json: missing region label for "${key}"`);
  }
}

for (const lang of languages) {
  for (const file of CATEGORIES) {
    const base = load(BASE, file);
    const pack = load(lang, file);

    if (pack.category !== base.category) {
      note(`${lang}/${file}: category "${pack.category}" != "${base.category}"`);
    }

    const baseIds = base.remedies.map((r) => r.id);
    const packIds = pack.remedies.map((r) => r.id);

    for (const id of baseIds) {
      if (!packIds.includes(id)) note(`${lang}/${file}: missing remedy "${id}"`);
    }
    for (const id of packIds) {
      if (!baseIds.includes(id)) note(`${lang}/${file}: unknown remedy "${id}"`);
    }

    for (const remedy of pack.remedies) {
      const original = base.remedies.find((r) => r.id === remedy.id);
      if (!original) continue;
      if (remedy.region !== original.region) {
        note(
          `${lang}/${file}/${remedy.id}: region "${remedy.region}" must stay "${original.region}" (it is a key, not display text)`
        );
      }
      // A translated entry that quietly drops its safety note is the one
      // drift that actually matters.
      if (original.disclaimer && !remedy.disclaimer) {
        note(`${lang}/${file}/${remedy.id}: safety note missing in translation`);
      }
      for (const field of ['title', 'ailments', 'ingredients', 'instructions']) {
        if (remedy[field] === undefined) {
          note(`${lang}/${file}/${remedy.id}: missing "${field}"`);
        }
      }
      if (remedy.instructions.length !== original.instructions.length) {
        note(
          `${lang}/${file}/${remedy.id}: ${remedy.instructions.length} steps vs ${original.instructions.length} in English`
        );
      }
    }
  }

  const baseStories = load(BASE, 'stories').stories.map((s) => s.id);
  const packStories = load(lang, 'stories').stories.map((s) => s.id);
  for (const id of baseStories) {
    if (!packStories.includes(id)) note(`${lang}/stories: missing story "${id}"`);
  }
}

const remedyCount = CATEGORIES.reduce(
  (n, f) => n + load(BASE, f).remedies.length,
  0
);

if (problems.length) {
  console.error(`✗ ${problems.length} content problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `✓ ${languages.length} content packs (${languages.join(', ')}) — ` +
    `${remedyCount} remedies + ${baseStories_count()} stories each, ids and regions aligned`
);

function baseStories_count() {
  return load(BASE, 'stories').stories.length;
}
