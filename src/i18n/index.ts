import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

export type Locale = "en" | "ar";

const STORAGE_KEY = "tokio.locale";

function detectInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ar") return stored;
  }
  // User preference: default to English on first visit.
  return "en";
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: detectInitialLocale(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnObjects: false,
    // React already handles re-renders; no need for i18next to subscribe.
    react: { useSuspense: false },
  });
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
}

export { STORAGE_KEY };
export default i18n;
