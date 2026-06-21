-- Tokio Domino: enable PostgREST profile embedding
--
-- room_players.user_id and messages.user_id reference auth.users(id), and
-- profiles.id also references auth.users(id) — but there was no direct foreign
-- key from those tables to public.profiles. Without it PostgREST cannot resolve
-- `profile:profiles(...)` embeds and returns HTTP 400.
--
-- These extra FKs (alongside the existing auth.users ones) give PostgREST a
-- relationship to embed. user_id is nullable on room_players (bots), and a NULL
-- FK is simply not enforced, so bot rows are unaffected. Every human row's
-- user_id already has a matching profiles row (created by handle_new_user()).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'room_players_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.room_players
      ADD CONSTRAINT room_players_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
