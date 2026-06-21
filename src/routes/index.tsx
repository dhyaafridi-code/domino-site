import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { TokioLogo } from "@/components/tokio-logo";
import { DominoTile } from "@/components/domino-tile";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ArrowLeft, Users, MessageCircle, Sparkles } from "lucide-react";
import { useLocale } from "@/i18n/use-locale";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tokio Domino — Play domino online with your friends" },
      {
        name: "description",
        content:
          "Tokio: a 2-4 player online multiplayer domino game with a modern night-style design, live chat, and private rooms.",
      },
      { property: "og:title", content: "Tokio Domino" },
      {
        property: "og:description",
        content:
          "Play domino online with your friends — up to 4 players, live chat, modern night design.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t, formatNumber } = useLocale();
  return (
    <div className="min-h-screen">
      <header className="container mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TokioLogo size={36} />
          <LanguageSwitcher className="h-9 px-2.5" />
        </div>
        <Link to="/auth">
          <Button variant="ghost" className="font-display">
            <ArrowLeft className="size-4 rotate-180" /> {t("auth.tabSignIn")}
          </Button>
        </Link>
      </header>

      <main className="container mx-auto px-4 pt-12 pb-24">
        <section className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-center lg:text-right">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/30 px-4 py-1.5 text-sm font-medium text-accent">
              <Sparkles className="size-3.5" /> {t("home.tagline")}
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">
              {t("home.titleA")}
              <br />
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                {t("home.titleB")}
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              {t("home.lede")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-primary to-[oklch(0.65_0.2_30)] text-primary-foreground font-display font-bold text-base px-8 h-12 shadow-[var(--shadow-glow-primary)] hover:scale-105 transition"
                >
                  {t("home.ctaStart")}
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-display font-semibold text-base px-8 h-12 border-accent/40 hover:border-accent"
                >
                  {t("home.ctaCreate")}
                </Button>
              </Link>
            </div>
            <div className="flex gap-6 justify-center lg:justify-start pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Users className="size-4 text-primary" /> {t("home.upTo4")}
              </div>
              <div className="flex items-center gap-1.5">
                <MessageCircle className="size-4 text-accent" /> {t("home.liveChat")}
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-primary" /> {t("home.instantSync")}
              </div>
            </div>
          </div>

          <div className="relative h-[400px] lg:h-[500px] flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 blur-3xl rounded-full" />
            <div className="relative grid gap-3">
              <div className="flex gap-3 justify-center animate-in slide-in-from-top duration-700">
                <DominoTile values={[6, 6]} orientation="v" size="lg" />
                <DominoTile
                  values={[5, 3]}
                  orientation="h"
                  size="lg"
                  className="rotate-90 origin-center"
                />
              </div>
              <div className="flex gap-3 justify-center animate-in slide-in-from-right duration-700 delay-150">
                <DominoTile values={[4, 2]} orientation="h" size="lg" />
                <DominoTile values={[2, 1]} orientation="h" size="lg" />
                <DominoTile values={[1, 5]} orientation="h" size="lg" />
              </div>
              <div className="flex gap-3 justify-center animate-in slide-in-from-bottom duration-700 delay-300">
                <DominoTile values={[3, 3]} orientation="v" size="lg" />
                <DominoTile values={[5, 0]} orientation="h" size="lg" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { title: t("home.featRooms"), desc: t("home.featRoomsDesc"), icon: "🎲" },
            { title: t("home.featModes"), desc: t("home.featModesDesc"), icon: "♠" },
            { title: t("home.featYou"), desc: t("home.featYouDesc"), icon: "✨" },
          ].map((f) => (
            <div
              key={f.title}
              className="tokio-glass rounded-2xl p-6 hover:-translate-y-1 transition"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-display text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="container mx-auto px-4 py-8 border-t border-border/40 text-center text-sm text-muted-foreground">
        {t("home.footer", { year: formatNumber(new Date().getFullYear()) })}
      </footer>
    </div>
  );
}
