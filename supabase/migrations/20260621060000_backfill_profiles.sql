-- Tokio Domino: backfill profiles for pre-existing accounts
--
-- handle_new_user() creates a profile on every NEW sign-up, but any account
-- that already existed before public.profiles was created on this project (or
-- was imported from another project) has no profile row. Those users now fail
-- the room_players_user_id_profiles_fkey / messages_user_id_profiles_fkey
-- constraints. This inserts the missing rows; ON CONFLICT keeps it idempotent.

INSERT INTO public.profiles (id, username, avatar_url)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'username'), ''),
           'Player' || substring(u.id::text from 1 for 6)),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
