-- Tokio Domino: auto-confirm every account (no email verification)
--
-- The project's "Confirm email" toggle is disabled declaratively in
-- supabase/config.toml. This migration is the database-level safety net: a
-- BEFORE INSERT trigger on auth.users stamps email_confirmed_at so that any
-- account created while the dashboard flag is still propagating is immediately
-- usable — users can sign in without ever clicking a confirmation link.
--
-- It also back-fills any existing unconfirmed users.

CREATE OR REPLACE FUNCTION auth.tokio_auto_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tokio_auto_confirm_users ON auth.users;
CREATE TRIGGER tokio_auto_confirm_users
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION auth.tokio_auto_confirm();

-- Back-fill existing accounts that never confirmed.
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;
