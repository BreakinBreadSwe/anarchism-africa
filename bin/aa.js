#!/usr/bin/env node
/* ANARCHISM.AFRICA — terminal client (`aa`)
 * Zero-dependency Node TUI. Punk · underground · Pan-African.
 *
 * Usage:
 *   aa                      interactive launcher
 *   aa films | articles | events | music | books | merch | community
 *   aa play <song-title>    stream a track via system player
 *   aa chat                 talk to A.A.AI in the terminal
 *   aa shop                 browse merch
 *   aa about                manifesto
 *   aa update               pull fresh seed.json
 *   aa --help               this screen
 *   aa --host <url>         override the API host
 */

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const cp    = require('child_process');
const rl    = require('readline');

// ----- CONFIG ---------------------------------------------------------------
const HOST  = (process.env.AA_HOST || flag('--host') || 'https://anarchism-africa.vercel.app').replace(/\/$/, '');
const CACHE = path.join(os.homedir(), '.cache', 'anarchism.africa');
fs.mkdirSync(CACHE, { recursive: true });
const SEED  = path.join(CACHE, 'seed.json');

// ----- ANSI -----------------------------------------------------------------
const C = {
  reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m', italic:'\x1b[3m', under:'\x1b[4m', invert:'\x1b[7m',
  black:'\x1b[30m', red:'\x1b[31m', green:'\x1b[32m', yellow:'\x1b[33m', blue:'\x1b[34m',
  magenta:'\x1b[35m', cyan:'\x1b[36m', white:'\x1b[37m',
  bgBlack:'\x1b[40m', bgRed:'\x1b[41m', bgYellow:'\x1b[43m', bgWhite:'\x1b[47m'
};
const tty = process.stdout.isTTY;
const c = (color, s) => tty ? color + s + C.reset : s;
const W = () => process.stdout.columns || 80;

function flag (name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i+1] : null;
}

// ----- BANNER ---------------------------------------------------------------
const SLOGANS = [
  'no gods · no masters · no managers',
  'sankofa is a strategy, not a souvenir',
  'we did not invent solidarity, we re-membered it',
  'no warehouse, no waste, no boss',
  'the commune sets its own clock',
  'every market woman runs a horizontal collective',
  'pan-african · anti-state · pro-people'
];

function banner () {
  const w = Math.min(W(), 78);
  const bar = '█'.repeat(w);
  const sub = SLOGANS[Math.floor(Math.random()*SLOGANS.length)];
  const lines = [
    '',
    c(C.yellow + C.bold, ' ▄▀█ █▄ █ ▄▀█ █▀█ █▀▀ █ █ █ █▀ █▀▄▀█ ▄▄ ▄▀█ █▀▀ █▀█ █ █▀▀ ▄▀█'),
    c(C.red    + C.bold, ' █▀█ █ ▀█ █▀█ █▀▄ █▄▄ █▀█ █ ▄█ █ ▀ █ █▀█ █▀░ █▀▄ █ █▄▄ █▀█'),
    c(C.green,           '       ' + sub),
    ''
  ];
  lines.forEach(l => console.log(l));
}

// ----- HTTP -----------------------------------------------------------------
function fetchJson (url) {
  return new Promise((resolve, reject) => {
    const m = url.startsWith('https') ? https : http;
    m.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return fetchJson(r.headers.location).then(resolve, reject);
      let body = '';
      r.on('data', d => body += d);
      r.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('bad json from ' + url)); }
      });
    }).on('error', reject);
  });
}
async function loadSeed (force = false) {
  if (!force && fs.existsSync(SEED) && Date.now() - fs.statSync(SEED).mtimeMs < 6*3600e3) {
    return JSON.parse(fs.readFileSync(SEED, 'utf8'));
  }
  try {
    const data = await fetchJson(HOST + '/data/seed.json');
    fs.writeFileSync(SEED, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fs.existsSync(SEED)) return JSON.parse(fs.readFileSync(SEED, 'utf8'));
    throw e;
  }
}

// ----- LIST RENDERERS -------------------------------------------------------
function head (s) { console.log('\n' + c(C.bgYellow + C.black + C.bold, ' ' + s.toUpperCase() + ' ')); }
function row (i, t, sub) {
  const num = c(C.dim, String(i+1).padStart(2,' ') + '.');
  const title = c(C.bold + C.yellow, t);
  const meta  = sub ? c(C.dim, ' · ' + sub) : '';
  console.log(`  ${num} ${title}${meta}`);
}

function listFilms (data)    { head('films');    data.films.forEach((f,i)    => row(i, f.title, `${f.director} · ${f.duration}min`)); }
function listArticles (data) { head('library');  data.articles.forEach((a,i) => row(i, a.title, `${a.author} · ${a.reading_time}min · ${a.category}`)); }
function listEvents (data)   { head('events');   data.events.forEach((e,i)   => row(i, e.title, `${new Date(e.starts_at).toLocaleDateString()} · ${e.city}`)); }
function listMusic (data)    { head('music');    data.music.forEach((s,i)    => row(i, s.title, `${s.artist} · ${Math.floor(s.duration/60)}:${String(s.duration%60).padStart(2,'0')}`)); }
function listBooks (data)    { head('books');    data.books.forEach((b,i)    => row(i, b.title, `${b.author} · ${b.pages}p · ${b.publisher}`)); }
function listMerch (data) {
  head('giftshop  ·  print-on-demand  ·  eco only');
  data.merch.forEach((m,i) => row(i, m.title, `€${m.price_eur} · ${m.provider} · ${m.eco.join(', ')} · ~${m.carbon_g}g CO₂`));
}
function listCommunity (data) {
  head('community');
  data.community.forEach((p,i) => row(i, p.title, `@${p.author} · #${p.topic} · ♥${p.likes}`));
}
function listGrants (data) {
  head('grants tracker');
  data.grants.forEach((g,i) => row(i, `${g.funder} · ${g.title}`, `${g.amount} · deadline ${g.deadline} · ${g.status}`));
}

// ----- ARTICLE READER -------------------------------------------------------
function wrap (s, w) {
  const out = []; let line = '';
  s.split(/\s+/).forEach(word => {
    if ((line + ' ' + word).trim().length > w) { out.push(line); line = word; }
    else line = (line ? line + ' ' : '') + word;
  });
  if (line) out.push(line);
  return out;
}
function readArticle (a) {
  const w = Math.min(W(), 76);
  console.log('\n' + c(C.bold + C.yellow, a.title));
  console.log(c(C.dim, `${a.author} · ${a.reading_time} min · ${a.category}\n`));
  const text = a.body || a.summary || '';
  wrap(text, w).forEach(l => console.log('  ' + l));
  console.log('');
}

// ----- AUDIO PLAY -----------------------------------------------------------
function platformPlayer () {
  if (process.platform === 'darwin') return ['afplay', []];
  if (process.platform === 'linux')  return ['mpv', ['--no-video','--really-quiet']];
  if (process.platform === 'win32')  return ['cmd', ['/c','start','']];
  return null;
}
function playSong (data, q) {
  const s = data.music.find(x => x.title.toLowerCase().includes((q||'').toLowerCase())) || data.music[0];
  if (!s) return console.log(c(C.red, 'no song matched.'));
  console.log(c(C.green, `▶ ${s.title} — ${s.artist}`));
  const [bin, args] = platformPlayer() || [];
  if (!bin) {
    console.log(c(C.dim, 'no system player found. Open this URL: ') + s.audio);
    return;
  }
  const child = cp.spawn(bin, [...(args||[]), s.audio], { stdio: 'inherit' });
  child.on('error', () => console.log(c(C.red, 'player error — try: open ' + s.audio)));
}

// ----- LINK OPENER ----------------------------------------------------------
function openUrl (url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  cp.spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref();
}

// ----- A.A.AI CHAT ----------------------------------------------------------
async function chatLoop () {
  const r = rl.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(res => r.question(q, res));
  console.log(c(C.green, '\n[anarchist@africa]$ ') + c(C.dim, 'A.A.AI · type "exit" to quit, "/help" for slogans'));
  const history = [];
  while (true) {
    const q = await ask(c(C.yellow + C.bold, '\n› '));
    if (!q) continue;
    if (/^(exit|quit|q)$/i.test(q.trim())) break;
    if (q.trim() === '/help') { console.log(c(C.dim, SLOGANS.join('\n'))); continue; }
    history.push({ role: 'user', content: q });
    process.stdout.write(c(C.dim, '… '));
    let answer = '';
    try {
      const body = JSON.stringify({ provider: 'gemini', messages: [
        { role: 'system', content: 'You are A.A.AI, the underground library oracle of ANARCHISM.AFRICA. Terse. Pan-African. Punk. Cite films/books/events/articles when useful.' },
        ...history.slice(-10)
      ]});
      const data = await postJson(HOST + '/api/ai/chat', body);
      answer = data.text || data.message || (data.choices && data.choices[0]?.message?.content) || '';
    } catch (e) {}
    if (!answer) {
      const fallbacks = [
        'archive offline. go read Walter Rodney.',
        'the model is sleeping. try the library tab.',
        'no signal. organise locally.'
      ];
      answer = fallbacks[Math.floor(Math.random()*fallbacks.length)];
    }
    history.push({ role: 'assistant', content: answer });
    process.stdout.write('\r' + ' '.repeat(W()) + '\r');
    console.log(c(C.green, answer));
  }
  r.close();
}
function postJson (url, body) {
  return new Promise((resolve, reject) => {
    const m = url.startsWith('https') ? https : http;
    const u = new URL(url);
    const req = m.request({ hostname:u.hostname, port:u.port, path:u.pathname, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} },
      (r) => { let b = ''; r.on('data', d => b+=d); r.on('end', () => { try { resolve(JSON.parse(b)); } catch { reject(new Error(b)); } }); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ----- INTERACTIVE LAUNCHER -------------------------------------------------
async function launcher (data) {
  const r = rl.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(res => r.question(q, res));
  while (true) {
    head('main menu');
    const items = [
      ['1', 'films',        () => listFilms(data)],
      ['2', 'library',      () => listArticles(data)],
      ['3', 'events',       () => listEvents(data)],
      ['4', 'music',        () => listMusic(data)],
      ['5', 'books',        () => listBooks(data)],
      ['6', 'giftshop',     () => listMerch(data)],
      ['7', 'community',    () => listCommunity(data)],
      ['8', 'grants',       () => listGrants(data)],
      ['9', 'A.A.AI chat',  () => chatLoop()],
      ['p', 'play music',   async () => { const q = await ask(c(C.dim, 'song? ')); playSong(data, q); }],
      ['o', 'open in web',  () => { console.log(c(C.dim, 'opening ' + HOST)); openUrl(HOST); }],
      ['u', 'pull update',  async () => { await loadSeed(true); console.log(c(C.green, '✓ refreshed')); }],
      ['q', 'quit',         () => process.exit(0)]
    ];
    items.forEach(([k, label]) => console.log(`  ${c(C.yellow + C.bold, '['+k+']')} ${label}`));
    const choice = (await ask(c(C.green, '\n[anarchist@africa]$ '))).trim().toLowerCase();
    const item = items.find(x => x[0] === choice);
    if (!item) { console.log(c(C.red, '— no.')); continue; }
    await item[2]();
  }
}

// ----- HELP -----------------------------------------------------------------
function help () {
  banner();
  const lines = [
    'usage:',
    '  aa                        interactive launcher',
    '  aa films | articles | events | music | books | merch | community | grants',
    '  aa play [song-title]      stream a track via system player',
    '  aa chat                   talk to A.A.AI in the terminal',
    '  aa about                  manifesto',
    '  aa update                 pull fresh seed.json',
    '  aa --host <url>           override the API host',
    '  aa --help                 this screen',
    '',
    'env: AA_HOST=https://your-domain.com'
  ];
  lines.forEach(l => console.log(c(C.dim, l)));
}

function about () {
  banner();
  const lines = [
    'ANARCHISM.AFRICA is a 360° platform for afro-anarchism — Africa & diaspora.',
    'Stewarded by LUVLAB · curated by COOLHUNTPARIS.',
    '',
    'A library, a magazine, an expo and a giftshop, held together by mutual aid.',
    'Print-on-demand only. No warehouse, no waste, no boss.',
    '',
    'web   ' + HOST,
    'cli   `aa --help`',
    ''
  ];
  lines.forEach(l => console.log('  ' + l));
}

// ----- ENTRY ----------------------------------------------------------------
async function main () {
  const argv = process.argv.slice(2).filter(a => !['--host'].includes(a) && !a.startsWith('http'));
  const cmd = argv[0];
  if (cmd === '--help' || cmd === '-h') return help();
  if (cmd === 'about')   return about();
  if (cmd === 'update')  { await loadSeed(true); return console.log(c(C.green, '✓ refreshed')); }
  if (cmd === 'chat')    return chatLoop();

  let data;
  try { data = await loadSeed(); } catch (e) {
    banner();
    console.log(c(C.red, 'could not reach the archive. set AA_HOST=https://anarchism-africa.vercel.app and retry.'));
    process.exit(1);
  }

  if (!cmd)               { banner(); return launcher(data); }
  if (cmd === 'films')    return listFilms(data);
  if (cmd === 'articles' || cmd === 'library') return listArticles(data);
  if (cmd === 'events')   return listEvents(data);
  if (cmd === 'music')    return listMusic(data);
  if (cmd === 'books')    return listBooks(data);
  if (cmd === 'merch' || cmd === 'shop') return listMerch(data);
  if (cmd === 'community') return listCommunity(data);
  if (cmd === 'grants')   return listGrants(data);
  if (cmd === 'play')     return playSong(data, argv.slice(1).join(' '));
  if (cmd === 'read') {
    const q = argv.slice(1).join(' ').toLowerCase();
    const a = data.articles.find(x => x.title.toLowerCase().includes(q)) || data.articles[0];
    return readArticle(a);
  }
  console.log(c(C.red, 'unknown: ' + cmd) + '\n');
  help();
}
main().catch(e => { console.error(c(C.red, 'error: ') + e.message); process.exit(1); });
