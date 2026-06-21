import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Locale } from "./index";
import { persistLocale } from "./index";

export type Direction = "ltr" | "rtl";

// A formatter that ALWAYS uses Western Arabic numerals, regardless of the
// active UI language. Eastern Arabic digits (٠-٩) auto-substitute inside
// `lang="ar"` blocks; this is the application-level guard against that.
const westernNumberFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return westernNumberFormatter.format(n);
}

export function dirFor(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}

export function useLocale() {
  const { i18n, t } = useTranslation();
  const locale = (i18n.language as Locale) || "en";
  const dir = dirFor(locale);

  const setLocale = useCallback(
    (next: Locale) => {
      void i18n.changeLanguage(next);
      persistLocale(next);
    },
    [i18n],
  );

  return { locale, dir, t, formatNumber, setLocale };
}
