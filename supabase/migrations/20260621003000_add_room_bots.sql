ALTER TABLE public.room_players
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN is_bot boolean NOT NULL DEFAULT false,
  ADD COLUMN bot_name text,
  ADD COLUMN bot_avatar_url text,
  ADD CONSTRAINT room_players_human_or_bot CHECK (
    (is_bot = false AND user_id IS NOT NULL) OR
    (is_bot = true AND user_id IS NULL AND bot_name IS NOT NULL)
  );

ALTER TABLE public.player_hands
  DROP CONSTRAINT player_hands_pkey,
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN room_player_id uuid REFERENCES public.room_players(id) ON DELETE CASCADE,
  ADD CONSTRAINT player_hands_human_or_bot CHECK (
    (user_id IS NOT NULL) OR (room_player_id IS NOT NULL)
  ),
  ADD PRIMARY KEY (room_id, seat);

CREATE INDEX room_players_room_humans_idx ON public.room_players(room_id) WHERE is_bot = false;

CREATE POLICY "Hosts can add bot players"
ON public.room_players
FOR INSERT
TO authenticated
WITH CHECK (
  is_bot = true
  AND user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = room_players.room_id
      AND rooms.host_id = auth.uid()
      AND rooms.status = 'waiting'
  )
);

CREATE POLICY "Hosts can remove bot players"
ON public.room_players
FOR DELETE
TO authenticated
USING (
  is_bot = true
  AND EXISTS (
    SELECT 1 FROM public.rooms
    WHERE rooms.id = room_players.room_id
      AND rooms.host_id = auth.uid()
  )
);
