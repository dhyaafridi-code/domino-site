
-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Rooms
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Tokio Room',
  style text NOT NULL DEFAULT 'all-fives' CHECK (style IN ('all-fives','block')),
  max_players int NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 4),
  winning_score int NOT NULL DEFAULT 150,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rooms readable by authenticated" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host can update room" ON public.rooms FOR UPDATE TO authenticated USING (host_id = auth.uid());
CREATE POLICY "Host can delete room" ON public.rooms FOR DELETE TO authenticated USING (host_id = auth.uid());

-- Room players
CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat int NOT NULL CHECK (seat BETWEEN 0 AND 3),
  is_ready boolean NOT NULL DEFAULT false,
  score int NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, seat)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_players TO authenticated;
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room players readable by authenticated" ON public.room_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join" ON public.room_players FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own row" ON public.room_players FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can leave" ON public.room_players FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Game state (public board info)
CREATE TABLE public.game_state (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  board jsonb NOT NULL DEFAULT '[]'::jsonb,
  left_end int,
  right_end int,
  turn_seat int NOT NULL DEFAULT 0,
  bone_yard_count int NOT NULL DEFAULT 0,
  hand_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_action jsonb,
  round_number int NOT NULL DEFAULT 1,
  passes_in_row int NOT NULL DEFAULT 0,
  winner_seat int,
  game_winner_user_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_state TO authenticated;
GRANT ALL ON public.game_state TO service_role;
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game state readable by authenticated" ON public.game_state FOR SELECT TO authenticated USING (true);

-- Player hands (private per-player)
CREATE TABLE public.player_hands (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat int NOT NULL,
  tiles jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
GRANT SELECT ON public.player_hands TO authenticated;
GRANT ALL ON public.player_hands TO service_role;
ALTER TABLE public.player_hands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players see own hand only" ON public.player_hands FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Bone yard (server-only)
CREATE TABLE public.bone_yards (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  tiles jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT ALL ON public.bone_yards TO service_role;
ALTER TABLE public.bone_yards ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  kind text NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','system')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages readable by authenticated" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users send own messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND kind = 'chat');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substring(NEW.id::text from 1 for 6))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_hands;
