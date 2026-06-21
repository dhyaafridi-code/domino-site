// A player's seat box for the play table. When it's this seat's turn, an orange
// progress line shrinks around the box border over 30 seconds (PlayDrift style).
// The box shows only the avatar, the username, and the face-down tile-count
// chips — no scores or points, for an extremely clean look.
// Used on all four sides — orientation "h" for top/bottom, "v" for left/right.
import { useEffect, useState } from "react";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";

export const SEAT_TURN_MS = 30000;

// SVG ring that depletes clockwise. Restarts whenever `turnSeat` changes so the
// active player always gets a fresh 30s. preserveAspectRatio="none" stretches a
// 100×100 viewBox to the box; non-scaling-stroke keeps the line crisp.
function SeatBorderTimer({ turnSeat }: { turnSeat: number }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const remaining = Math.max(0, 100 - ((now - start) / SEAT_TURN_MS) * 100);
      setPct(remaining);
      if (remaining > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [turnSeat]);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full pointer-events-none z-20 overflow-visible"
    >
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="9"
        ry="9"
        fill="none"
        stroke="#f59e0b"
        strokeWidth={3.5}
        vectorEffect="non-scaling-stroke"
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100 - pct}
        style={{ filter: "drop-shadow(0 0 4px rgba(245,158,11,0.6))" }}
      />
    </svg>
  );
}

// Small stack of face-down chips representing how many tiles the seat holds.
function HandChips({ count, vertical }: { count: number; vertical: boolean }) {
  const shown = Math.min(count, 7);
  return (
    <div
      className={cn(
        "flex gap-0.5 flex-wrap justify-center",
        vertical ? "flex-col items-center" : "items-center",
      )}
    >
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          className="rounded-[3px] bg-gradient-to-br from-[oklch(0.42_0.18_270)] to-[oklch(0.28_0.12_280)] border border-[oklch(0.55_0.22_280)]/40"
          style={vertical ? { width: 20, height: 9 } : { width: 9, height: 20 }}
        />
      ))}
      {count > 7 && <span className="text-[10px] text-muted-foreground">+{count - 7}</span>}
    </div>
  );
}

export interface PlayerSeatProps {
  name?: string | null;
  avatarUrl?: string | null;
  tileCount: number;
  active: boolean;
  turnSeat: number;
  orientation?: "h" | "v";
  youLabel?: string; // shown instead of name when this is the local player
  className?: string;
}

export function PlayerSeat({
  name,
  avatarUrl,
  tileCount,
  active,
  turnSeat,
  orientation = "h",
  youLabel,
  className,
}: PlayerSeatProps) {
  const vertical = orientation === "v";
  return (
    <div
      className={cn(
        "relative tokio-glass rounded-xl p-2.5 flex gap-2 items-center transition-shadow",
        vertical ? "flex-col w-[104px] text-center" : "flex-row min-w-[150px]",
        active && "shadow-[0_0_22px_-6px_rgba(245,158,11,0.7)]",
        className,
      )}
    >
      {active && <SeatBorderTimer turnSeat={turnSeat} />}
      <PlayerAvatar size="sm" username={name} avatarUrl={avatarUrl} />
      <div className={cn("min-w-0", vertical ? "" : "text-start")}>
        <div className="font-semibold text-xs truncate max-w-[110px]">
          {youLabel ?? name ?? "..."}
        </div>
        <div className="mt-1">
          <HandChips count={tileCount} vertical={vertical} />
        </div>
      </div>
    </div>
  );
}
