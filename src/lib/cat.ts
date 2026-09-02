import type { Locale } from "@/i18n/config";

/** 按当前语言返回分类显示名（zh→nameZh, es→nameEs, 其余英文 name） */
export function catName(
  c: {
    name: string;
    nameZh?: string | null;
    nameEs?: string | null;
  } | null | undefined,
  locale: Locale,
): string {
  if (!c) return "—";
  if (locale === "zh" && c.nameZh) return c.nameZh;
  if (locale === "es" && c.nameEs) return c.nameEs;
  return c.name;
}
