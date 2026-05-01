-- =====================================================================
-- ANARCHISM.AFRICA — Database Schema (Postgres / Supabase)
-- =====================================================================
-- Roles: admin (LUVLAB), publisher (COOLHUNTPARIS), merch (staff),
--        partner (collaborator), consumer (client / ambassador-eligible)
-- =====================================================================

create extension if not exists "uuid-ossp";

-- USERS / PROFILES ---------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key default uuid_generate_v4(),
  auth_id       uuid unique,
  email         text unique not null,
  display_name  text,
  role          text not null default 'consumer'
                check (role in ('admin','publisher','merch','partner','consumer','ambassador')),
  city          text,
  country       text,
  bio           text,
  avatar_url    text,
  is_ambassador boolean default false,
  created_at    timestamptz default now()
);

-- UNIFIED CONTENT INDEX (drives the home-page hero slideshow) --------------
-- Every publishable thing on the platform appears here so the slideshow,
-- search, and feed can pull a single mixed stream.
create table if not exists content_items (
  id           uuid primary key default uuid_generate_v4(),
  type         text not null check (type in
               ('film','article','event','song','book','merch','campaign','expo')),
  title        text not null,
  slug         text unique,
  subtitle     text,
  summary      text,
  body         text,
  hero_image   text,
  hero_video   text,
  hero_audio   text,
  cta_url      text,
  tags         text[],
  region       text,
  author_id    uuid references profiles(id),
  status       text default 'published'
               check (status in ('draft','published','archived')),
  featured     boolean default false,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_content_type      on content_items(type);
create index if not exists idx_content_featured  on content_items(featured);
create index if not exists idx_content_status    on content_items(status);

-- TYPE-SPECIFIC METADATA ---------------------------------------------------
create table if not exists films (
  content_id  uuid primary key references content_items(id) on delete cascade,
  director    text,
  duration    int,             -- minutes
  language    text,
  embed_url   text,            -- vimeo / youtube / mux
  trailer_url text
);

create table if not exists articles (
  content_id  uuid primary key references content_items(id) on delete cascade,
  reading_time int,
  source       text,
  category     text             -- magazine | library | essay | interview
);

create table if not exists events (
  content_id  uuid primary key references content_items(id) on delete cascade,
  starts_at   timestamptz,
  ends_at     timestamptz,
  venue       text,
  city        text,
  country     text,
  ticket_url  text,
  capacity    int,
  is_online   boolean default false
);

create table if not exists songs (
  content_id  uuid primary key references content_items(id) on delete cascade,
  artist      text,
  album       text,
  duration    int,             -- seconds
  audio_url   text,
  spotify_url text
);

create table if not exists books (
  content_id  uuid primary key references content_items(id) on delete cascade,
  author      text,
  publisher   text,
  isbn        text,
  pages       int,
  read_url    text             -- library reader / pdf
);

-- MERCH (POD) --------------------------------------------------------------
-- Sustainable / ecological POD providers we connect via API.
-- Provider keys are stored in a separate secrets table (out of scope here).
create table if not exists pod_providers (
  id          serial primary key,
  slug        text unique not null,        -- teemill, printful_eco, stanley_stella, fairshare, ohh-deer
  name        text not null,
  eco_score   int default 0,               -- 0-100 internal sustainability rating
  cert        text[],                      -- GOTS, Fair Wear, B-Corp, Climate-Neutral, ...
  api_base    text,
  active      boolean default true
);

create table if not exists merch_products (
  content_id   uuid primary key references content_items(id) on delete cascade,
  provider_id  int references pod_providers(id),
  provider_sku text,
  price_cents  int,
  currency     text default 'EUR',
  inventory    int,
  variants     jsonb default '[]'::jsonb,  -- sizes, colors, ecoprint stock
  carbon_grams int                          -- per-item carbon estimate
);

-- AMBASSADORS / LOCAL EVENTS ----------------------------------------------
create table if not exists ambassadors (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid references profiles(id),
  city        text,
  country     text,
  status      text default 'pending'
              check (status in ('pending','approved','active','suspended')),
  pitch       text,
  reach       int default 0,
  approved_by uuid references profiles(id),
  created_at  timestamptz default now()
);

-- COMMUNITY ----------------------------------------------------------------
create table if not exists community_posts (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid references profiles(id),
  title       text,
  body        text,
  topic       text,
  media_url   text,
  likes       int default 0,
  created_at  timestamptz default now()
);

create table if not exists community_comments (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid references community_posts(id) on delete cascade,
  author_id   uuid references profiles(id),
  body        text,
  created_at  timestamptz default now()
);

-- MAILING LIST + PROMOTIONS ------------------------------------------------
create table if not exists mailing_list (
  id           uuid primary key default uuid_generate_v4(),
  email        text unique not null,
  name         text,
  consent      boolean default true,
  segments     text[],
  created_at   timestamptz default now()
);

create table if not exists campaigns (
  id          uuid primary key default uuid_generate_v4(),
  kind        text check (kind in ('newsletter','promo','crowdfund','event_push')),
  subject     text,
  body        text,
  audience    text,
  scheduled   timestamptz,
  sent_at     timestamptz,
  sent_count  int default 0,
  created_by  uuid references profiles(id),
  created_at  timestamptz default now()
);

-- CROWDFUNDING -------------------------------------------------------------
create table if not exists crowdfund_pledges (
  id            uuid primary key default uuid_generate_v4(),
  campaign_id   uuid references content_items(id),
  pledger_id    uuid references profiles(id),
  amount_cents  int not null,
  currency      text default 'EUR',
  reward_tier   text,
  created_at    timestamptz default now()
);

-- GRANTS TRACKER (publishers find / apply for grants) ---------------------
create table if not exists grants (
  id          uuid primary key default uuid_generate_v4(),
  funder      text not null,
  title       text,
  url         text,
  amount      text,
  deadline    date,
  region      text,
  themes      text[],
  status      text default 'open'
              check (status in ('open','watching','applying','submitted','won','lost')),
  notes       text,
  owner_id    uuid references profiles(id),
  created_at  timestamptz default now()
);

-- AI CHAT TRANSCRIPTS (model-agnostic) ------------------------------------
create table if not exists ai_conversations (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid references profiles(id),
  model       text,                  -- gemini-1.5-flash, qwen-3, deepseek-v3, claude, ...
  messages    jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

-- SITE SETTINGS (CMS / CSS control from backend) --------------------------
create table if not exists site_settings (
  key    text primary key,
  value  jsonb
);

insert into site_settings (key, value) values
  ('theme', '{"bg":"#0a0a0a","fg":"#f5f0e8","accent":"#FFD700","red":"#C8102E","green":"#007749","violet":"#8B00FF","teal":"#00FFE0"}'::jsonb),
  ('hero', '{"autoplay":true,"interval_ms":7000,"shuffle":true}'::jsonb),
  ('ai',   '{"provider":"gemini","model":"gemini-1.5-flash","fallbacks":["qwen-3","deepseek-v3","claude"]}'::jsonb)
on conflict (key) do nothing;

-- ROLE PERMISSIONS (informational, enforced in app + RLS) -----------------
-- admin     : all
-- publisher : content_items (CRUD), articles/films/events/songs/books, campaigns, grants, ambassadors approve
-- merch     : merch_products (CRUD), pod_providers (read), inventory
-- partner   : content_items (read+propose), community_posts (CRUD own)
-- consumer  : community_posts (CRUD own), mailing_list, ambassadors apply, crowdfund pledge
