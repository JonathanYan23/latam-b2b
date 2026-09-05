"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Send, Loader2, FileText, X } from "lucide-react";
import { sendMessageAction } from "@/lib/message-actions";
import { date } from "@/lib/format";
import { UploadButton } from "@/components/upload-button";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";

export interface MessageItem {
  id: string;
  body: string;
  attachments?: string[];
  createdAt: string;
  mine: boolean;
  senderName: string | null;
}

function isPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

/** 会话消息框：历史 + 发送（支持图片/PDF 附件）
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
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSend = text.trim().length > 0 || attachments.length > 0;

  function renderAttachments(m: MessageItem) {
    if (!m.attachments?.length) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {m.attachments.map((url, i) =>
          isPdf(url) ? (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-2)] bg-white px-2 py-1 text-xs text-[var(--color-ink)]"
            >
              <FileText className="size-3.5" /> PDF
            </a>
          ) : (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <span className="relative block size-14 overflow-hidden rounded-md border border-[var(--color-line-2)]">
                <Image src={url} alt="" fill sizes="56px" className="object-cover" unoptimized />
              </span>
            </a>
          ),
        )}
      </div>
    );
  }

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
                {m.body && <p className="mt-0.5 leading-relaxed">{m.body}</p>}
                {renderAttachments(m)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 附件预览（待发送） */}
      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {attachments.map((url, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-subtle)] px-2 py-1 text-xs"
            >
              {isPdf(url) ? (
                <>
                  <FileText className="size-3.5" /> PDF
                </>
              ) : (
                <span className="relative block size-8 overflow-hidden rounded">
                  <Image src={url} alt="" fill sizes="32px" className="object-cover" unoptimized />
                </span>
              )}
              <button
                type="button"
                onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}
                className="ml-0.5 text-[var(--color-ink-3)] hover:text-[var(--color-danger)]"
                aria-label="remove"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 输入 */}
      <form
        action={(fd) => {
          fd.set("attachments", JSON.stringify(attachments));
          startTransition(async () => {
            setError(null);
            const res = await sendMessageAction(wholesalerId, retailerId, fd);
            if (!res.ok) setError(res.error ?? t.messages.errEmpty);
            else {
              setText("");
              setAttachments([]);
              onSent?.();
            }
          });
        }}
        className="mt-3 flex items-end gap-2"
      >
        <UploadButton
          compact
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          label={t.messages.attach}
          onUploaded={(url) => setAttachments((a) => [...a, url])}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          name="body"
          placeholder={t.messages.placeholder}
          className="input"
        />
        <button
          type="submit"
          disabled={pending || !canSend}
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
