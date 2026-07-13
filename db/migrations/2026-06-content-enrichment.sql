-- Adds columns for full article body, gallery images, and video embeds so
-- the enrichment cron (/api/cron/enrich-content) can persist deep-scrape
-- results. All nullable — existing rows survive.

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS body       text,
  ADD COLUMN IF NOT EXISTS gallery    jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS embeds     jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS content_enriched_idx
  ON content(enriched_at NULLS FIRST);
