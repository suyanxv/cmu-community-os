-- Optional emoji per event for visual differentiation in the list.

ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_emoji TEXT;
