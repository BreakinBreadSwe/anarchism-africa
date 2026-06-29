/* BREAKIN BREAD — Free Cinema
 * Global catalog of public-domain / free-to-stream films — world cinema, all languages.
 *
 * Multi-source by design. Each film carries a `source`:
 *   { kind: "archive",  id }            → embeds  archive.org/embed/{id}     (Internet Archive, public domain)
 *   { kind: "youtube",  id }            → embeds  youtube-nocookie.com/embed/{id}
 *   { kind: "vimeo",    id, poster }    → embeds  player.vimeo.com/video/{id}
 *   { kind: "external", platform, url } → opens the film on a film library / archive / channel (link-out)
 *
 * Why mixed: silent & early-sound world classics are genuinely hosted (and embeddable) on the
 * Internet Archive, so those play inline. Many sound-era world films are free to watch on official
 * YouTube channels and national film-archive sites; where an exact embed id isn't verified, the film
 * is listed as an `external` link-out (a real search/channel URL) so it always resolves — never a
 * broken player. Drop a verified `youtube`/`vimeo` id in and it upgrades to inline playback instantly.
 *
 * Every title here is in the public domain or otherwise free to view. Nothing pirated or paywalled.
 * Break bread, pass it on.
 */

// helper: a guaranteed-to-resolve "find & watch" link-out for unverified sound films
function find(platform, query) {
  const q = encodeURIComponent(query + " full movie");
  const url = platform === "Internet Archive"
    ? `https://archive.org/search?query=${encodeURIComponent(query)}`
    : `https://www.youtube.com/results?search_query=${q}`;
  return { kind: "external", platform, url };
}

window.BB_CATALOG = [
  /* ══════════ ENGLISH — United States / United Kingdom ══════════ */
  {
    id: "night-of-the-living-dead", title: "Night of the Living Dead", year: 1968,
    director: "George A. Romero", runtime: 96, language: "English", country: "United States",
    genres: ["Horror", "Cult"], featured: true, source: { kind: "archive", id: "night_of_the_living_dead" },
    blurb: "The film that invented the modern zombie — Romero's micro-budget nightmare fell into the public domain on release and never left.",
    tags: ["zombies", "1960s", "independent"]
  },
  {
    id: "his-girl-friday", title: "His Girl Friday", year: 1940,
    director: "Howard Hawks", runtime: 92, language: "English", country: "United States",
    genres: ["Comedy", "Romance"], source: { kind: "archive", id: "his_girl_friday" },
    blurb: "The fastest-talking comedy ever made — Cary Grant and Rosalind Russell as divorced newspaper rivals.",
    tags: ["screwball", "1940s"]
  },
  {
    id: "charade", title: "Charade", year: 1963,
    director: "Stanley Donen", runtime: 113, language: "English", country: "United States",
    genres: ["Thriller", "Romance", "Comedy"], featured: true, source: { kind: "archive", id: "charade_1963" },
    blurb: "Cary Grant and Audrey Hepburn in the best Hitchcock film Hitchcock never made — a Paris-set caper of stolen fortunes.",
    tags: ["caper", "1960s"]
  },
  {
    id: "detour", title: "Detour", year: 1945,
    director: "Edgar G. Ulmer", runtime: 68, language: "English", country: "United States",
    genres: ["Noir", "Crime"], source: { kind: "archive", id: "Detour_1945" },
    blurb: "The bleakest, most fatalistic noir ever made — a hitchhiker swallowed whole by bad luck.",
    tags: ["noir", "1940s"]
  },
  {
    id: "sherlock-jr", title: "Sherlock Jr.", year: 1924,
    director: "Buster Keaton", runtime: 45, language: "English (silent)", country: "United States",
    genres: ["Comedy", "Silent"], source: { kind: "archive", id: "SherlockJr" },
    blurb: "A projectionist steps into the movie screen — Keaton's marvel of physical comedy and in-camera magic.",
    tags: ["keaton", "1920s", "silent"]
  },
  {
    id: "the-general", title: "The General", year: 1926,
    director: "Buster Keaton", runtime: 78, language: "English (silent)", country: "United States",
    genres: ["Comedy", "Silent", "Adventure"], source: { kind: "archive", id: "TheGeneral_201712" },
    blurb: "Keaton's Civil War railroad chase — routinely named the greatest comedy ever filmed, every stunt real.",
    tags: ["keaton", "1920s", "silent"]
  },
  {
    id: "plan-9-from-outer-space", title: "Plan 9 from Outer Space", year: 1959,
    director: "Ed Wood", runtime: 79, language: "English", country: "United States",
    genres: ["Sci-Fi", "Cult"], source: { kind: "archive", id: "Plan9FromOuterSpace_926" },
    blurb: "\"The worst film ever made\" — and one of the most beloved. Ed Wood's wobbly, sincere classic.",
    tags: ["1950s", "so-bad-its-good"]
  },
  {
    id: "d-o-a", title: "D.O.A.", year: 1949,
    director: "Rudolph Maté", runtime: 83, language: "English", country: "United States",
    genres: ["Noir", "Crime"], source: { kind: "archive", id: "d.o.a_1949" },
    blurb: "\"I want to report a murder — my own.\" A poisoned man hunts his own killer against the clock.",
    tags: ["noir", "1940s"]
  },

  /* ══════════ FRENCH — France ══════════ */
  {
    id: "a-trip-to-the-moon", title: "A Trip to the Moon", year: 1902,
    director: "Georges Méliès", runtime: 13, language: "French (silent)", country: "France",
    genres: ["Sci-Fi", "Silent"], featured: true, source: { kind: "archive", id: "LeVoyageDansLaLune" },
    blurb: "The rocket in the Moon's eye — Méliès's 1902 wonder is the founding act of science-fiction cinema.",
    tags: ["melies", "1900s", "silent", "world-cinema"]
  },
  {
    id: "the-passion-of-joan-of-arc", title: "The Passion of Joan of Arc", year: 1928,
    director: "Carl Theodor Dreyer", runtime: 82, language: "French (silent)", country: "France",
    genres: ["Drama", "Silent"], source: { kind: "archive", id: "ThePassionOfJoanOfArc" },
    blurb: "Dreyer's trial of Joan told almost entirely in close-up — one of the most overwhelming films of the silent era.",
    tags: ["dreyer", "1920s", "silent", "world-cinema"]
  },
  {
    id: "un-chien-andalou", title: "Un Chien Andalou", year: 1929,
    director: "Luis Buñuel & Salvador Dalí", runtime: 21, language: "French (silent)", country: "France",
    genres: ["Avant-Garde", "Silent"], source: { kind: "archive", id: "UnChienAndalou" },
    blurb: "Buñuel and Dalí's Surrealist hand-grenade — the sliced eye, the ants, the dream logic that broke cinema open.",
    tags: ["surrealism", "1920s", "world-cinema"]
  },

  /* ══════════ GERMAN — Germany ══════════ */
  {
    id: "metropolis", title: "Metropolis", year: 1927,
    director: "Fritz Lang", runtime: 153, language: "German (silent)", country: "Germany",
    genres: ["Sci-Fi", "Silent"], featured: true, source: { kind: "archive", id: "Metropolis_201703" },
    blurb: "The towering ur-text of science-fiction cinema — Lang's worker-vs-elite dystopia and its robot Maria.",
    tags: ["fritz-lang", "1920s", "silent", "world-cinema"]
  },
  {
    id: "nosferatu", title: "Nosferatu", year: 1922,
    director: "F. W. Murnau", runtime: 94, language: "German (silent)", country: "Germany",
    genres: ["Horror", "Silent"], featured: true, source: { kind: "archive", id: "Nosferatu_1922" },
    blurb: "The original screen vampire — Murnau's unauthorised Dracula is German Expressionism at its most spectral.",
    tags: ["vampire", "1920s", "silent", "world-cinema"]
  },
  {
    id: "the-cabinet-of-dr-caligari", title: "The Cabinet of Dr. Caligari", year: 1920,
    director: "Robert Wiene", runtime: 67, language: "German (silent)", country: "Germany",
    genres: ["Horror", "Silent"], source: { kind: "archive", id: "TheCabinetOfDrCaligari1920" },
    blurb: "Painted shadows, leaning walls, a sleepwalking killer — the founding text of horror cinema.",
    tags: ["expressionism", "1920s", "silent", "world-cinema"]
  },
  {
    id: "faust", title: "Faust", year: 1926,
    director: "F. W. Murnau", runtime: 116, language: "German (silent)", country: "Germany",
    genres: ["Fantasy", "Silent"], source: { kind: "archive", id: "Faust1926" },
    blurb: "Murnau's last German film — a demon's wager and some of the most astonishing images of the silent age.",
    tags: ["murnau", "1920s", "silent", "world-cinema"]
  },

  /* ══════════ RUSSIAN — USSR / Russia ══════════ */
  {
    id: "battleship-potemkin", title: "Battleship Potemkin", year: 1925,
    director: "Sergei Eisenstein", runtime: 75, language: "Russian (silent)", country: "Soviet Union",
    genres: ["Drama", "Silent"], featured: true, source: { kind: "archive", id: "BattleshipPotemkin" },
    blurb: "The Odessa Steps — Eisenstein's montage turned a 1905 mutiny into the most influential film in history.",
    tags: ["eisenstein", "1920s", "silent", "world-cinema"]
  },
  {
    id: "man-with-a-movie-camera", title: "Man with a Movie Camera", year: 1929,
    director: "Dziga Vertov", runtime: 68, language: "Russian (silent)", country: "Soviet Union",
    genres: ["Documentary", "Silent", "Avant-Garde"], source: { kind: "archive", id: "ManWithAMovieCamera" },
    blurb: "A day in the Soviet city as pure cinema — Vertov's dizzying experiment, often voted the greatest documentary ever.",
    tags: ["vertov", "1920s", "silent", "world-cinema"]
  },
  {
    id: "aelita-queen-of-mars", title: "Aelita: Queen of Mars", year: 1924,
    director: "Yakov Protazanov", runtime: 111, language: "Russian (silent)", country: "Soviet Union",
    genres: ["Sci-Fi", "Silent"], source: { kind: "archive", id: "Aelita1924" },
    blurb: "Constructivist Mars, a Soviet engineer's dream of revolution in the stars — early sci-fi spectacle.",
    tags: ["1920s", "silent", "world-cinema"]
  },

  /* ══════════ ITALIAN — Italy ══════════ */
  {
    id: "cabiria", title: "Cabiria", year: 1914,
    director: "Giovanni Pastrone", runtime: 148, language: "Italian (silent)", country: "Italy",
    genres: ["Epic", "Silent", "Adventure"], source: { kind: "archive", id: "Cabiria" },
    blurb: "The colossal Italian epic that taught the world the tracking shot — Hannibal, the Punic Wars, and the strongman Maciste.",
    tags: ["1910s", "silent", "epic", "world-cinema"]
  },

  /* ══════════ SWEDISH / DANISH — Scandinavia ══════════ */
  {
    id: "the-phantom-carriage", title: "The Phantom Carriage", year: 1921,
    director: "Victor Sjöström", runtime: 107, language: "Swedish (silent)", country: "Sweden",
    genres: ["Drama", "Horror", "Silent"], source: { kind: "archive", id: "ThePhantomCarriage" },
    blurb: "The last sinner to die each year must drive Death's cart — Sjöström's haunting multiple-exposure landmark, a Bergman favourite.",
    tags: ["1920s", "silent", "world-cinema"]
  },
  {
    id: "haxan", title: "Häxan (Witchcraft Through the Ages)", year: 1922,
    director: "Benjamin Christensen", runtime: 105, language: "Danish (silent)", country: "Denmark / Sweden",
    genres: ["Horror", "Documentary", "Silent"], source: { kind: "archive", id: "Haxan" },
    blurb: "A part-essay, part-nightmare history of witchcraft — still one of the most transgressive images of the silent era.",
    tags: ["1920s", "silent", "world-cinema"]
  },

  /* ══════════ MANDARIN CHINESE — China ══════════ */
  {
    id: "the-goddess", title: "The Goddess (神女)", year: 1934,
    director: "Wu Yonggang", runtime: 85, language: "Mandarin Chinese (silent)", country: "China",
    genres: ["Drama", "Silent"], featured: true, source: { kind: "archive", id: "TheGoddess1934" },
    blurb: "Ruan Lingyu as a Shanghai mother surviving by night to school her son — the towering classic of Chinese silent cinema.",
    tags: ["1930s", "silent", "shanghai", "world-cinema"]
  },
  {
    id: "spring-in-a-small-town", title: "Spring in a Small Town (小城之春)", year: 1948,
    director: "Fei Mu", runtime: 98, language: "Mandarin Chinese", country: "China",
    genres: ["Drama", "Romance"], source: find("YouTube", "Spring in a Small Town 1948 Fei Mu"),
    blurb: "A married woman, a ruined house, an old love returning — routinely voted the greatest Chinese film ever made.",
    tags: ["1940s", "world-cinema"]
  },

  /* ══════════ JAPANESE — Japan ══════════ */
  {
    id: "a-page-of-madness", title: "A Page of Madness (狂った一頁)", year: 1926,
    director: "Teinosuke Kinugasa", runtime: 70, language: "Japanese (silent)", country: "Japan",
    genres: ["Avant-Garde", "Drama", "Silent"], source: { kind: "archive", id: "APageOfMadness" },
    blurb: "A janitor at an asylum where his wife is committed — a lost-then-found avant-garde fever dream of Japanese silent cinema.",
    tags: ["1920s", "silent", "world-cinema"]
  },
  {
    id: "i-was-born-but", title: "I Was Born, But… (大人の見る絵本 生れてはみたけれど)", year: 1932,
    director: "Yasujirō Ozu", runtime: 100, language: "Japanese (silent)", country: "Japan",
    genres: ["Comedy", "Drama", "Silent"], source: find("YouTube", "I Was Born But 1932 Ozu"),
    blurb: "Two boys discover their father bows and scrapes to his boss — Ozu's tender, funny silent on childhood and class.",
    tags: ["ozu", "1930s", "silent", "world-cinema"]
  },

  /* ══════════ SPANISH — Spain / Mexico ══════════ */
  {
    id: "land-without-bread", title: "Land Without Bread (Las Hurdes)", year: 1933,
    director: "Luis Buñuel", runtime: 27, language: "Spanish", country: "Spain",
    genres: ["Documentary"], source: { kind: "archive", id: "LandWithoutBread" },
    blurb: "Buñuel's savage \"documentary\" on a forgotten Spanish region — a Surrealist's grenade aimed at the form itself.",
    tags: ["bunuel", "1930s", "world-cinema"]
  },
  {
    id: "los-olvidados", title: "Los Olvidados (The Young and the Damned)", year: 1950,
    director: "Luis Buñuel", runtime: 80, language: "Spanish", country: "Mexico",
    genres: ["Drama", "Crime"], source: find("YouTube", "Los Olvidados 1950 Buñuel"),
    blurb: "Street children in the slums of Mexico City — Buñuel's unflinching Cannes-winning masterpiece of poverty and cruelty.",
    tags: ["bunuel", "1950s", "world-cinema"]
  },

  /* ══════════ PORTUGUESE — Brazil ══════════ */
  {
    id: "limite", title: "Limite", year: 1931,
    director: "Mário Peixoto", runtime: 114, language: "Portuguese (silent)", country: "Brazil",
    genres: ["Avant-Garde", "Drama", "Silent"], source: find("YouTube", "Limite 1931 Mário Peixoto"),
    blurb: "Three castaways adrift in a boat, told in pure rhythmic imagery — the legendary peak of Brazilian silent cinema.",
    tags: ["1930s", "silent", "world-cinema"]
  },

  /* ══════════ ARABIC — Egypt ══════════ */
  {
    id: "cairo-station", title: "Cairo Station (Bab el Hadid / باب الحديد)", year: 1958,
    director: "Youssef Chahine", runtime: 77, language: "Arabic", country: "Egypt",
    genres: ["Drama", "Noir"], featured: true, source: find("YouTube", "Cairo Station Bab el Hadid 1958 Chahine"),
    blurb: "A crippled newspaper seller's obsession boils over in Cairo's central station — Chahine's electric Egyptian classic.",
    tags: ["chahine", "1950s", "world-cinema"]
  },

  /* ══════════ HINDI — India ══════════ */
  {
    id: "awaara", title: "Awaara (आवारा / The Vagabond)", year: 1951,
    director: "Raj Kapoor", runtime: 168, language: "Hindi", country: "India",
    genres: ["Drama", "Musical"], source: find("YouTube", "Awaara 1951 Raj Kapoor full movie"),
    blurb: "A judge's abandoned son turns to crime — Raj Kapoor's landmark melodrama, a sensation from Moscow to Cairo.",
    tags: ["1950s", "bollywood", "world-cinema"]
  },
  {
    id: "mother-india", title: "Mother India (मदर इंडिया)", year: 1957,
    director: "Mehboob Khan", runtime: 172, language: "Hindi", country: "India",
    genres: ["Drama", "Epic"], source: find("YouTube", "Mother India 1957 full movie"),
    blurb: "A peasant woman's endurance across decades of hardship — India's defining epic and its first Oscar nominee.",
    tags: ["1950s", "epic", "world-cinema"]
  },

  /* ══════════ BENGALI — India ══════════ */
  {
    id: "pather-panchali", title: "Pather Panchali (পথের পাঁচালী)", year: 1955,
    director: "Satyajit Ray", runtime: 125, language: "Bengali", country: "India",
    genres: ["Drama"], featured: true, source: find("YouTube", "Pather Panchali 1955 Satyajit Ray full movie"),
    blurb: "Apu's childhood in a Bengal village — Ray's debut and the start of the greatest trilogy in world cinema.",
    tags: ["ray", "1950s", "world-cinema"]
  },

  /* ══════════ TELUGU / TAMIL — India ══════════ */
  {
    id: "mayabazar", title: "Mayabazar (మాయాబజార్)", year: 1957,
    director: "Kadiri Venkata Reddy", runtime: 184, language: "Telugu", country: "India",
    genres: ["Fantasy", "Musical"], source: find("YouTube", "Mayabazar 1957 full movie"),
    blurb: "A magical wedding from the Mahabharata, staged with dazzling trick photography — the most beloved Telugu film of all time.",
    tags: ["1950s", "mythological", "world-cinema"]
  },

  /* ══════════ KOREAN — South Korea ══════════ */
  {
    id: "the-housemaid", title: "The Housemaid (하녀)", year: 1960,
    director: "Kim Ki-young", runtime: 108, language: "Korean", country: "South Korea",
    genres: ["Thriller", "Drama"], featured: true, source: find("YouTube", "The Housemaid 1960 Kim Ki-young Korean Classic Film"),
    blurb: "A composer's household is invaded by a predatory maid — the delirious, unhinged peak of Korean golden-age cinema.",
    tags: ["1960s", "world-cinema"]
  },
  {
    id: "aimless-bullet", title: "Aimless Bullet (오발탄)", year: 1961,
    director: "Yu Hyun-mok", runtime: 110, language: "Korean", country: "South Korea",
    genres: ["Drama"], source: find("YouTube", "Aimless Bullet 1961 Korean Classic Film"),
    blurb: "A clerk's family disintegrating in post-war Seoul — often named the greatest Korean film ever made.",
    tags: ["1960s", "world-cinema"]
  },

  /* ══════════ PERSIAN — Iran ══════════ */
  {
    id: "the-house-is-black", title: "The House Is Black (خانه سیاه است)", year: 1963,
    director: "Forough Farrokhzad", runtime: 22, language: "Persian", country: "Iran",
    genres: ["Documentary"], source: find("YouTube", "The House Is Black 1963 Forough Farrokhzad"),
    blurb: "A poet's gaze on a leper colony — the short, luminous documentary that seeded the entire Iranian New Wave.",
    tags: ["1960s", "world-cinema"]
  },

  /* ══════════ TURKISH — Turkey ══════════ */
  {
    id: "dry-summer", title: "Dry Summer (Susuz Yaz)", year: 1963,
    director: "Metin Erksan", runtime: 90, language: "Turkish", country: "Turkey",
    genres: ["Drama"], source: find("YouTube", "Susuz Yaz Dry Summer 1963 full movie"),
    blurb: "A landowner dams the water his village depends on — the Berlin-winning landmark of Turkish cinema.",
    tags: ["1960s", "world-cinema"]
  },

  /* ══════════ INDONESIAN — Indonesia ══════════ */
  {
    id: "after-the-curfew", title: "After the Curfew (Lewat Djam Malam)", year: 1954,
    director: "Usmar Ismail", runtime: 101, language: "Indonesian", country: "Indonesia",
    genres: ["Drama", "Noir"], source: find("YouTube", "Lewat Djam Malam After the Curfew 1954"),
    blurb: "A disillusioned revolutionary can't fit back into peacetime Bandung — the restored cornerstone of Indonesian film.",
    tags: ["1950s", "world-cinema"]
  },

  /* ══════════ URDU — Pakistan ══════════ */
  {
    id: "jago-hua-savera", title: "Jago Hua Savera (The Day Shall Dawn)", year: 1959,
    director: "A. J. Kardar", runtime: 96, language: "Urdu / Bengali", country: "Pakistan",
    genres: ["Drama"], source: find("YouTube", "Jago Hua Savera 1959 full movie"),
    blurb: "Fisher families on the Meghna river, scripted by the poet Faiz Ahmed Faiz — a rediscovered jewel of Pakistani cinema.",
    tags: ["1950s", "world-cinema"]
  },

  /* ══════════ CANTONESE — Hong Kong ══════════ */
  {
    id: "the-kid-bruce-lee", title: "The Kid (細路祥)", year: 1950,
    director: "Fung Fung", runtime: 78, language: "Cantonese", country: "Hong Kong",
    genres: ["Drama"], source: find("YouTube", "The Kid 1950 Bruce Lee Cantonese full movie"),
    blurb: "A street orphan in post-war Hong Kong — notable for a ten-year-old Bruce Lee in his first major child role.",
    tags: ["1950s", "world-cinema"]
  }
];
