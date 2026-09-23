import type { Dict } from "@/i18n";

const CARD_PREFIX = "[CARD]";

/**
 * 会话列表「最后一条消息」的预览文案。
 *
 * 背景：商品/订单卡片消息在 DB 里以 `[CARD]{...json...}` 存储。
 * 直接渲染 body 会把原始 JSON 暴露给用户（出厂级缺陷），
 * 因此统一转换为可读标签 + 标题（商品名 / 订单号）；
 * 纯附件消息（body 为空）显示「附件」占位。
 */
export function msgPreview(
  body: string | null | undefined,
  attachments: string | null | undefined,
  t: Dict,
): string {
  const raw = body ?? "";
  if (raw.startsWith(CARD_PREFIX)) {
    let kind: string | undefined;
    let title = "";
    try {
      const c = JSON.parse(raw.slice(CARD_PREFIX.length)) as {
        k?: string;
        t?: string;
      };
      kind = c?.k;
      title = typeof c?.t === "string" ? c.t : "";
    } catch {
      /* 解析失败 → 走通用标签 */
    }
    const label = kind === "o" ? t.messages.cardOrder : t.messages.cardProduct;
    return title ? `${label} · ${title}` : label;
  }
  if (!raw.trim()) {
    let n = 0;
    try {
      const arr = attachments ? (JSON.parse(attachments) as unknown[]) : [];
      n = Array.isArray(arr) ? arr.length : 0;
    } catch {
      n = 0;
    }
    if (n > 0) return t.messages.attachmentOnly;
  }
  return raw;
}
