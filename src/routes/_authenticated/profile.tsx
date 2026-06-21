import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TokioLogo } from "@/components/tokio-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PlayerAvatar } from "@/components/player-avatar";
import { ArrowLeft, Upload, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

async function resizeToDataUrl(file: File, max = 256): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function ProfilePage() {
  const { user } = useSession();
  const profile = useProfile(user?.id);
  const [username, setUsername] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentUsername = username || profile?.username || "";
  const currentAvatar = avatarPreview ?? profile?.avatar_url ?? null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB");
    try {
      const dataUrl = await resizeToDataUrl(f);
      setAvatarPreview(dataUrl);
    } catch {
      toast.error("تعذر قراءة الصورة");
    }
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const updates: { updated_at: string; username?: string; avatar_url?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (username) updates.username = username;
    if (avatarPreview) updates.avatar_url = avatarPreview;
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    setAvatarPreview(null);
    setUsername("");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/40 bg-background/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TokioLogo size={32} />
            <LanguageSwitcher className="h-9 px-2.5" />
          </div>
          <Link to="/lobby">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="size-4 rotate-180" /> اللوبي
            </Button>
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-10 max-w-xl">
        <div className="tokio-glass rounded-3xl p-8">
          <h1 className="font-display text-2xl font-bold mb-6">الملف الشخصي</h1>
          <div className="flex flex-col items-center gap-4 mb-8">
            <PlayerAvatar
              size="lg"
              username={currentUsername}
              avatarUrl={currentAvatar}
              className="size-24"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="size-4" /> تغيير الصورة
            </Button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>اسم المستخدم</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={profile?.username ?? "اسم اللاعب"}
                maxLength={30}
              />
            </div>
            <Button
              onClick={save}
              disabled={saving || (!username && !avatarPreview)}
              className="w-full h-11 font-display font-bold bg-gradient-to-r from-primary to-[oklch(0.65_0.2_30)]"
            >
              <Save className="size-4" /> {saving ? "حفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
