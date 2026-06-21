import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { PlayerAvatar } from "./player-avatar";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  user_id: string;
  text: string;
  kind: string;
  created_at: string;
  profile?: { username: string; avatar_url: string | null };
}

export function ChatPanel({ roomId, className }: { roomId: string; className?: string }) {
  const { user } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*, profile:profiles(username, avatar_url)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (active && data) setMessages(data as any);
    }
    load();
    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const msg = payload.new as Message;
          const { data: p } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", msg.user_id)
            .maybeSingle();
          if (active) setMessages((prev) => [...prev, { ...msg, profile: p as any }]);
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!user || !text.trim() || sending) return;
    setSending(true);
    const trimmed = text.trim().slice(0, 500);
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ room_id: roomId, user_id: user.id, text: trimmed, kind: "chat" });
    setSending(false);
    if (error) console.error(error);
  }

  return (
    <div className={cn("flex flex-col tokio-glass rounded-2xl overflow-hidden", className)}>
      <div className="px-4 py-3 border-b border-border/50 font-display font-semibold text-sm">
        الدردشة
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">ابدأ المحادثة...</div>
        )}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={cn("flex gap-2 items-end", mine ? "flex-row-reverse" : "")}>
              <PlayerAvatar
                size="xs"
                username={m.profile?.username}
                avatarUrl={m.profile?.avatar_url}
              />
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-secondary-foreground rounded-bl-sm",
                )}
              >
                {!mine && (
                  <div className="text-[10px] font-semibold opacity-70 mb-0.5">
                    {m.profile?.username ?? "..."}
                  </div>
                )}
                <div className="break-words whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="p-2 border-t border-border/50 flex gap-2"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالة..."
          maxLength={500}
          className="bg-background/50"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || sending} className="shrink-0">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
