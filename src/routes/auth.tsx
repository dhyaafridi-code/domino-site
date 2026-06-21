import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TokioLogo } from "@/components/tokio-logo";
import { DominoTile } from "@/components/domino-tile";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ArrowLeft, LogIn, UserPlus, Loader2, Sparkles, Users, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/i18n/use-locale";

export const Route = createFileRoute("/auth")({
  // Carry an optional post-login destination (set when an invite link bounced
  // an unauthenticated visitor here). Only same-origin paths are accepted.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = search.redirect;
    return {
      redirect: typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Sign in — Tokio Domino" },
      {
        name: "description",
        content: "Sign in or create an account to play domino online on Tokio.",
      },
    ],
  }),
  component: AuthPage,
});

// Friendly Supabase auth errors → user-facing strings. Both maps use the
// exact same keys; the active locale picks which map to consult.
const EN_AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "Incorrect email or password",
  "Invalid email or password": "Incorrect email or password",
  "User already registered": "This email is already registered, try signing in",
  "A user with this email address has already been registered":
    "This email is already registered, try signing in",
  "Password should be at least 6 characters": "Password is too short (at least 6 characters)",
  "Password should be at least": "Password is too short",
  "Signup requires a valid password": "Invalid password",
  "Unable to validate email address: invalid format": "Invalid email format",
  "Email rate limit exceeded": "Too many requests, try again shortly",
};

const AR_AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "البريد أو كلمة المرور غير صحيحة",
  "Invalid email or password": "البريد أو كلمة المرور غير صحيحة",
  "User already registered": "هذا البريد مسجل من قبل، جرّب تسجيل الدخول",
  "A user with this email address has already been registered":
    "هذا البريد مسجل من قبل، جرّب تسجيل الدخول",
  "Password should be at least 6 characters": "كلمة المرور قصيرة جداً (6 أحرف على الأقل)",
  "Password should be at least": "كلمة المرور قصيرة جداً",
  "Signup requires a valid password": "كلمة المرور غير صالحة",
  "Unable to validate email address: invalid format": "صيغة البريد الإلكتروني غير صحيحة",
  "Email rate limit exceeded": "تم إرسال عدد كبير من الطلبات، حاول بعد قليل",
};

function friendlyAuthError(message: string, locale: "en" | "ar"): string {
  const map = locale === "ar" ? AR_AUTH_ERRORS : EN_AUTH_ERRORS;
  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value;
  }
  return message;
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const { locale, t } = useLocale();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // Land on the originally requested page (an invite link, typically) when one
  // was provided, otherwise the lobby. A full navigation guarantees the
  // authenticated guard re-runs with the fresh session.
  function goAfterAuth() {
    if (redirectTo) window.location.href = redirectTo;
    else navigate({ to: "/lobby" });
  }

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);

  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");
  const [signUpLoading, setSignUpLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goAfterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (signInLoading) return;
    setSignInLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword,
    });
    setSignInLoading(false);
    if (error) return toast.error(friendlyAuthError(error.message, locale));
    toast.success(t("auth.signedInWelcome"));
    goAfterAuth();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (signUpLoading) return;

    const username = signUpUsername.trim();
    const email = signUpEmail.trim();
    const password = signUpPassword;
    const confirm = signUpConfirm;

    if (username.length < 2) {
      return toast.error(t("auth.usernameShort"));
    }
    if (password.length < 6) {
      return toast.error(t("auth.passwordShort"));
    }
    if (password !== confirm) {
      return toast.error(t("auth.passwordMismatch"));
    }

    setSignUpLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    setSignUpLoading(false);

    if (error) return toast.error(friendlyAuthError(error.message, locale));

    toast.success(t("auth.accountCreated"));
    goAfterAuth();
  }

  return (
    <div className="min-h-screen w-full grid place-items-center px-4 py-10">
      <div className="w-full max-w-5xl tokio-glass rounded-3xl overflow-hidden shadow-[var(--shadow-elevated)] grid md:grid-cols-2">
        <aside className="relative hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/25 via-transparent to-accent/25">
          <div className="flex items-center gap-2">
            <TokioLogo size={44} />
            <LanguageSwitcher className="h-9 px-2.5" />
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/30 px-3 py-1 text-xs font-medium text-accent">
              <Sparkles className="size-3.5" /> {t("auth.leftPanelTag")}
            </div>
            <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">
              {t("auth.leftPanelTitleA")}
              <br />
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                {t("auth.leftPanelTitleB")}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {t("auth.leftPanelLede")}
            </p>
            <div className="flex gap-5 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Users className="size-4 text-primary" /> {t("home.upTo4")}
              </div>
              <div className="flex items-center gap-1.5">
                <MessageCircle className="size-4 text-accent" /> {t("home.liveChat")}
              </div>
            </div>
          </div>

          <div className="relative h-44 -mb-2">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 blur-3xl rounded-full" />
            <div className="relative grid gap-2 place-items-center h-full">
              <div className="flex gap-2">
                <DominoTile values={[6, 6]} orientation="v" size="md" />
                <DominoTile
                  values={[5, 3]}
                  orientation="h"
                  size="md"
                  className="rotate-90 origin-center"
                />
              </div>
              <div className="flex gap-2">
                <DominoTile values={[4, 2]} orientation="h" size="md" />
                <DominoTile values={[2, 1]} orientation="h" size="md" />
                <DominoTile values={[1, 5]} orientation="h" size="md" />
              </div>
            </div>
          </div>
        </aside>

        <section className="p-6 sm:p-8 md:p-10 flex flex-col">
          <div className="md:hidden flex justify-center items-center gap-2 mb-6">
            <TokioLogo size={48} />
            <LanguageSwitcher className="h-9 px-2.5" />
          </div>
          <div className="mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {t("auth.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.subtitle")}</p>
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "signin" | "signup")}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full h-11">
              <TabsTrigger value="signin" className="font-display font-semibold gap-1.5">
                <LogIn className="size-4" /> {t("auth.tabSignIn")}
              </TabsTrigger>
              <TabsTrigger value="signup" className="font-display font-semibold gap-1.5">
                <UserPlus className="size-4" /> {t("auth.tabSignUp")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">{t("auth.email")}</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                    disabled={signInLoading}
                    dir="ltr"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">{t("auth.password")}</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    required
                    disabled={signInLoading}
                    dir="ltr"
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={signInLoading}
                  className="w-full h-11 font-display font-bold bg-gradient-to-r from-primary to-[oklch(0.65_0.2_30)] shadow-[var(--shadow-glow-primary)]"
                >
                  {signInLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> {t("auth.submittingSignIn")}
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" /> {t("auth.submitSignIn")}
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-username">{t("auth.username")}</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    autoComplete="username"
                    placeholder={t("auth.usernamePlaceholder")}
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    required
                    minLength={2}
                    disabled={signUpLoading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">{t("auth.email")}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                    disabled={signUpLoading}
                    dir="ltr"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">{t("auth.password")}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t("auth.passwordPlaceholderHint")}
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={signUpLoading}
                    dir="ltr"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm">{t("auth.confirmPassword")}</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t("auth.confirmPassword")}
                    value={signUpConfirm}
                    onChange={(e) => setSignUpConfirm(e.target.value)}
                    required
                    minLength={6}
                    disabled={signUpLoading}
                    dir="ltr"
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={signUpLoading}
                  className="w-full h-11 font-display font-bold bg-gradient-to-r from-accent to-[oklch(0.55_0.25_280)] shadow-[var(--shadow-glow-accent)]"
                >
                  {signUpLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> {t("auth.submittingSignUp")}
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" /> {t("auth.submitSignUp")}
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 pt-6 border-t border-border/40 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4 rotate-180" />
              {t("common.backToHome")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
