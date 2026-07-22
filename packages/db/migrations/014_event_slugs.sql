-- 014: Human-readable event slugs for public URLs.
-- /check-in/annual-summer-beach-picnic instead of /check-in/<uuid>.
-- UUID URLs keep working (public routes resolve slug OR id), so QR codes
-- printed before this migration stay valid.

ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_key ON events (slug);

-- Backfill: slugify existing names; suffix duplicates with -2, -3, …
-- Events whose names produce an empty slug (e.g. emoji-only) stay NULL and
-- keep using their uuid in URLs.
WITH gen AS (
  SELECT id,
         trim(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) AS base,
         ROW_NUMBER() OVER (
           PARTITION BY trim(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
           ORDER BY created_at
         ) AS rn
  FROM events
  WHERE slug IS NULL
)
UPDATE events e
SET slug = CASE WHEN g.rn = 1 THEN g.base ELSE g.base || '-' || g.rn END
FROM gen g
WHERE e.id = g.id AND g.base <> '';
