import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import {
  placeTileAction,
  drawTileAction,
  passTurnAction,
  restartGame,
  leaveRoom,
} from "@/lib/tokio.functions";
import { Button } from "@/components/ui/button";
import { TokioLogo } from "@/components/tokio-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ChatPanel } from "@/components/chat-panel";
import { DominoTile } from "@/components/domino-tile";
import { PlayerSeat } from "@/components/player-seat";
import { Board2D } from "@/components/board2d/Board2D";
import { ArrowLeft, Trophy, RotateCcw, Hand, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { canPlay, type Tile, type BoardTile } from "@/lib/domino/engine";

export const Route = createFileRoute("/_authenticated/play/$id")({
  component: PlayPage,
});

interface RoomData {
  id: string;
  name: string;
  style: string;
  max_players: number;
  status: string;
  winning_score: number;
  host_id: string;
}
interface PlayerRow {
  id: string;
  user_id: string | null;
  seat: number;
  score: number;
  is_bot: boolean;
  bot_name: string | null;
  bot_avatar_url: string | null;
  profile?: { username: string; avatar_url: string | null };
}
interface GameStateRow {
  room_id: string;
  board: BoardTile[];
  left_end: number | null;
  right_end: number | null;
  turn_seat: number;
  bone_yard_count: number;
  hand_counts: Record<string, number>;
  last_action: any;
  round_number: number;
  winner_seat: number | null;
  game_winner_user_id: string | null;
  updated_at?: string;
}

function PlayPage() {
  const { id: roomId } = Route.useParams();
  const { user } = useSession();
  const profile = useProfile(user?.id);
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [state, setState] = useState<GameStateRow | null>(null);
  const [myHand, setMyHand] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Signature of the last game state we auto-acted on, so the blocked-turn
  // handler fires once per state and never spams the server.
  const autoActedRef = useRef<string>("");
  // Last game-state write we showed a "pass" cue for, so each Bloqué toast
  // fires at most once.
  const passCueRef = useRef<string>("");

  const placeFn = useServerFn(placeTileAction);
  const drawFn = useServerFn(drawTileAction);
  const passFn = useServerFn(passTurnAction);
  const restartFn = useServerFn(restartGame);
  const leaveFn = useServerFn(leaveRoom);

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: r }, { data: ps }, { data: st }, { data: hand }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase
          .from("room_players")
          .select(
            "id, user_id, seat, score, is_bot, bot_name, bot_avatar_url, profile:profiles(username, avatar_url)",
          )
          .eq("room_id", roomId)
          .order("seat"),
        supabase.from("game_state").select("*").eq("room_id", roomId).maybeSingle(),
        user
          ? supabase
              .from("player_hands")
              .select("tiles")
              .eq("room_id", roomId)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!active) return;
      setRoom(r as any);
      setPlayers((ps as any) ?? []);
      setState(st as any);
      setMyHand((hand?.tiles as Tile[]) ?? []);
    }
    load();
    const channel = supabase
      .channel(`play:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_state", filter: `room_id=eq.${roomId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_hands", filter: `room_id=eq.${roomId}` },
        load,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    if (room?.status === "waiting") navigate({ to: "/room/$id", params: { id: roomId } });
  }, [room?.status, roomId, navigate]);

  const me = players.find((p) => p.user_id === user?.id);
  const mySeat = me?.seat ?? -1;
  const isMyTurn = state?.turn_seat === mySeat;
  const canIPlay = state ? canPlay(myHand, state.left_end, state.right_end) : false;
  const finished = room?.status === "finished";
  const winner = finished
    ? players.find(
        (p) =>
          (state?.game_winner_user_id && p.user_id === state.game_winner_user_id) ||
          p.seat === state?.winner_seat,
      )
    : null;

  // Automated blocked / pass flow (Bloqué). When it's my turn and I hold no
  // legal move, resolve the turn automatically with no manual buttons: draw a
  // tile if the bone yard still has any, otherwise announce "blocked" and pass
  // the turn to the next player. A per-state signature guards against re-firing.
  useEffect(() => {
    if (!state || !isMyTurn || busy || finished) return;
    if (canIPlay) return;
    const sig = `${state.turn_seat}:${myHand.length}:${state.bone_yard_count}`;
    if (autoActedRef.current === sig) return;
    autoActedRef.current = sig;
    if (state.bone_yard_count > 0) {
      draw();
    } else {
      pass();
    }
    // draw/pass are stable function declarations within this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isMyTurn, busy, finished, canIPlay, myHand.length]);

  // Bloqué cue. Whenever the latest game-state write was a "pass" (a player or
  // bot with no legal move), flash a quick toast naming who was blocked. The
  // turn has already advanced automatically — this is purely the visual cue.
  useEffect(() => {
    const la = state?.last_action;
    const key = state?.updated_at ?? "";
    if (!la || la.type !== "pass" || !key) return;
    if (passCueRef.current === key) return;
    passCueRef.current = key;
    const p = players.find((x) => x.seat === la.seat);
    const nm = p ? (p.is_bot ? p.bot_name : p.profile?.username) : null;
    toast(`${nm ?? "لاعب"} · محظور (Bloqué)`, { duration: 1800 });
  }, [state?.updated_at, state?.last_action, players]);

  // Orient opponents: arrange around the board
  const opponents = useMemo(() => {
    if (!me || players.length === 0) return [];
    const ordered: PlayerRow[] = [];
    const seats = players.map((p) => p.seat).sort((a, b) => a - b);
    const myIdx = seats.indexOf(me.seat);
    for (let i = 1; i < seats.length; i++) {
      const s = seats[(myIdx + i) % seats.length];
      const p = players.find((x) => x.seat === s);
      if (p) ordered.push(p);
    }
    return ordered;
  }, [players, me]);

  // Place opponents around the table: bottom is always me. 1 opponent → top;
  // 2 → left + right; 3 → left + top + right (PlayDrift seating).
  const seatMap = useMemo(() => {
    const m: { top?: PlayerRow; left?: PlayerRow; right?: PlayerRow } = {};
    if (opponents.length === 1) {
      m.top = opponents[0];
    } else if (opponents.length === 2) {
      m.left = opponents[0];
      m.right = opponents[1];
    } else if (opponents.length >= 3) {
      m.left = opponents[0];
      m.top = opponents[1];
      m.right = opponents[2];
    }
    return m;
  }, [opponents]);

  // Place a specific hand tile on a side. Driven by the board's glowing 2D
  // dropzones via play() with the currently-selected tile.
  async function playIndex(index: number, side: "left" | "right") {
    if (busy || !state) return;
    const tile = myHand[index];
    if (!tile) return;
    setBusy(true);
    try {
      await placeFn({ data: { roomId, tile: tile as [number, number], side } });
      setSelected(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Dropzone callback: place the selected tile on the clicked side.
  function play(side: "left" | "right") {
    if (selected === null) return;
    playIndex(selected, side);
  }

  // Hand-tile click only *selects* the tile — it never auto-places. Selecting a
  // playable tile lights up the valid open end(s) as glowing dropzones on the
  // board; the player then clicks an end to place it there.
  function onTileClick(i: number) {
    setSelected((prev) => (prev === i ? null : i));
  }

  async function draw() {
    if (busy) return;
    setBusy(true);
    try {
      await drawFn({ data: { roomId } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function pass() {
    if (busy) return;
    setBusy(true);
    try {
      await passFn({ data: { roomId } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    try {
      await restartFn({ data: { roomId } });
      navigate({ to: "/room/$id", params: { id: roomId } });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function leave() {
    try {
      await leaveFn({ data: { roomId } });
      navigate({ to: "/lobby" });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (!room || !state) {
    return (
      <div className="grid place-items-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedTile = selected !== null ? myHand[selected] : null;
  const canPlayLeft =
    selectedTile && state.left_end !== null
      ? selectedTile[0] === state.left_end || selectedTile[1] === state.left_end
      : state.board.length === 0 && selected !== null;
  const canPlayRight =
    selectedTile && state.right_end !== null
      ? selectedTile[0] === state.right_end || selectedTile[1] === state.right_end
      : state.board.length === 0 && selected !== null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/40 bg-background/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/lobby">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="size-4 rotate-180" />
              </Button>
            </Link>
            <TokioLogo size={26} showWordmark={false} />
            <LanguageSwitcher className="h-9 px-2.5" />
            <div className="min-w-0">
              <div className="font-display font-bold text-sm truncate">{room.name}</div>
              <div className="text-[11px] text-muted-foreground">
                جولة {state.round_number} · {room.style === "all-fives" ? "All-Fives" : "Block"}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={leave} className="text-destructive text-xs">
            مغادرة
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 py-3 grid lg:grid-cols-[1fr_300px] gap-4 min-h-0">
        {/* Play table — opponents on the sides, me at the bottom, board centre */}
        <div
          className="grid gap-3 min-h-0"
          style={{
            gridTemplateColumns: "minmax(0,auto) minmax(0,1fr) minmax(0,auto)",
            gridTemplateRows: "auto minmax(300px,1fr) auto",
            gridTemplateAreas: '". top ." "left board right" "me me me"',
          }}
        >
          {/* Top opponent */}
          <div style={{ gridArea: "top" }} className="justify-self-center self-start">
            {seatMap.top && (
              <PlayerSeat
                orientation="h"
                name={seatMap.top.is_bot ? seatMap.top.bot_name : seatMap.top.profile?.username}
                avatarUrl={
                  seatMap.top.is_bot ? seatMap.top.bot_avatar_url : seatMap.top.profile?.avatar_url
                }
                tileCount={state.hand_counts?.[seatMap.top.seat] ?? 0}
                active={state.turn_seat === seatMap.top.seat}
                turnSeat={state.turn_seat}
              />
            )}
          </div>

          {/* Left opponent */}
          <div style={{ gridArea: "left" }} className="self-center">
            {seatMap.left && (
              <PlayerSeat
                orientation="v"
                name={seatMap.left.is_bot ? seatMap.left.bot_name : seatMap.left.profile?.username}
                avatarUrl={
                  seatMap.left.is_bot
                    ? seatMap.left.bot_avatar_url
                    : seatMap.left.profile?.avatar_url
                }
                tileCount={state.hand_counts?.[seatMap.left.seat] ?? 0}
                active={state.turn_seat === seatMap.left.seat}
                turnSeat={state.turn_seat}
              />
            )}
          </div>

          {/* Centre board — flat 2D table with overlays */}
          <div
            style={{ gridArea: "board" }}
            className="rounded-3xl min-h-[440px] relative overflow-hidden"
          >
            <Board2D
              board={state.board}
              leftEnd={state.left_end}
              rightEnd={state.right_end}
              selectedTile={selectedTile}
              isMyTurn={isMyTurn}
              canPlayLeft={!!canPlayLeft}
              canPlayRight={!!canPlayRight}
              onPlace={play}
            />

            {finished && winner ? (
              <div className="absolute inset-0 z-10 grid place-items-center bg-background/40 backdrop-blur-sm">
                <div className="text-center space-y-4">
                  <Trophy className="size-16 text-primary mx-auto drop-shadow-[0_0_20px_oklch(0.72_0.18_45/0.6)]" />
                  <h2 className="font-display text-3xl font-extrabold">
                    {winner.is_bot ? winner.bot_name : winner.profile?.username} فاز!
                  </h2>
                  {room.host_id === user?.id && (
                    <Button
                      onClick={restart}
                      className="bg-gradient-to-r from-primary to-[oklch(0.65_0.2_30)]"
                    >
                      <RotateCcw className="size-4" /> لعبة جديدة
                    </Button>
                  )}
                </div>
              </div>
            ) : state.board.length === 0 ? (
              <div className="absolute inset-x-0 bottom-4 text-center text-muted-foreground pointer-events-none z-10">
                <Hand className="size-9 mx-auto mb-2 opacity-50" />
                <div className="text-sm">
                  {isMyTurn ? "اختر حجراً وابدأ اللعبة" : "بانتظار اللاعب الأول..."}
                </div>
              </div>
            ) : null}

            <div className="absolute top-3 right-3 tokio-glass rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5 z-10 pointer-events-none">
              <span className="text-muted-foreground">البنك:</span>
              <span className="font-bold">{state.bone_yard_count}</span>
            </div>
          </div>

          {/* Right opponent */}
          <div style={{ gridArea: "right" }} className="self-center">
            {seatMap.right && (
              <PlayerSeat
                orientation="v"
                name={
                  seatMap.right.is_bot ? seatMap.right.bot_name : seatMap.right.profile?.username
                }
                avatarUrl={
                  seatMap.right.is_bot
                    ? seatMap.right.bot_avatar_url
                    : seatMap.right.profile?.avatar_url
                }
                tileCount={state.hand_counts?.[seatMap.right.seat] ?? 0}
                active={state.turn_seat === seatMap.right.seat}
                turnSeat={state.turn_seat}
              />
            )}
          </div>

          {/* Bottom — me and my hand */}
          <div style={{ gridArea: "me" }} className="space-y-2">
            {!finished && (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <PlayerSeat
                  orientation="h"
                  youLabel={profile?.username ?? "أنت"}
                  avatarUrl={profile?.avatar_url}
                  tileCount={myHand.length}
                  active={isMyTurn}
                  turnSeat={state.turn_seat}
                />
              </div>
            )}

            {!finished && (
              <div className="flex gap-1.5 justify-center flex-wrap py-2 tokio-glass rounded-2xl px-3 min-h-[84px] items-center">
                {myHand.length === 0 && (
                  <span className="text-xs text-muted-foreground">لا توجد أحجار</span>
                )}
                {myHand.map((t, i) => {
                  const playable =
                    isMyTurn &&
                    (state.board.length === 0 ||
                      t[0] === state.left_end ||
                      t[1] === state.left_end ||
                      t[0] === state.right_end ||
                      t[1] === state.right_end);
                  return (
                    <DominoTile
                      key={`${t[0]}-${t[1]}-${i}`}
                      values={t}
                      orientation="v"
                      size="sm"
                      selected={selected === i}
                      playable={playable}
                      onClick={() => onTileClick(i)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="lg:h-auto h-[300px]">
          <ChatPanel roomId={roomId} className="h-full" />
        </div>
      </main>
    </div>
  );
}
