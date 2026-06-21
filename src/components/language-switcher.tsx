import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/i18n/use-locale";
import type { Locale } from "@/i18n";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, dir, t, setLocale } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={className}
          aria-label={t("nav.languageMenu")}
          title={t("nav.languageMenu")}
        >
          <Globe className="size-4" />
          <span className="font-display text-xs font-bold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={dir === "rtl" ? "start" : "end"}>
        <LocaleItem
          active={locale === "en"}
          label={t("language.english")}
          onSelect={() => setLocale("en" as Locale)}
        />
        <LocaleItem
          active={locale === "ar"}
          label={t("language.arabic")}
          onSelect={() => setLocale("ar" as Locale)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LocaleItem({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className="gap-2"
    >
      <span className="flex-1">{label}</span>
      {active && <Check className="size-4 text-primary" />}
    </DropdownMenuItem>
  );
}
