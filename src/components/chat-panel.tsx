"use client";

import { useState } from "react";
import { Maximize2, Minimize2, MessageCircle } from "lucide-react";
import { MessageBox, type MessageItem } from "./message-box";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";

/** 会话聊天卡：默认右侧栏小卡；可一键全屏（fixed 覆盖层）便于长文本浏览与输入 */
export function ChatPanel({
  title,
  badge,
  messages,
  wholesalerId,
  retailerId,
  t,
  locale,
}: {
  title: string;
  badge?: React.ReactNode;
  messages: MessageItem[];
  wholesalerId: string;
  retailerId: string;
  t: Dict;
  locale: Locale;
}) {
  const [full, setFull] = useState(false);

  const header = (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line-2)] pb-3">
      <MessageCircle className="size-4 shrink-0 text-[var(--color-ink-2)]" />
      <p className="truncate text-sm font-medium">{title}</p>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {badge}
        <button
          type="button"
          onClick={() => setFull((v) => !v)}
          title={full ? t.messages.collapse : t.messages.expand}
          aria-label={full ? t.messages.collapse : t.messages.expand}
          className="grid size-7 place-items-center rounded-md text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
        >
          {full ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );

  // 全屏视图：fixed 覆盖层，消息区与输入区自适应填满
  if (full) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl">
        <div className="shrink-0 border-b border-[var(--color-line-2)] bg-[var(--color-bg-subtle)] px-4 py-3 sm:px-6">
          {header}
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            <MessageBox
              fill
              wholesalerId={wholesalerId}
              retailerId={retailerId}
              messages={messages}
              t={t}
              locale={locale}
            />
          </div>
        </div>
      </div>
    );
  }

  // 默认：右栏卡片（sticky 场景由父容器定位）
  return (
    <div className="card flex max-h-[min(62vh,600px)] flex-col p-4">
      {header}
      <MessageBox
        fill
        wholesalerId={wholesalerId}
        retailerId={retailerId}
        messages={messages}
        t={t}
        locale={locale}
      />
    </div>
  );
}
