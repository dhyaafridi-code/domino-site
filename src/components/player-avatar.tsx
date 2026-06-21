import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function PlayerAvatar({
  username,
  avatarUrl,
  size = "md",
  className,
}: {
  username?: string | null;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = { xs: "size-7", sm: "size-9", md: "size-12", lg: "size-16" }[size];
  const initials = (username ?? "?").slice(0, 2).toUpperCase();
  return (
    <Avatar
      className={cn(dim, "ring-2 ring-accent/40 shadow-[var(--shadow-glow-accent)]", className)}
    >
      {avatarUrl && <AvatarImage src={avatarUrl} alt={username ?? "player"} />}
      <AvatarFallback className="bg-gradient-to-br from-accent to-primary font-display font-bold text-accent-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
