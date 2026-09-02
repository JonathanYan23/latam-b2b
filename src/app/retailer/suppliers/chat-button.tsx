"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Loader2 } from "lucide-react";
import { getConversationMessagesAction } from "@/lib/message-actions";
import { MessageBox, type MessageItem } from "@/components/message-box";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";

/** 供应商列表行上的聊天小按钮：点开居中弹窗直接与该供应商聊天 */
export function SupplierChatButton({
  wholesalerId,
  retailerId,
  supplierName,
  t,
  locale,
}: {
  wholesalerId: string;
  retailerId: string;
  supplierName: string;
  t: Dict;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 打开时禁止背景滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getConversationMessagesAction(wholesalerId, retailerId);
    if (res.ok) setMessages(res.messages ?? []);
    setLoading(false);
  }, [wholesalerId, retailerId]);

  const handleOpen = () => {
    setOpen(true);
    load();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title={supplierName}
        aria-label={`Chat with ${supplierName}`}
        className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-bg)] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white"
      >
        <MessageCircle className="size-4" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-label={`Chat with ${supplierName}`}
              className="card relative flex max-h-[min(70vh,560px)] w-full max-w-md flex-col overflow-hidden shadow-[var(--shadow-pop)]"
              style={{ maxHeight: "calc(100vh - 2rem)" }}
            >
              {/* 头部 */}
              <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line-2)] px-5 py-3.5">
                <span className="grid size-7 place-items-center rounded-full bg-[var(--color-accent)] text-white">
                  <MessageCircle className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{supplierName}</p>
                  <p className="text-meta text-xs">{t.suppliers.messagesTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost size-8 shrink-0 rounded-full p-0"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* 会话内容 */}
              <div className="px-5 py-4">
                {loading ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-[var(--color-ink-3)]" />
                  </div>
                ) : (
                  <MessageBox
                    wholesalerId={wholesalerId}
                    retailerId={retailerId}
                    messages={messages}
                    t={t}
                    locale={locale}
                    onSent={() => load()}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
