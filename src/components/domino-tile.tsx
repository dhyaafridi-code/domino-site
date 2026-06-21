import { cn } from "@/lib/utils";

type Pip = { cx: number; cy: number };

// Pip positions on a padded 0..100 half-face grid. Columns sit at 24/76 and
// rows at 22/50/78 (six uses 18/50/82) — generous inner padding so that with the
// pip radius below, 4/5/6 stay distinctly separated and never bleed together or
// off the edge.
const PIP_MAP: Record<number, Pip[]> = {
  0: [],
  1: [{ cx: 50, cy: 50 }],
  2: [
    { cx: 24, cy: 24 },
    { cx: 76, cy: 76 },
  ],
  3: [
    { cx: 24, cy: 24 },
    { cx: 50, cy: 50 },
    { cx: 76, cy: 76 },
  ],
  4: [
    { cx: 24, cy: 24 },
    { cx: 76, cy: 24 },
    { cx: 24, cy: 76 },
    { cx: 76, cy: 76 },
  ],
  5: [
    { cx: 24, cy: 24 },
    { cx: 76, cy: 24 },
    { cx: 50, cy: 50 },
    { cx: 24, cy: 76 },
    { cx: 76, cy: 76 },
  ],
  6: [
    { cx: 24, cy: 18 },
    { cx: 76, cy: 18 },
    { cx: 24, cy: 50 },
    { cx: 76, cy: 50 },
    { cx: 24, cy: 82 },
    { cx: 76, cy: 82 },
  ],
};

// Pip radius (in the 0..100 half-face units). Small enough that the closest
// neighbours (the three rows of a six, 32 units apart) keep a clear gap.
const PIP_R = 11;

// Official-style domino pip palette — one crisp, saturated colour per value,
// matching classic coloured double-six sets (5=blue, 3=red, 4=green,
// 6=amber/orange), so every value is instantly legible on the ivory tile.
const PIP_COLORS: Record<number, string> = {
  1: "#34404f", // dark slate
  2: "#0f9b8e", // teal
  3: "#dc2626", // red
  4: "#16a34a", // green
  5: "#2563eb", // blue
  6: "#f59e0b", // amber / orange
};

function Half({ value }: { value: number }) {
  const pips = PIP_MAP[value] ?? [];
  const color = PIP_COLORS[value] ?? "oklch(0.3 0.03 250)";
  return (
    <svg viewBox="0 0 100 100" className="block size-full">
      {pips.map((p, i) => (
        <circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={PIP_R}
          fill={color}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

export interface DominoTileProps {
  values: [number, number];
  orientation?: "h" | "v"; // h = horizontal (two squares side by side), v = vertical
  size?: "sm" | "md" | "lg";
  // When true, the tile fills its parent box (used by the absolutely-positioned
  // board chain, where the exact pixel size is set on the wrapper). The strict
  // 1:2 rectangle is then enforced by the wrapper, not by these classes.
  fill?: boolean;
  hidden?: boolean;
  selected?: boolean;
  playable?: boolean;
  onClick?: () => void;
  className?: string;
}

export function DominoTile({
  values,
  orientation = "h",
  size = "md",
  fill = false,
  hidden = false,
  selected = false,
  playable = false,
  onClick,
  className,
}: DominoTileProps) {
  const dims = fill
    ? "h-full w-full"
    : {
        sm: orientation === "h" ? "h-11 w-[5.5rem]" : "h-[5.5rem] w-11",
        md: orientation === "h" ? "h-16 w-32" : "h-32 w-16",
        lg: orientation === "h" ? "h-20 w-40" : "h-40 w-20",
      }[size];

  const interactive = !!onClick;

  if (hidden) {
    return (
      <div
        className={cn(
          "rounded-md bg-gradient-to-br from-[oklch(0.42_0.18_270)] to-[oklch(0.28_0.12_280)] shadow-[var(--shadow-tile)]",
          "border border-[oklch(0.55_0.22_280)]/40",
          dims,
          className,
        )}
        aria-label="hidden tile"
      >
        <div className="grid h-full place-items-center text-2xl font-bold text-[oklch(0.85_0.15_290)]/60">
          <span className="font-display">T</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-label={`domino ${values[0]}-${values[1]}`}
      className={cn(
        // Flat, clean, rounded ivory tile with a crisp edge.
        "relative rounded-xl bg-[var(--color-tile)] text-[var(--color-tile-foreground)]",
        "border border-black/15 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.35)]",
        "transition-all duration-150",
        dims,
        interactive &&
          "cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-glow-primary)]",
        !interactive && "cursor-default",
        selected && "ring-2 ring-primary -translate-y-1.5 shadow-[var(--shadow-glow-primary)]",
        playable && !selected && "ring-2 ring-success/70",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-1 grid gap-0",
          orientation === "h" ? "grid-cols-2" : "grid-rows-2",
        )}
      >
        <div className="grid place-items-center">
          <Half value={values[0]} />
        </div>
        <div
          className={cn(
            "grid place-items-center",
            orientation === "h" ? "border-l border-[#26303c]/20" : "border-t border-[#26303c]/20",
          )}
        >
          <Half value={values[1]} />
        </div>
      </div>
    </button>
  );
}
