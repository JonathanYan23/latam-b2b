// =============================================================
// i18n 配置（PRD 34 节：多语言，第一版支持 en / zh / es）
// cookie 驱动，无路由前缀，内部平台场景够用且改动最小
// =============================================================

export const locales = ["en", "zh", "es"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};

export const COOKIE_NAME = "lang";

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (locales as readonly string[]).includes(v);
}
