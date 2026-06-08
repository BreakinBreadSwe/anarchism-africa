/* BREAKIN BREAD — Free Cinema
 * Catalog of public-domain / free-to-stream films.
 *
 * Every title here is in the public domain (or otherwise free to view) and is
 * hosted on the Internet Archive, which permits embedding via
 *   https://archive.org/embed/{archive_id}
 * and direct viewing via
 *   https://archive.org/details/{archive_id}
 *
 * `archive_id`  — Internet Archive item identifier (drives the player + source link)
 * `poster`      — Archive's generated item thumbnail (always resolves for a valid id)
 * The UI also exposes a "Find on Internet Archive" search per title, so a film is
 * reachable even if an identifier is ever retired upstream.
 *
 * Nothing here is pirated, paywalled, or rights-restricted. Free bread for everyone.
 */
window.BB_CATALOG = [
  /* ── HORROR ────────────────────────────────────────────── */
  {
    id: "night-of-the-living-dead",
    title: "Night of the Living Dead",
    year: 1968,
    director: "George A. Romero",
    runtime: 96,
    genres: ["Horror", "Cult"],
    archive_id: "night_of_the_living_dead",
    featured: true,
    blurb: "The film that invented the modern zombie. Romero's micro-budget Pennsylvania nightmare fell into the public domain on release and never left — radical, claustrophobic, and still terrifying.",
    tags: ["zombies", "1960s", "independent", "black-and-white"]
  },
  {
    id: "nosferatu",
    title: "Nosferatu",
    year: 1922,
    director: "F. W. Murnau",
    runtime: 94,
    genres: ["Horror", "Silent"],
    archive_id: "Nosferatu_1922",
    featured: true,
    blurb: "The original screen vampire. Murnau's unauthorised Dracula is German Expressionism at its most spectral — all shadow, rats, and Max Schreck's impossible silhouette.",
    tags: ["vampire", "silent", "expressionism", "1920s"]
  },
  {
    id: "the-cabinet-of-dr-caligari",
    title: "The Cabinet of Dr. Caligari",
    year: 1920,
    director: "Robert Wiene",
    runtime: 67,
    genres: ["Horror", "Silent"],
    archive_id: "TheCabinetOfDrCaligari1920",
    blurb: "Painted shadows, leaning walls, a sleepwalking killer. The founding text of horror cinema and the purest distillation of Expressionist dread ever committed to film.",
    tags: ["silent", "expressionism", "1920s", "psychological"]
  },
  {
    id: "carnival-of-souls",
    title: "Carnival of Souls",
    year: 1962,
    director: "Herk Harvey",
    runtime: 78,
    genres: ["Horror", "Cult"],
    archive_id: "CarnivalOfSouls",
    blurb: "A church organist drifts toward an abandoned pavilion after a car crash. Dreamlike, cheap, and quietly devastating — a direct ancestor of Lynch and Romero alike.",
    tags: ["ghost", "1960s", "cult", "black-and-white"]
  },
  {
    id: "the-little-shop-of-horrors",
    title: "The Little Shop of Horrors",
    year: 1960,
    director: "Roger Corman",
    runtime: 72,
    genres: ["Horror", "Comedy"],
    archive_id: "the_little_shop_of_horrors",
    blurb: "Shot in two and a half days by Roger Corman, this man-eating-plant black comedy (with a young Jack Nicholson) became the cult seed for the Broadway musical decades later.",
    tags: ["comedy", "cult", "1960s", "corman"]
  },
  {
    id: "house-on-haunted-hill",
    title: "House on Haunted Hill",
    year: 1959,
    director: "William Castle",
    runtime: 75,
    genres: ["Horror", "Cult"],
    archive_id: "house_on_haunted_hill",
    blurb: "Vincent Price offers five strangers $10,000 to survive a night in a haunted mansion. Gimmick-king William Castle at his gleeful, rattling best.",
    tags: ["vincent-price", "1950s", "haunted-house", "cult"]
  },

  /* ── FILM NOIR ─────────────────────────────────────────── */
  {
    id: "detour",
    title: "Detour",
    year: 1945,
    director: "Edgar G. Ulmer",
    runtime: 68,
    genres: ["Noir", "Crime"],
    archive_id: "Detour_1945",
    featured: true,
    blurb: "The cheapest, bleakest, most fatalistic noir ever made — a hitchhiker swallowed whole by bad luck. Poverty-row filmmaking elevated to existential nightmare.",
    tags: ["noir", "1940s", "crime", "b-movie"]
  },
  {
    id: "d-o-a",
    title: "D.O.A.",
    year: 1949,
    director: "Rudolph Maté",
    runtime: 83,
    genres: ["Noir", "Crime"],
    archive_id: "d.o.a_1949",
    blurb: "\"I want to report a murder — my own.\" A man poisoned with no antidote spends his last hours hunting his own killer. One of noir's great ticking-clock premises.",
    tags: ["noir", "1940s", "crime", "mystery"]
  },
  {
    id: "the-stranger",
    title: "The Stranger",
    year: 1946,
    director: "Orson Welles",
    runtime: 95,
    genres: ["Noir", "Thriller"],
    archive_id: "the_stranger_1946",
    blurb: "Orson Welles plays a Nazi fugitive hiding in a sleepy Connecticut town as a war-crimes investigator closes in. Welles's most conventional thriller — and a taut one.",
    tags: ["orson-welles", "noir", "1940s", "thriller"]
  },
  {
    id: "scarlet-street",
    title: "Scarlet Street",
    year: 1945,
    director: "Fritz Lang",
    runtime: 102,
    genres: ["Noir", "Drama"],
    archive_id: "scarlet_street",
    blurb: "Edward G. Robinson, a meek cashier, is destroyed by a femme fatale and his own desire. Fritz Lang's pitiless study of obsession was briefly banned for its bleak morality.",
    tags: ["fritz-lang", "noir", "1940s", "femme-fatale"]
  },
  {
    id: "too-late-for-tears",
    title: "Too Late for Tears",
    year: 1949,
    director: "Byron Haskin",
    runtime: 99,
    genres: ["Noir", "Crime"],
    archive_id: "too_late_for_tears",
    blurb: "A bag of cash lands in the wrong car and Lizabeth Scott will do anything to keep it. A rediscovered noir with one of the genre's most ruthless leading women.",
    tags: ["noir", "1940s", "femme-fatale", "crime"]
  },
  {
    id: "suddenly",
    title: "Suddenly",
    year: 1954,
    director: "Lewis Allen",
    runtime: 75,
    genres: ["Noir", "Thriller"],
    archive_id: "suddenly_1954",
    blurb: "Frank Sinatra against type as a cold-blooded assassin who seizes a family home to shoot the President. A tense, single-room thriller with a chilling lead turn.",
    tags: ["sinatra", "noir", "1950s", "thriller"]
  },

  /* ── COMEDY / SCREWBALL ────────────────────────────────── */
  {
    id: "his-girl-friday",
    title: "His Girl Friday",
    year: 1940,
    director: "Howard Hawks",
    runtime: 92,
    genres: ["Comedy", "Romance"],
    archive_id: "his_girl_friday",
    featured: true,
    blurb: "The fastest-talking comedy ever made. Cary Grant and Rosalind Russell trade machine-gun dialogue as divorced newspaper rivals. Howard Hawks's screwball masterpiece.",
    tags: ["screwball", "1940s", "cary-grant", "romance"]
  },
  {
    id: "meet-john-doe",
    title: "Meet John Doe",
    year: 1941,
    director: "Frank Capra",
    runtime: 122,
    genres: ["Drama", "Comedy"],
    archive_id: "meet_john_doe",
    blurb: "Gary Cooper is a drifter turned into a fake populist folk hero by a cynical newspaper. Capra's darkest fable about media, crowds, and manufactured belief.",
    tags: ["capra", "1940s", "gary-cooper", "drama"]
  },
  {
    id: "the-kid",
    title: "The Kid",
    year: 1921,
    director: "Charlie Chaplin",
    runtime: 68,
    genres: ["Comedy", "Silent"],
    archive_id: "CharlieChaplinTheKid1921",
    blurb: "Chaplin's first feature — the Tramp raises an abandoned child in the slums. A perfect fusion of slapstick and heartbreak that still lands a century on.",
    tags: ["chaplin", "silent", "1920s", "tramp"]
  },
  {
    id: "charade",
    title: "Charade",
    year: 1963,
    director: "Stanley Donen",
    runtime: 113,
    genres: ["Comedy", "Thriller", "Romance"],
    archive_id: "charade_1963",
    featured: true,
    blurb: "Cary Grant and Audrey Hepburn in the best Hitchcock film Hitchcock never made — a Paris-set caper of stolen fortunes, mistaken identities, and impossible charm.",
    tags: ["cary-grant", "audrey-hepburn", "1960s", "caper"]
  },
  {
    id: "the-man-with-the-golden-arm",
    title: "The Man with the Golden Arm",
    year: 1955,
    director: "Otto Preminger",
    runtime: 119,
    genres: ["Drama", "Noir"],
    archive_id: "the_man_with_the_golden_arm",
    blurb: "Sinatra as a card dealer fighting heroin addiction — censor-defying in 1955, with Saul Bass titles and an Elmer Bernstein jazz score that changed film music.",
    tags: ["sinatra", "1950s", "preminger", "drama"]
  },

  /* ── SILENT & EARLY CINEMA ─────────────────────────────── */
  {
    id: "sherlock-jr",
    title: "Sherlock Jr.",
    year: 1924,
    director: "Buster Keaton",
    runtime: 45,
    genres: ["Comedy", "Silent"],
    archive_id: "SherlockJr",
    blurb: "A projectionist literally steps into the movie screen. Keaton's 45-minute marvel of physical comedy and in-camera trickery that filmmakers still can't explain.",
    tags: ["keaton", "silent", "1920s", "stunts"]
  },
  {
    id: "the-general",
    title: "The General",
    year: 1926,
    director: "Buster Keaton",
    runtime: 78,
    genres: ["Comedy", "Silent", "Adventure"],
    archive_id: "TheGeneral_201712",
    blurb: "Buster Keaton's Civil War railroad chase — routinely named the greatest comedy ever filmed. Every stunt is real, including the most expensive shot of the silent era.",
    tags: ["keaton", "silent", "1920s", "trains"]
  },
  {
    id: "the-phantom-of-the-opera",
    title: "The Phantom of the Opera",
    year: 1925,
    director: "Rupert Julian",
    runtime: 93,
    genres: ["Horror", "Silent"],
    archive_id: "ThePhantomOfTheOpera1925",
    blurb: "Lon Chaney's self-designed makeup reveal is still one of cinema's great shocks. The lavish, doom-laden silent that built the Universal horror tradition.",
    tags: ["lon-chaney", "silent", "1920s", "horror"]
  },
  {
    id: "battleship-potemkin",
    title: "Battleship Potemkin",
    year: 1925,
    director: "Sergei Eisenstein",
    runtime: 75,
    genres: ["Drama", "Silent"],
    archive_id: "BattleshipPotemkin",
    blurb: "The Odessa Steps. Eisenstein's revolutionary montage turned a 1905 mutiny into the most influential propaganda film — and editing lesson — in history.",
    tags: ["eisenstein", "silent", "1920s", "revolution"]
  },
  {
    id: "metropolis",
    title: "Metropolis",
    year: 1927,
    director: "Fritz Lang",
    runtime: 153,
    genres: ["Sci-Fi", "Silent"],
    archive_id: "Metropolis_201703",
    featured: true,
    blurb: "The towering ur-text of science fiction cinema. Lang's worker-vs-elite dystopia gave us the robot Maria, the vertical city, and a visual language films still borrow.",
    tags: ["fritz-lang", "silent", "1920s", "dystopia"]
  },

  /* ── SCI-FI / B-MOVIE ──────────────────────────────────── */
  {
    id: "plan-9-from-outer-space",
    title: "Plan 9 from Outer Space",
    year: 1959,
    director: "Ed Wood",
    runtime: 79,
    genres: ["Sci-Fi", "Cult"],
    archive_id: "Plan9FromOuterSpace_926",
    blurb: "Aliens resurrect the dead to stop humanity building a doomsday weapon. \"The worst film ever made\" — and one of the most beloved. Ed Wood's wobbly, sincere classic.",
    tags: ["ed-wood", "1950s", "so-bad-its-good", "aliens"]
  },
  {
    id: "the-brain-that-wouldnt-die",
    title: "The Brain That Wouldn't Die",
    year: 1962,
    director: "Joseph Green",
    runtime: 82,
    genres: ["Sci-Fi", "Horror"],
    archive_id: "TheBrainThatWouldntDie",
    blurb: "A surgeon keeps his fiancée's severed head alive while shopping for a new body. Lurid, deranged drive-in sci-fi that became an MST3K legend.",
    tags: ["1960s", "mad-science", "b-movie", "cult"]
  },
  {
    id: "the-last-man-on-earth",
    title: "The Last Man on Earth",
    year: 1964,
    director: "Ubaldo Ragona, Sidney Salkow",
    runtime: 86,
    genres: ["Sci-Fi", "Horror"],
    archive_id: "the_last_man_on_earth",
    blurb: "Vincent Price as the sole survivor of a plague that turned the world to vampires. The first adaptation of Matheson's I Am Legend — and a blueprint for Romero.",
    tags: ["vincent-price", "1960s", "post-apocalyptic", "vampires"]
  },

  /* ── WESTERN / ADVENTURE ───────────────────────────────── */
  {
    id: "mclintock",
    title: "McLintock!",
    year: 1963,
    director: "Andrew V. McLaglen",
    runtime: 127,
    genres: ["Western", "Comedy"],
    archive_id: "McLintock_1963",
    blurb: "John Wayne and Maureen O'Hara in a brawling, mud-slinging comic Western — a Taming-of-the-Shrew cattle-baron farce that fell straight into the public domain.",
    tags: ["john-wayne", "1960s", "western", "comedy"]
  },
  {
    id: "the-man-from-utah",
    title: "The Man from Utah",
    year: 1934,
    director: "Robert N. Bradbury",
    runtime: 52,
    genres: ["Western", "Adventure"],
    archive_id: "the_man_from_utah",
    blurb: "A young John Wayne goes undercover at a crooked rodeo. Lean Poverty-Row Western from Wayne's apprentice years, before Stagecoach made him a star.",
    tags: ["john-wayne", "1930s", "western", "rodeo"]
  },
  {
    id: "santa-fe-trail",
    title: "Santa Fe Trail",
    year: 1940,
    director: "Michael Curtiz",
    runtime: 110,
    genres: ["Western", "Drama"],
    archive_id: "santa_fe_trail",
    blurb: "Errol Flynn, Olivia de Havilland and a young Ronald Reagan ride the pre-Civil-War frontier. Big-studio adventure from the director of Casablanca.",
    tags: ["errol-flynn", "1940s", "western", "curtiz"]
  },

  /* ── ANIMATION / FAMILY ────────────────────────────────── */
  {
    id: "gullivers-travels",
    title: "Gulliver's Travels",
    year: 1939,
    director: "Dave Fleischer",
    runtime: 76,
    genres: ["Animation", "Family"],
    archive_id: "gullivers_travels_1939",
    blurb: "The Fleischer Studios' lush, hand-drawn answer to Disney's Snow White — a shipwrecked giant brokers peace between two tiny warring kingdoms.",
    tags: ["animation", "1930s", "family", "fleischer"]
  },
  {
    id: "the-snow-queen",
    title: "The Snow Queen",
    year: 1957,
    director: "Lev Atamanov",
    runtime: 64,
    genres: ["Animation", "Family"],
    archive_id: "the_snow_queen_1957",
    blurb: "The Soviet animated Hans Christian Andersen adaptation that Hayao Miyazaki credits with saving his career. Gorgeous, hand-drawn, and genuinely magical.",
    tags: ["animation", "1950s", "family", "miyazaki"]
  }
];
