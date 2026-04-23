-- Public share token for read-only calendar sharing. Any user with the URL
-- can view the org's published events without logging in. Admins generate
-- the token from Settings and can rotate (invalidates old links) or disable.
--
-- Null token = sharing disabled, which is the default for all existing orgs.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS public_share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_organizations_public_share_token
  ON organizations (public_share_token)
  WHERE public_share_token IS NOT NULL;
