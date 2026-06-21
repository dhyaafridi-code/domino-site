import logoSrc from "@/assets/tokio-logo.png";
import { cn } from "@/lib/utils";

export function TokioLogo({
  className,
  size = 40,
  showWordmark = true,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logoSrc}
        alt="Tokio Domino"
        width={size}
        height={size}
        className="drop-shadow-[0_0_12px_oklch(0.65_0.22_295/0.4)]"
      />
      {showWordmark && (
        <span className="font-display text-xl font-bold tracking-tight">
          <span className="text-foreground">Tok</span>
          <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">
            io
          </span>
        </span>
      )}
    </div>
  );
}
