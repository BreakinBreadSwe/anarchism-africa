-- Merch Studio session persistence. Each row is one saved design with its
-- full layer/bg/product/area state, owned by an email. Admin + publisher
-- roles see everyone's sessions; other roles see only their own.
--
-- Apply once via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" < db/migrations/2026-06-studio-sessions.sql

CREATE TABLE IF NOT EXISTS studio_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email  text NOT NULL,
  owner_role   text,                                -- snapshot at save time
  title        text NOT NULL DEFAULT 'Untitled session',
  product      text NOT NULL,                       -- tshirt | poster | mug | …
  area         text NOT NULL,                       -- front | back | full | …
  state        jsonb NOT NULL,                      -- { bg, bgImage, layers[] }
  thumbnail    text,                                -- data URL or blob URL preview
  status       text NOT NULL DEFAULT 'draft',       -- draft | finished | shipped
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_sessions_owner_idx
  ON studio_sessions(owner_email);
CREATE INDEX IF NOT EXISTS studio_sessions_updated_idx
  ON studio_sessions(updated_at DESC);
