import { useEffect } from "react";
import { useLocale } from "./use-locale";

/**
 * Mirrors the active locale onto <html lang> and <html dir>, and toggles the
 * `.latin-digits` class on <html>. The CSS rule behind that class is the
 * last-line defense against Arabic fonts substituting Eastern Arabic numerals
 * (٠-٩) in place of the Western digits (0-9) we explicitly format with
 * `formatNumber()`.
 */
export function LocaleEffect() {
  const { locale, dir } = useLocale();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.lang = locale;
    html.dir = dir;
    html.classList.add("latin-digits");
  }, [locale, dir]);

  return null;
}
