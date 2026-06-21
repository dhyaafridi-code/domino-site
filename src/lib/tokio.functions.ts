// Server functions for Tokio rooms + game actions.
// All authenticated via Supabase auth middleware.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildDeck,
  shuffle,
  dealHandSize,
  startingSeat,
  placeTile as enginePlaceTile,
  chooseBotMove,
  handSum,
  nextSeat,
  canPlay,
  type Tile,
  type Style,
  type BoardTile,
} from "@/lib/domino/engine";

// Game/room mutations touch server-owned tables (game_state, bone_yards,
// player_hands) and flip rooms.status on behalf of non-host players, so they
// run with the service-role client which bypasses RLS. Identity and
// authorization are always enforced explicitly via context.userId below.
// The dynamic import keeps the service-role module out of the client bundle.
async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Guarantee a profiles row exists for the authenticated user before we insert
// anything that references it (room_players.user_id, messages.user_id both FK
// to profiles.id). The handle_new_user() trigger covers fresh sign-ups, but a
// session whose account predates the profiles table — or was created on another
// project — would otherwise hit a foreign-key violation. ON CONFLICT DO NOTHING
// makes this idempotent and never clobbers an existing username/avatar.
async function ensureProfile(supabase: any, userId: string, claims?: any) {
  const meta = (claims?.user_metadata ?? {}) as { username?: string; avatar_url?: string };
  const username = meta.username?.trim() || `Player${userId.slice(0, 6)}`;
  await supabase
    .from("profiles")
    .upsert(
      { id: userId, username, avatar_url: meta.avatar_url ?? null },
      { onConflict: "id", ignoreDuplicates: true },
    );
}

// -------- Rooms --------

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      name?: string;
      style?: Style;
      maxPlayers?: number;
      winningScore?: number;
      isPublic?: boolean;
    }) =>
      z
        .object({
          name: z.string().min(1).max(40).optional(),
          style: z.enum(["all-fives", "block"]).optional(),
          maxPlayers: z.number().int().min(2).max(4).optional(),
          winningScore: z.number().int().min(50).max(500).optional(),
          isPublic: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    await ensureProfile(supabase, userId, context.claims);
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        host_id: userId,
        name: data.name ?? "Tokio Room",
        style: data.style ?? "all-fives",
        max_players: data.maxPlayers ?? 2,
        winning_score: data.winningScore ?? 150,
        is_public: data.isPublic ?? true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { error: pErr } = await supabase.from("room_players").insert({
      room_id: room.id,
      user_id: userId,
      seat: 0,
      is_ready: false,
    });
    if (pErr) throw new Error(pErr.message);
    return { roomId: room.id as string };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    await ensureProfile(supabase, userId, context.claims);
    const { data: room, error } = await supabase
      .from("rooms")
      .select("id, max_players, status")
      .eq("id", data.roomId)
      .single();
    if (error || !room) throw new Error("Room not found");
    if (room.status !== "waiting") throw new Error("Game already started");

    const { data: existing } = await supabase
      .from("room_players")
      .select("seat, user_id")
      .eq("room_id", data.roomId)
      .order("seat", { ascending: true });

    if (existing?.some((p) => p.user_id === userId)) return { ok: true };
    if ((existing?.length ?? 0) >= room.max_players) throw new Error("Room full");

    const used = new Set(existing?.map((p) => p.seat) ?? []);
    let seat = 0;
    while (used.has(seat)) seat++;

    const { error: insErr } = await supabase.from("room_players").insert({
      room_id: data.roomId,
      user_id: userId,
      seat,
      is_ready: false,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

// One-shot invite entry: join the room (if not already in it), mark the caller
// ready, and start the match if that fills the room. Lets a friend who clicks
// an invite link drop straight into the lobby and play with no manual clicks.
export const joinViaInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    await ensureProfile(supabase, userId, context.claims);
    const { data: room } = await supabase
      .from("rooms")
      .select("id, max_players, status")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Room not found");

    const { data: existing } = await supabase
      .from("room_players")
      .select("id, seat, user_id")
      .eq("room_id", data.roomId)
      .order("seat", { ascending: true });
    const alreadyIn = existing?.some((p) => p.user_id === userId) ?? false;

    // Game already in progress: only existing players may (re)enter.
    if (room.status !== "waiting") {
      if (alreadyIn) return { ok: true, status: room.status as string };
      throw new Error("Game already started");
    }

    if (!alreadyIn) {
      if ((existing?.length ?? 0) >= room.max_players) throw new Error("Room full");
      const used = new Set(existing?.map((p) => p.seat) ?? []);
      let seat = 0;
      while (used.has(seat)) seat++;
      const { error: insErr } = await supabase.from("room_players").insert({
        room_id: data.roomId,
        user_id: userId,
        seat,
        is_ready: true,
      });
      if (insErr) throw new Error(insErr.message);
    } else {
      await supabase
        .from("room_players")
        .update({ is_ready: true })
        .eq("room_id", data.roomId)
        .eq("user_id", userId);
    }

    const started = await maybeStartGame(supabase, data.roomId);
    return { ok: true, status: started ? "playing" : "waiting" };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    const { data: room } = await supabase
      .from("rooms")
      .select("host_id")
      .eq("id", data.roomId)
      .maybeSingle();
    // Remove the leaving player first.
    await supabase.from("room_players").delete().eq("room_id", data.roomId).eq("user_id", userId);
    if (room && room.host_id === userId) {
      // The host left → tear the whole room down. The ON DELETE CASCADE foreign
      // keys clean up room_players, messages, game_state, player_hands and
      // bone_yards, so no empty room lingers in the lobby.
      await supabase.from("rooms").delete().eq("id", data.roomId);
    } else {
      // A guest left → only delete the room if no humans remain.
      await closeRoomIfEmpty(supabase, data.roomId);
    }
    return { ok: true };
  });

const BOT_NAMES = ["Tokio Bot", "Domino Pro", "Noura AI", "Samir Bot"];

export const addBotToRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    await addOneBot(supabase, data.roomId, userId);
    return { ok: true };
  });

export const fillRoomWithBots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    const { data: room } = await supabase
      .from("rooms")
      .select("max_players")
      .eq("id", data.roomId)
      .single();
    const { data: players } = await supabase
      .from("room_players")
      .select("id")
      .eq("room_id", data.roomId);
    const missing = Math.max(0, (room?.max_players ?? 0) - (players?.length ?? 0));
    for (let i = 0; i < missing; i++) {
      await addOneBot(supabase, data.roomId, userId);
    }
    return { ok: true, added: missing };
  });

export const removeBotFromRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string; botId?: string }) =>
    z.object({ roomId: z.string().uuid(), botId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    await assertRoomHost(supabase, data.roomId, userId);
    let botId = data.botId;
    if (!botId) {
      const { data: bot } = await supabase
        .from("room_players")
        .select("id")
        .eq("room_id", data.roomId)
        .eq("is_bot", true)
        .order("seat", { ascending: false })
        .limit(1)
        .maybeSingle();
      botId = bot?.id;
    }
    if (botId) {
      await supabase
        .from("room_players")
        .delete()
        .eq("room_id", data.roomId)
        .eq("id", botId)
        .eq("is_bot", true);
    }
    return { ok: true };
  });

async function assertRoomHost(supabase: any, roomId: string, userId: string) {
  const { data: room } = await supabase
    .from("rooms")
    .select("host_id, status")
    .eq("id", roomId)
    .single();
  if (!room) throw new Error("Room not found");
  if (room.host_id !== userId) throw new Error("Only host can manage bots");
  if (room.status !== "waiting") throw new Error("Game already started");
  return room;
}

async function addOneBot(supabase: any, roomId: string, userId: string) {
  const room = await assertRoomHost(supabase, roomId, userId);
  const { data: existing } = await supabase
    .from("room_players")
    .select("seat, is_bot")
    .eq("room_id", roomId)
    .order("seat");
  if ((existing?.length ?? 0) >= 4) throw new Error("Room full");

  const { data: fullRoom } = await supabase
    .from("rooms")
    .select("max_players")
    .eq("id", roomId)
    .single();
  if ((existing?.length ?? 0) >= fullRoom.max_players) throw new Error("Room full");

  const used = new Set(existing?.map((p: any) => p.seat) ?? []);
  let seat = 0;
  while (used.has(seat)) seat++;
  const botCount = existing?.filter((p: any) => p.is_bot).length ?? 0;
  const botName = BOT_NAMES[botCount % BOT_NAMES.length];

  const { error } = await supabase.from("room_players").insert({
    room_id: roomId,
    user_id: null,
    seat,
    is_ready: true,
    is_bot: true,
    bot_name: `${botName} ${botCount + 1}`,
  });
  if (error) throw new Error(error.message);
  return room;
}

async function closeRoomIfEmpty(supabase: any, roomId: string) {
  const { data: humans } = await supabase
    .from("room_players")
    .select("id")
    .eq("room_id", roomId)
    .eq("is_bot", false);
  if ((humans?.length ?? 0) === 0) {
    await supabase.from("rooms").delete().eq("id", roomId);
  }
}

export const setReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string; ready: boolean }) =>
    z.object({ roomId: z.string().uuid(), ready: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    await supabase
      .from("room_players")
      .update({ is_ready: data.ready })
      .eq("room_id", data.roomId)
      .eq("user_id", userId);
    await maybeStartGame(supabase, data.roomId);
    return { ok: true };
  });

// Starts the round when the room is full and every player (humans + bots) is
// ready. Safe to call repeatedly — it no-ops unless the room is still waiting
// and the start condition is met. Shared by setReady and the invite join flow.
async function maybeStartGame(supabase: any, roomId: string) {
  const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (!room || room.status !== "waiting") return false;
  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat");
  if (!players || players.length < 2) return false;
  if (players.length !== room.max_players || !players.every((p: any) => p.is_ready)) return false;

  await startRound(
    supabase,
    room.id,
    room.style as Style,
    players,
    1,
    players.map((p: any) => ({ seat: p.seat, score: 0 })),
  );
  await supabase.from("rooms").update({ status: "playing" }).eq("id", room.id);
  await processBotTurns(supabase, room.id);
  return true;
}

async function startRound(
  supabase: any,
  roomId: string,
  style: Style,
  players: Array<{ id: string; seat: number; user_id: string | null }>,
  roundNumber: number,
  carryScores: Array<{ seat: number; score: number }>,
) {
  const numPlayers = players.length;
  const handSize = dealHandSize(numPlayers);
  const deck = shuffle(buildDeck());
  const hands: Record<number, Tile[]> = {};
  let cursor = 0;
  for (const p of players) {
    hands[p.seat] = deck.slice(cursor, cursor + handSize) as Tile[];
    cursor += handSize;
  }
  const boneYard = deck.slice(cursor) as Tile[];

  const turnSeat = startingSeat(hands);
  const handCounts: Record<number, number> = {};
  for (const p of players) handCounts[p.seat] = hands[p.seat].length;
  const scoresMap: Record<number, number> = {};
  for (const s of carryScores) scoresMap[s.seat] = s.score;

  // Upsert game_state
  await supabase.from("game_state").upsert(
    {
      room_id: roomId,
      board: [],
      left_end: null,
      right_end: null,
      turn_seat: turnSeat,
      bone_yard_count: boneYard.length,
      hand_counts: handCounts,
      last_action: { type: "round_start", round: roundNumber },
      round_number: roundNumber,
      passes_in_row: 0,
      winner_seat: null,
      game_winner_user_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id" },
  );

  // Bone yard
  await supabase.from("bone_yards").upsert({ room_id: roomId, tiles: boneYard });

  // Player hands - delete old, insert new
  await supabase.from("player_hands").delete().eq("room_id", roomId);
  for (const p of players) {
    await supabase.from("player_hands").insert({
      room_id: roomId,
      user_id: p.user_id,
      room_player_id: p.id,
      seat: p.seat,
      tiles: hands[p.seat],
    });
  }

  // Reset round scores on room_players to keep cumulative
  for (const s of carryScores) {
    await supabase
      .from("room_players")
      .update({ score: s.score })
      .eq("room_id", roomId)
      .eq("seat", s.seat);
  }
}

// -------- Game actions --------

export const placeTileAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string; tile: [number, number]; side: "left" | "right" }) =>
    z
      .object({
        roomId: z.string().uuid(),
        tile: z.tuple([z.number().int().min(0).max(6), z.number().int().min(0).max(6)]),
        side: z.enum(["left", "right"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    return await runGameStep(supabase, userId, data.roomId, async (ctx) => {
      const { hand, state, room, mySeat } = ctx;
      if (state.turn_seat !== mySeat) throw new Error("Not your turn");
      const idx = hand.findIndex(
        (t) =>
          (t[0] === data.tile[0] && t[1] === data.tile[1]) ||
          (t[0] === data.tile[1] && t[1] === data.tile[0]),
      );
      if (idx < 0) throw new Error("Tile not in hand");
      const result = enginePlaceTile(
        {
          board: state.board as BoardTile[],
          leftEnd: state.left_end,
          rightEnd: state.right_end,
          style: room.style as Style,
        },
        data.tile,
        data.side,
      );
      if (!result) throw new Error("Illegal move");
      const newHand = hand.filter((_, i) => i !== idx);
      return {
        newBoard: result.newBoard,
        newLeft: result.newLeft,
        newRight: result.newRight,
        newHand,
        scored: result.scored,
        action: {
          type: "place",
          seat: mySeat,
          tile: data.tile,
          side: data.side,
          scored: result.scored,
        },
        resetPasses: true,
      };
    });
  });

export const drawTileAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    return await runGameStep(supabase, userId, data.roomId, async (ctx) => {
      const { hand, state, mySeat } = ctx;
      if (state.turn_seat !== mySeat) throw new Error("Not your turn");
      const { data: by } = await supabase
        .from("bone_yards")
        .select("tiles")
        .eq("room_id", data.roomId)
        .single();
      const boneYard = (by?.tiles ?? []) as Tile[];
      if (boneYard.length === 0) throw new Error("Bone yard is empty");
      const drawn = boneYard[0];
      const newBoneYard = boneYard.slice(1);
      await supabase.from("bone_yards").update({ tiles: newBoneYard }).eq("room_id", data.roomId);
      const newHand = [...hand, drawn];
      return {
        newHand,
        boneYardDelta: -1,
        action: { type: "draw", seat: mySeat },
        keepTurn: true,
      };
    });
  });

export const passTurnAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    return await runGameStep(supabase, userId, data.roomId, async (ctx) => {
      const { state, mySeat } = ctx;
      if (state.turn_seat !== mySeat) throw new Error("Not your turn");
      return {
        action: { type: "pass", seat: mySeat },
        incrementPasses: true,
      };
    });
  });

interface GameStepCtx {
  hand: Tile[];
  state: any;
  room: any;
  mySeat: number;
  players: Array<{
    id: string;
    seat: number;
    user_id: string | null;
    score: number;
    is_bot: boolean;
  }>;
}

interface GameStepResult {
  newBoard?: BoardTile[];
  newLeft?: number;
  newRight?: number;
  newHand?: Tile[];
  scored?: number;
  action: any;
  resetPasses?: boolean;
  keepTurn?: boolean;
  incrementPasses?: boolean;
  boneYardDelta?: number;
}

async function runGameStep(
  supabase: any,
  userId: string,
  roomId: string,
  step: (ctx: GameStepCtx) => Promise<GameStepResult>,
) {
  const { data: players } = await supabase
    .from("room_players")
    .select("id, seat, user_id, score, is_bot")
    .eq("room_id", roomId)
    .order("seat");
  if (!players) throw new Error("No players");
  const me = players.find((p: any) => p.user_id === userId);
  if (!me) throw new Error("Not in this room");
  return await runGameStepForPlayer(supabase, roomId, me, step, true);
}

async function runGameStepForPlayer(
  supabase: any,
  roomId: string,
  me: { id: string; seat: number; user_id: string | null; score: number; is_bot: boolean },
  step: (ctx: GameStepCtx) => Promise<GameStepResult>,
  processBotsAfter: boolean,
) {
  const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (!room || room.status !== "playing") throw new Error("Game not active");
  const { data: state } = await supabase
    .from("game_state")
    .select("*")
    .eq("room_id", roomId)
    .single();
  if (!state) throw new Error("No game state");
  const { data: players } = await supabase
    .from("room_players")
    .select("id, seat, user_id, score, is_bot")
    .eq("room_id", roomId)
    .order("seat");
  if (!players) throw new Error("No players");

  const { data: handRow } = await supabase
    .from("player_hands")
    .select("tiles")
    .eq("room_id", roomId)
    .eq("seat", me.seat)
    .single();
  const hand = (handRow?.tiles ?? []) as Tile[];

  const result = await step({ hand, state, room, mySeat: me.seat, players });

  // Apply updates
  if (result.newHand) {
    await supabase
      .from("player_hands")
      .update({ tiles: result.newHand, updated_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("seat", me.seat);
  }

  const seats = players.map((p: any) => p.seat);
  const updatedHandCounts: Record<number, number> = { ...(state.hand_counts || {}) };
  if (result.newHand) updatedHandCounts[me.seat] = result.newHand.length;

  let newScore = me.score;
  if (result.scored && result.scored > 0) {
    newScore = me.score + result.scored;
    await supabase
      .from("room_players")
      .update({ score: newScore })
      .eq("room_id", roomId)
      .eq("seat", me.seat);
  }

  // Round end?
  const handEmpty = result.newHand && result.newHand.length === 0;
  let roundOver = handEmpty;
  let passesInRow = state.passes_in_row || 0;
  if (result.resetPasses) passesInRow = 0;
  if (result.incrementPasses) passesInRow += 1;
  const blockedAll = passesInRow >= seats.length;
  if (blockedAll) roundOver = true;

  let winnerSeat: number | null = null;
  let nextTurn = state.turn_seat;
  if (!result.keepTurn) nextTurn = nextSeat(state.turn_seat, seats);

  let updatedScores = players.map((p: any) => ({
    seat: p.seat,
    score: p.seat === me.seat ? newScore : p.score,
  }));

  if (roundOver) {
    // Determine round winner: empty hand wins; else lowest pip count
    if (handEmpty) {
      winnerSeat = me.seat;
    } else {
      // Get all hands
      const { data: allHands } = await supabase
        .from("player_hands")
        .select("seat, tiles")
        .eq("room_id", roomId);
      let bestSeat = seats[0];
      let bestSum = Infinity;
      for (const h of allHands ?? []) {
        const s = handSum((h.tiles as Tile[]) ?? []);
        if (s < bestSum) {
          bestSum = s;
          bestSeat = h.seat;
        }
      }
      winnerSeat = bestSeat;
    }
    // Sum opponents' pips → winner gets them (rounded to nearest 5 in all-fives)
    const { data: allHands2 } = await supabase
      .from("player_hands")
      .select("seat, tiles")
      .eq("room_id", roomId);
    let opponentPips = 0;
    for (const h of allHands2 ?? []) {
      if (h.seat !== winnerSeat) opponentPips += handSum((h.tiles as Tile[]) ?? []);
    }
    let roundPoints = opponentPips;
    if (room.style === "all-fives") {
      roundPoints = Math.round(opponentPips / 5) * 5;
    }
    updatedScores = updatedScores.map((s: { seat: number; score: number }) =>
      s.seat === winnerSeat ? { ...s, score: s.score + roundPoints } : s,
    );
    const winnerPlayer = players.find((p: any) => p.seat === winnerSeat)!;
    await supabase
      .from("room_players")
      .update({
        score: updatedScores.find((s: { seat: number; score: number }) => s.seat === winnerSeat)!
          .score,
      })
      .eq("room_id", roomId)
      .eq("seat", winnerPlayer.seat);
  }

  const gameOverScore = updatedScores.find(
    (s: { seat: number; score: number }) => s.score >= room.winning_score,
  );
  const gameOver = !!gameOverScore;

  await supabase
    .from("game_state")
    .update({
      board: result.newBoard ?? state.board,
      left_end: result.newLeft ?? state.left_end,
      right_end: result.newRight ?? state.right_end,
      turn_seat: roundOver ? state.turn_seat : nextTurn,
      bone_yard_count: state.bone_yard_count + (result.boneYardDelta ?? 0),
      hand_counts: updatedHandCounts,
      last_action: result.action,
      passes_in_row: roundOver ? 0 : passesInRow,
      winner_seat: roundOver ? winnerSeat : null,
      game_winner_user_id: gameOver
        ? players.find((p: any) => p.seat === gameOverScore!.seat)?.user_id
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId);

  if (gameOver) {
    await supabase.from("rooms").update({ status: "finished" }).eq("id", roomId);
    // Reset ready flags
    await supabase.from("room_players").update({ is_ready: false }).eq("room_id", roomId);
  } else if (roundOver) {
    // Start new round after short delay - we do it immediately here
    const carry = updatedScores;
    await startRound(
      supabase,
      roomId,
      room.style as Style,
      players,
      (state.round_number || 1) + 1,
      carry,
    );
  }

  if (processBotsAfter && !gameOver) {
    await processBotTurns(supabase, roomId);
  }

  return { ok: true };
}

async function processBotTurns(supabase: any, roomId: string) {
  for (let i = 0; i < 24; i++) {
    const { data: room } = await supabase.from("rooms").select("status").eq("id", roomId).single();
    if (room?.status !== "playing") return;

    const { data: state } = await supabase
      .from("game_state")
      .select("turn_seat")
      .eq("room_id", roomId)
      .single();
    if (!state) return;

    const { data: bot } = await supabase
      .from("room_players")
      .select("id, seat, user_id, score, is_bot")
      .eq("room_id", roomId)
      .eq("seat", state.turn_seat)
      .eq("is_bot", true)
      .maybeSingle();
    if (!bot) return;

    await runGameStepForPlayer(
      supabase,
      roomId,
      bot,
      async ({ hand, state, room, mySeat }) => {
        // Analyse every legal placement and pick the strongest one.
        const move = chooseBotMove(hand, {
          board: state.board as BoardTile[],
          leftEnd: state.left_end,
          rightEnd: state.right_end,
          style: room.style as Style,
        });
        if (move) {
          const idx = hand.findIndex(
            (h) =>
              (h[0] === move.tile[0] && h[1] === move.tile[1]) ||
              (h[0] === move.tile[1] && h[1] === move.tile[0]),
          );
          return {
            newBoard: move.result.newBoard,
            newLeft: move.result.newLeft,
            newRight: move.result.newRight,
            newHand: hand.filter((_, i) => i !== idx),
            scored: move.result.scored,
            action: {
              type: "place",
              seat: mySeat,
              tile: move.tile,
              side: move.side,
              scored: move.result.scored,
            },
            resetPasses: true,
          };
        }

        if (!canPlay(hand, state.left_end, state.right_end) && state.bone_yard_count > 0) {
          const { data: by } = await supabase
            .from("bone_yards")
            .select("tiles")
            .eq("room_id", roomId)
            .single();
          const boneYard = (by?.tiles ?? []) as Tile[];
          const drawn = boneYard[0];
          await supabase
            .from("bone_yards")
            .update({ tiles: boneYard.slice(1) })
            .eq("room_id", roomId);
          return {
            newHand: drawn ? [...hand, drawn] : hand,
            boneYardDelta: drawn ? -1 : 0,
            action: { type: "draw", seat: mySeat },
            keepTurn: true,
          };
        }

        return {
          action: { type: "pass", seat: mySeat },
          incrementPasses: true,
        };
      },
      false,
    );
  }
}

export const restartGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = await getAdmin();
    const { data: room } = await supabase.from("rooms").select("*").eq("id", data.roomId).single();
    if (!room) throw new Error("Room not found");
    if (room.host_id !== userId) throw new Error("Only host can restart");
    await supabase.from("rooms").update({ status: "waiting" }).eq("id", data.roomId);
    await supabase
      .from("room_players")
      .update({ is_ready: false, score: 0 })
      .eq("room_id", data.roomId);
    return { ok: true };
  });
