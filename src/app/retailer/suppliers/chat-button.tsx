import Link from "next/link";
import { MessageCircle } from "lucide-react";

/** 供应商列表行上的聊天按钮：跳转独立全屏聊天页（返回即回到列表原位置） */
export function SupplierChatButton({
  wholesalerId,
  supplierName,
  unread = 0,
}: {
  wholesalerId: string;
  supplierName: string;
  unread?: number;
}) {
  return (
    <Link
      href={`/retailer/suppliers/${wholesalerId}/chat`}
      title={supplierName}
      aria-label={`Chat with ${supplierName}`}
      className="relative grid size-8 shrink-0 place-items-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-bg)] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white"
    >
      <MessageCircle className="size-4" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-3.5 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-semibold leading-tight text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
