import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import {
  addBotToRoom,
  fillRoomWithBots,
  joinViaInvite,
  leaveRoom,
  removeBotFromRoom,
  setReady,
} from "@/lib/tokio.functions";
import { Button } from "@/components/ui/button";
import { TokioLogo } from "@/components/tokio-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PlayerAvatar } from "@/components/player-avatar";
import { ChatPanel } from "@/components/chat-panel";
import { ArrowLeft, Bot, BotOff, Check, Copy, LogOut, UserPlus, Users, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/i18n/use-locale";

export const Route = createFileRoute("/_authenticated/room/$id")({
  // `?invite=1` marks an arrival from a shared invite link: the visitor is
  // auto-joined and auto-readied so the match can start without manual clicks.
  validateSearch: (search: Record<string, unknown>): { invite?: boolean } => ({
    invite: search.invite === "1" || search.invite === true ? true : undefined,
  }),
  component: RoomPage,
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
  is_ready: boolean;
  is_bot: boolean;
  bot_name: string | null;
  bot_avatar_url: string | null;
  score: number;
  profile?: { username: string; avatar_url: string | null };
}

function RoomPage() {
  const { id: roomId } = Route.useParams();
  const { invite } = Route.useSearch();
  const { user } = useSession();
  const profile = useProfile(user?.id);
  const navigate = useNavigate();
  const { t } = useLocale();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const autoJoinRef = useRef(false);
  const readyFn = useServerFn(setReady);
  const leaveFn = useServerFn(leaveRoom);
  const addBotFn = useServerFn(addBotToRoom);
  const fillBotsFn = useServerFn(fillRoomWithBots);
  const removeBotFn = useServerFn(removeBotFromRoom);
  const inviteFn = useServerFn(joinViaInvite);

  // Authoritative refetch of room + seats. Called on mount, on every realtime
  // change, AND directly after each local mutation so the UI updates even if a
  // realtime event is delayed or never arrives (publication/RLS hiccups).
  const reload = useCallback(async () => {
    const { data: r } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    setRoom(r as RoomData | null);
    const { data: ps } = await supabase
      .from("room_players")
      .select(
        "id, user_id, seat, is_ready, is_bot, bot_name, bot_avatar_url, score, profile:profiles(username, avatar_url)",
      )
      .eq("room_id", roomId)
      .order("seat");
    // Cast through unknown: the generated Supabase types don't yet model the
    // room_players → profiles FK, so the embed is typed as an error union.
    if (ps) setPlayers(ps as unknown as PlayerRow[]);
  }, [roomId]);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        () => reload(),
      )
      .subscribe((status) => {
        // Surface a misconfigured realtime stream instead of failing silently.
        // The lobby still works because mutations call reload() directly.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[room ${roomId}] realtime channel status: ${status}`);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, reload]);

  useEffect(() => {
    if (room?.status === "playing") navigate({ to: "/play/$id", params: { id: roomId } });
  }, [room?.status, roomId, navigate]);

  // Invite-link arrival: join the room and mark ready in a single call. If that
  // fills the room the match starts immediately and we jump into the game.
  useEffect(() => {
    if (!invite || !user || !room || autoJoinRef.current) return;
    if (room.status !== "waiting") return;
    autoJoinRef.current = true;
    (async () => {
      try {
        const res = await inviteFn({ data: { roomId } });
        if (res?.status === "playing") {
          navigate({ to: "/play/$id", params: { id: roomId } });
        }
      } catch (e: any) {
        autoJoinRef.current = false;
        toast.error(e.message);
      }
    })();
  }, [invite, user, room, roomId, inviteFn, navigate]);

  const me = players.find((p) => p.user_id === user?.id);
  const isHost = room?.host_id === user?.id;
  const botCount = players.filter((p) => p.is_bot).length;
  const roomIsFull = room ? players.length >= room.max_players : true;

  async function toggleReady() {
    if (!me) return;
    try {
      await readyFn({ data: { roomId, ready: !me.is_ready } });
      await reload();
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

  async function addBot() {
    try {
      await addBotFn({ data: { roomId } });
      await reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function fillBots() {
    try {
      const res = await fillBotsFn({ data: { roomId } });
      await reload();
      // Only celebrate when bots were actually seated; otherwise the room was
      // already full and the green toast was misleading.
      if ((res?.added ?? 0) > 0) toast.success(t("room.botsAdded"));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function removeBot() {
    try {
      await removeBotFn({ data: { roomId } });
      await reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/room/${roomId}?invite=1` : "";

  // Copy the link and, for the host, flip themselves to ready. That way the
  // moment an invited friend joins (auto-ready) the room is all-ready and the
  // match kicks off instantly — no further clicks from either side.
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success(t("room.inviteCopied"));
    } catch {
      toast.error(t("room.inviteCopyFailed"));
    }
    if (isHost && me && !me.is_ready) {
      try {
        await readyFn({ data: { roomId, ready: true } });
      } catch {
        /* non-fatal: host can still press ready manually */
      }
    }
  }

  if (!room) {
    return (
      <div className="grid place-items-center min-h-screen text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/40 bg-background/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/lobby">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="size-4 rotate-180" />
              </Button>
            </Link>
            <TokioLogo size={28} showWordmark={false} />
            <LanguageSwitcher className="h-9 px-2.5" />
            <div>
              <div className="font-display font-bold text-sm">{room.name}</div>
              <div className="text-xs text-muted-foreground">
                {room.style === "all-fives" ? "All-Fives" : "Block"} · {room.winning_score} نقطة
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={leave} className="gap-1.5 text-destructive">
            <LogOut className="size-4" /> مغادرة
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex-1 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="tokio-glass rounded-3xl p-6 md:p-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-4 py-1.5 text-xs font-semibold text-primary mb-3">
              <Users className="size-3.5" /> {players.length} من {room.max_players} لاعبين
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold">
              {players.length === room.max_players ? "الجميع جاهز؟" : "بانتظار اللاعبين..."}
            </h1>
            <p className="text-muted-foreground mt-2">شارك الرابط لدعوة أصدقائك</p>
            {isHost && (
              <div className="mt-5 grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                <Button
                  type="button"
                  onClick={fillBots}
                  disabled={roomIsFull}
                  className="font-display font-bold bg-gradient-to-r from-primary to-[oklch(0.65_0.2_30)]"
                >
                  <Bot className="size-4" /> {t("room.playWithBots")}
                </Button>
                <Button type="button" variant="outline" className="font-display font-semibold">
                  <Users className="size-4" /> {t("room.waitFriends")}
                </Button>
                <Button type="button" onClick={addBot} disabled={roomIsFull} variant="secondary">
                  <UserPlus className="size-4" /> {t("room.addBot")}
                </Button>
                <Button
                  type="button"
                  onClick={removeBot}
                  disabled={botCount === 0}
                  variant="secondary"
                >
                  <BotOff className="size-4" /> {t("room.removeBot")}
                </Button>
              </div>
            )}
            <div className="mt-5 flex gap-2 max-w-md mx-auto">
              <input
                readOnly
                value={inviteUrl}
                dir="ltr"
                className="flex-1 px-3 py-2 rounded-md bg-background/50 border border-border text-sm font-mono truncate"
              />
              <Button variant="outline" onClick={copyInvite}>
                <Copy className="size-4" />
              </Button>
            </div>
            {me && (
              <Button
                onClick={toggleReady}
                disabled={players.length < 2}
                className={`mt-6 h-12 px-10 font-display font-bold text-base ${me.is_ready ? "bg-success" : "bg-gradient-to-r from-primary to-[oklch(0.65_0.2_30)] shadow-[var(--shadow-glow-primary)]"}`}
              >
                {me.is_ready ? (
                  <>
                    <Check className="size-5" /> جاهز
                  </>
                ) : (
                  "أنا جاهز"
                )}
              </Button>
            )}
          </section>

          <section>
            <h2 className="font-display font-bold mb-3">اللاعبون</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: room.max_players }).map((_, seat) => {
                const p = players.find((x) => x.seat === seat);
                const displayName = p?.is_bot ? p.bot_name : p?.profile?.username;
                const avatarUrl = p?.is_bot ? p.bot_avatar_url : p?.profile?.avatar_url;
                return (
                  <div
                    key={seat}
                    className={`tokio-glass rounded-2xl p-4 text-center relative ${p?.is_ready ? "ring-2 ring-success/60" : ""}`}
                  >
                    {p ? (
                      <>
                        <PlayerAvatar
                          size="md"
                          username={displayName}
                          avatarUrl={avatarUrl}
                          className="mx-auto"
                        />
                        <div className="font-semibold truncate mt-2 text-sm">
                          {displayName ?? "..."}
                        </div>
                        {room.host_id === p.user_id && (
                          <div className="text-[10px] text-primary mt-0.5">المضيف</div>
                        )}
                        {p.is_bot && (
                          <div className="text-[10px] text-accent mt-0.5">{t("room.bot")}</div>
                        )}
                        {p.is_ready && (
                          <div className="absolute top-2 left-2 size-6 grid place-items-center rounded-full bg-success text-white">
                            <Check className="size-3.5" />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="size-12 rounded-full bg-muted/30 mx-auto grid place-items-center">
                          <Users className="size-5 text-muted-foreground" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">المقعد فارغ</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {isHost && (
            <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <Trophy className="size-3.5" /> اللعبة تبدأ تلقائياً عندما يكون كل اللاعبين جاهزين
            </div>
          )}
        </div>

        <div className="lg:h-[600px] h-[400px]">
          <ChatPanel roomId={roomId} className="h-full" />
        </div>
      </main>
    </div>
  );
}
