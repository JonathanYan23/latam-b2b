import type { Dict } from "@/i18n";
import { fmt } from "@/i18n/utils";

/**
 * 账期本地化展示（需求：统一按界面语言展示，中文环境显示"账期60天"，不使用 "NET60/T60"）。
 * 存储为 "NET7" / "NET15" / "NET30" / "NET60"；空串 = 全款 COD。
 * 未知值原样回退。
 */
export function termsLabel(
  terms: string | null | undefined,
  t: Dict,
): string {
  const s = (terms ?? "").trim();
  if (!s) return t.common.termsCodFull;
  const m = s.toUpperCase().match(/^NET\s*(\d+)$/);
  if (m) return fmt(t.common.termsNetDay, { n: parseInt(m[1], 10) });
  return s;
}
