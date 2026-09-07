"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Send,
  Loader2,
  FileText,
  X,
  Package,
  Receipt,
  ExternalLink,
} from "lucide-react";
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

/** 快捷发送的候选条目（服务端预组） */
export interface PickCard {
  id: string;
  title: string;
  sub: string;
  href: string;
}
export interface PickCatalog {
  products?: PickCard[];
  orders?: PickCard[];
}

/** 消息卡片：结构化前缀 + JSON，收发双方均可解析渲染（无 schema 变更） */
const CARD_PREFIX = "[CARD]";
export interface MsgCard {
  k: "p" | "o";
  id: string;
  t: string;
  s: string;
  h: string;
}
function cardBody(c: MsgCard): string {
  return CARD_PREFIX + JSON.stringify(c);
}
function parseCard(body: string): MsgCard | null {
  if (!body.startsWith(CARD_PREFIX)) return null;
  try {
    const obj = JSON.parse(body.slice(CARD_PREFIX.length));
    if (obj && (obj.k === "p" || obj.k === "o") && obj.t) return obj as MsgCard;
  } catch {
    /* ignore */
  }
  return null;
}

function isPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

/** 会话消息框：历史 + 发送（文字/图片/PDF 附件/商品/订单卡片） */
export function MessageBox({
  wholesalerId,
  retailerId,
  messages,
  t,
  locale,
  onSent,
  fill = false,
  cards,
}: {
  wholesalerId: string;
  retailerId: string;
  messages: MessageItem[];
  t: Dict;
  locale: Locale;
  onSent?: () => void;
  fill?: boolean;
  cards?: PickCatalog;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<"p" | "o" | null>(null);

  const canSend = text.trim().length > 0 || attachments.length > 0;
  const list = picker === "p" ? cards?.products : picker === "o" ? cards?.orders : null;
  const M = t.messages;

  const sendText = (bodyText: string) => {
    if (pending) return;
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("body", bodyText);
      fd.set("attachments", JSON.stringify(attachments));
      const res = await sendMessageAction(wholesalerId, retailerId, fd);
      if (!res.ok) setError(res.error ?? M.errEmpty);
      else {
        setText("");
        setAttachments([]);
        setPicker(null);
        onSent?.();
      }
    });
  };

  const sendCard = (kind: "p" | "o", c: PickCard) => {
    setPicker(null);
    sendText(cardBody({ k: kind, id: c.id, t: c.title, s: c.sub, h: c.href }));
  };

  function renderAttachments(a: string[]) {
    if (!a.length) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {a.map((url, i) =>
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

  function renderBubble(m: MessageItem) {
    const card = parseCard(m.body);
    if (card) {
      return (
        <div
          key={m.id}
          className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${
              m.mine
                ? "bg-[var(--color-ink)] text-white"
                : "border border-[var(--color-line-2)] bg-[var(--color-bg-subtle)]"
            }`}
          >
            <p className="text-xs opacity-70">
              {m.mine ? M.you : m.senderName ?? M.supplier} ·{" "}
              {date(m.createdAt, locale)}
            </p>
            {/* 商品/订单卡片 */}
            <div className="mt-1.5 w-64 rounded-lg border border-[var(--color-line-2)] bg-white p-3 text-[var(--color-ink)]">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)]">
                  {card.k === "p" ? (
                    <Package className="size-4 text-[var(--color-accent)]" />
                  ) : (
                    <Receipt className="size-4 text-[var(--color-ink-2)]" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {card.k === "p" ? M.sendProduct : M.sendOrder}
                  </p>
                  <p className="truncate text-[11px] opacity-80">{card.t}</p>
                </div>
              </div>
              <p className="text-meta mt-2 truncate text-[11px]">{card.s}</p>
              <a
                href={card.h}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary mt-2.5 flex w-full items-center justify-center gap-1 px-2 py-1.5 text-xs"
              >
                {M.openLink} <ExternalLink className="size-3" />
              </a>
            </div>
            {renderAttachments(m.attachments ?? [])}
          </div>
        </div>
      );
    }
    return (
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
            {m.mine ? M.you : m.senderName ?? M.supplier} ·{" "}
            {date(m.createdAt, locale)}
          </p>
          {m.body && <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{m.body}</p>}
          {renderAttachments(m.attachments ?? [])}
        </div>
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
            {M.empty}
          </p>
        ) : (
          messages.map((x) => renderBubble(x))
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
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSend) return;
          sendText(text);
        }}
        className="mt-3"
      >
        <div className="relative flex items-end gap-2">
          {cards && (
            <>
              {!!cards.products?.length && (
                <button
                  type="button"
                  onClick={() => setPicker(picker === "p" ? null : "p")}
                  title={M.sendProduct}
                  className={`flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    picker === "p"
                      ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                      : "border-[var(--color-line-2)] text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Package className="size-4" />
                </button>
              )}
              {!!cards.orders?.length && (
                <button
                  type="button"
                  onClick={() => setPicker(picker === "o" ? null : "o")}
                  title={M.sendOrder}
                  className={`flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    picker === "o"
                      ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                      : "border-[var(--color-line-2)] text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Receipt className="size-4" />
                </button>
              )}
            </>
          )}
          <UploadButton
            compact
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            label={M.attach}
            onUploaded={(url) => setAttachments((a) => [...a, url])}
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            name="body"
            placeholder={M.placeholder}
            className="input flex-1"
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

          {/* 卡片选择浮层 */}
          {picker && list && (
            <div className="absolute bottom-[52px] left-0 z-20 w-72 overflow-hidden rounded-xl border border-[var(--color-line-2)] bg-white shadow-xl">
              <div className="border-b border-[var(--color-line-2)] px-3 py-2 text-xs font-medium text-[var(--color-ink-2)]">
                {picker === "p" ? M.sendProduct : M.sendOrder}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {list.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-[var(--color-ink-3)]">
                    {M.noCards}
                  </p>
                ) : (
                  list.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => sendCard(picker, c)}
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-muted)]"
                    >
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)]">
                        {picker === "p" ? (
                          <Package className="size-3.5 text-[var(--color-accent)]" />
                        ) : (
                          <Receipt className="size-3.5 text-[var(--color-ink-2)]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {c.title}
                        </span>
                        <span className="text-meta block truncate text-[11px]">
                          {c.sub}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </form>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
