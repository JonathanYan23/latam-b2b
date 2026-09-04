"use client";

import { useState, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { sendMessageAction } from "@/lib/message-actions";
import { date } from "@/lib/format";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";

export interface MessageItem {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  senderName: string | null;
}

/** 会话消息框：历史 + 发送（MVP：Send Message，无实时推送）
 * fill=true 时消息区自适应填满父容器（用于全屏聊天视图），默认固定高度（max-h-72）。
 */
export function MessageBox({
  wholesalerId,
  retailerId,
  messages,
  t,
  locale,
  onSent,
  fill = false,
}: {
  wholesalerId: string;
  retailerId: string;
  messages: MessageItem[];
  t: Dict;
  locale: Locale;
  onSent?: () => void;
  fill?: boolean;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={fill ? "flex min-h-0 flex-1 flex-col" : "flex flex-col"}>
      {/* 历史 */}
      <div
        className={
          fill
            ? "min-h-0 flex-1 space-y-3 overflow-y-auto px-0.5 py-0.5"
            : "max-h-72 space-y-3 overflow-y-auto"
        }
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-ink-3)]">
            {t.messages.empty}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                  m.mine
                    ? "bg-[var(--color-ink)] text-white"
                    : "border border-[var(--color-line-2)] bg-[var(--color-bg-subtle)]"
                }`}
              >
                <p className="text-xs opacity-70">
                  {m.mine ? t.messages.you : m.senderName ?? t.messages.supplier} ·{" "}
                  {date(m.createdAt, locale)}
                </p>
                <p className="mt-0.5 leading-relaxed">{m.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 输入 */}
      <form
        action={(fd) =>
          startTransition(async () => {
            setError(null);
            const res = await sendMessageAction(wholesalerId, retailerId, fd);
            if (!res.ok) setError(res.error ?? t.messages.errEmpty);
            else {
              setText("");
              onSent?.();
            }
          })
        }
        className="mt-4 flex items-center gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          name="body"
          placeholder={t.messages.placeholder}
          className="input"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="btn btn-primary size-10 shrink-0 p-0"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
