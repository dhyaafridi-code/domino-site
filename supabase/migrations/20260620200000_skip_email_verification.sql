-- Tokio Domino: skip email confirmation
--
-- This project intentionally does NOT require email confirmation. Users who
-- sign up are auto-signed-in and redirected to the lobby immediately. The
-- actual toggle lives in the Supabase dashboard:
--   Authentication → Sign In/Up → Confirm email → OFF
-- The block below is a defense-in-depth layer: on Supabase versions that
-- expose the `auth.config` table, it keeps the database in sync with that
-- dashboard setting. On versions that don't, the DO $$ block is a no-op and
-- the migration still succeeds.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'config'
  ) THEN
    UPDATE auth.config SET enable_confirmations = false;
  END IF;
END $$;
