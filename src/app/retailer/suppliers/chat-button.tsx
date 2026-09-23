import Link from "next/link";
import { MessageCircle } from "lucide-react";

/**
 * 供应商列表行上的聊天入口（需求 2.4：供应商信息旁直接放置「聊天/发消息」入口，点入即对话）。
 * - 带可见文字标签（仅图标不易被发现），文案随界面语言本地化
 * - 跳转独立全屏聊天页（返回即回到列表原位置）
 */
export function SupplierChatButton({
  wholesalerId,
  supplierName,
  label,
  unread = 0,
}: {
  wholesalerId: string;
  supplierName: string;
  /** 本地化文案（通常传 t.suppliers.chatNow） */
  label: string;
  unread?: number;
}) {
  return (
    <Link
      href={`/retailer/suppliers/${wholesalerId}/chat`}
      title={supplierName}
      aria-label={`${label} · ${supplierName}`}
      className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-line-2)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white"
    >
      <MessageCircle className="size-3.5" />
      {label}
      {unread > 0 && (
        <span className="grid min-w-3.5 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-semibold leading-tight text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
