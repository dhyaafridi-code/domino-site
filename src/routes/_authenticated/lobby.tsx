import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { createRoom, joinRoom } from "@/lib/tokio.functions";
import { Button } from "@/components/ui/button";
import { TokioLogo } from "@/components/tokio-logo";
import { PlayerAvatar } from "@/components/player-avatar";
import { DominoTile } from "@/components/domino-tile";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, LogOut, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/i18n/use-locale";

export const Route = createFileRoute("/_authenticated/lobby")({
  component: LobbyPage,
});

interface Room {
  id: string;
  name: string;
  style: string;
  max_players: number;
  status: string;
  host_id: string;
  is_public: boolean;
  created_at: string;
}

function styleLabel(style: string, t: (k: string) => string) {
  return style === "all-fives" ? t("room.styleAllFives") : t("room.styleBlock");
}

function LobbyPage() {
  const { user } = useSession();
  const profile = useProfile(user?.id);
  const navigate = useNavigate();
  const { t, formatNumber } = useLocale();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [style, setStyle] = useState<"all-fives" | "block">("all-fives");
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);
  const [creating, setCreating] = useState(false);
  const createFn = useServerFn(createRoom);
  const joinFn = useServerFn(joinRoom);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: rs } = await supabase
        .from("rooms")
        .select("*")
        .eq("is_public", true)
        .in("status", ["waiting", "playing"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (!active || !rs) return;
      setRooms(rs as Room[]);
      const ids = rs.map((r) => r.id);
      if (ids.length) {
        const { data: ps } = await supabase
          .from("room_players")
          .select("room_id")
          .in("room_id", ids);
        const c: Record<string, number> = {};
        ps?.forEach((p) => {
          c[p.room_id] = (c[p.room_id] ?? 0) + 1;
        });
        if (active) setCounts(c);
      }
    }
    load();
    const channel = supabase
      .channel("lobby")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players" }, () => load())
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await createFn({
        data: {
          style,
          maxPlayers,
          name: t("lobby.defaultRoomName", { name: profile?.username ?? "Tokio" }),
        },
      });
      navigate({ to: "/room/$id", params: { id: res.roomId } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(roomId: string) {
    try {
      await joinFn({ data: { roomId } });
      navigate({ to: "/room/$id", params: { id: roomId } });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/40 bg-background/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TokioLogo size={32} />
            <LanguageSwitcher className="h-9 px-2.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="gap-2">
                <PlayerAvatar
                  size="xs"
                  username={profile?.username}
                  avatarUrl={profile?.avatar_url}
                />
                <span className="hidden sm:inline font-medium">{profile?.username ?? "..."}</span>
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title={t("nav.logout")}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section className="tokio-glass rounded-3xl p-6 md:p-8">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-1">
            {t("lobby.createTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-5">{t("lobby.createSubtitle")}</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {t("lobby.style")}
              </label>
              <Select value={style} onValueChange={(v) => setStyle(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-fives">{t("lobby.styleAllFives")}</SelectItem>
                  <SelectItem value="block">{t("lobby.styleBlock")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {t("lobby.players")}
              </label>
              <Select
                value={String(maxPlayers)}
                onValueChange={(v) => setMaxPlayers(Number(v) as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">
                    {t("lobby.playersCount", { n: formatNumber(2), count: 2 })}
                  </SelectItem>
                  <SelectItem value="3">
                    {t("lobby.playersCount", { n: formatNumber(3), count: 3 })}
                  </SelectItem>
                  <SelectItem value="4">
                    {t("lobby.playersCount", { n: formatNumber(4), count: 4 })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="w-full h-10 font-display font-bold bg-gradient-to-r from-primary to-[oklch(0.65_0.2_30)] shadow-[var(--shadow-glow-primary)]"
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="size-4" />{" "}
                    {creating ? t("lobby.creating") : t("lobby.createButton")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl font-bold">{t("lobby.available")}</h2>
            <span className="text-sm text-muted-foreground">
              {t("lobby.roomsCount", { n: formatNumber(rooms.length), count: rooms.length })}
            </span>
          </div>
          {rooms.length === 0 ? (
            <Card className="p-12 text-center bg-card/40 border-dashed">
              <DominoTile
                values={[0, 0]}
                orientation="h"
                size="md"
                className="mx-auto opacity-40"
              />
              <p className="mt-4 text-muted-foreground">{t("lobby.noRooms")}</p>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((r) => {
                const full = (counts[r.id] ?? 0) >= r.max_players;
                const playing = r.status === "playing";
                return (
                  <Card
                    key={r.id}
                    className="p-5 tokio-glass hover:-translate-y-1 transition group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-display font-bold text-lg truncate max-w-[180px]">
                          {r.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {styleLabel(r.style, t)}
                        </div>
                      </div>
                      <div
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${playing ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"}`}
                      >
                        {playing ? t("lobby.playing") : t("lobby.waiting")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Users className="size-4" />
                      <span>
                        {formatNumber(counts[r.id] ?? 0)} / {formatNumber(r.max_players)}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleJoin(r.id)}
                      disabled={full || playing}
                      className="w-full"
                      variant={full || playing ? "secondary" : "default"}
                    >
                      {playing ? t("lobby.started") : full ? t("lobby.full") : t("lobby.join")}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
