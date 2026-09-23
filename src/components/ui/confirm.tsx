"use client";

/**
 * ConfirmDialog / PromptDialog —— 品牌级模态交互（替代原生 window.confirm / window.prompt）
 *
 * Promise 风格：
 *   const ok = await confirm({ title, description, variant: "danger" });
 *   const val = await prompt({ title, defaultValue: "12" }); // 取消返回 null
 *
 *  - 危险操作用红色主按钮 + 警示图标；普通操作走品牌蓝
 *  - Esc 取消、Enter 确认（危险操作为防止误触不响应 Enter）
 *  - 打开时锁定页面滚动，焦点自动落在「取消」/输入框
 *  - portal 到 body，不受祖先 backdrop-filter / transform 影响
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { useClientMounted } from "./use-mounted";

/* ------------------------------- Confirm ------------------------------- */

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** danger：删除等破坏性操作（红色）；默认品牌蓝 */
  variant?: "danger" | "default";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

/* -------------------------------- Prompt ------------------------------- */

export interface PromptOptions {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  inputType?: "text" | "number" | "decimal";
  confirmText?: string;
  cancelText?: string;
}

type PromptFn = (opts: PromptOptions) => Promise<string | null>;

const PromptContext = createContext<PromptFn | null>(null);

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error("usePrompt must be used within <ConfirmProvider>");
  return ctx;
}

/* ------------------------------ Provider ------------------------------- */

interface PendingConfirm {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}
interface PendingPrompt {
  opts: PromptOptions;
  resolve: (v: string | null) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<PendingConfirm | null>(null);
  const [promptState, setPromptState] = useState<PendingPrompt | null>(null);
  const confirmRef = useRef<PendingConfirm | null>(null);
  const promptRef = useRef<PendingPrompt | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      const p = { opts, resolve };
      confirmRef.current = p;
      setConfirmState(p);
    });
  }, []);

  const prompt = useCallback<PromptFn>((opts) => {
    return new Promise<string | null>((resolve) => {
      const p = { opts, resolve };
      promptRef.current = p;
      setPromptState(p);
    });
  }, []);

  const settleConfirm = useCallback((value: boolean) => {
    const p = confirmRef.current;
    confirmRef.current = null;
    setConfirmState(null);
    p?.resolve(value);
  }, []);

  const settlePrompt = useCallback((value: string | null) => {
    const p = promptRef.current;
    promptRef.current = null;
    setPromptState(null);
    p?.resolve(value);
  }, []);

  // 未决时卸载 → 视为取消，避免 Promise 永久挂起
  useEffect(() => {
    return () => {
      confirmRef.current?.resolve(false);
      promptRef.current?.resolve(null);
      confirmRef.current = null;
      promptRef.current = null;
    };
  }, []);

  const confirmApi = useMemo(() => confirm, [confirm]);
  const promptApi = useMemo(() => prompt, [prompt]);

  return (
    <ConfirmContext.Provider value={confirmApi}>
      <PromptContext.Provider value={promptApi}>
        {children}
        <ConfirmHost pending={confirmState} settle={settleConfirm} />
        <PromptHost pending={promptState} settle={settlePrompt} />
      </PromptContext.Provider>
    </ConfirmContext.Provider>
  );
}

/* ------------------------------ Backdrop ------------------------------- */

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

/* ------------------------------ Confirm UI ----------------------------- */

function ConfirmHost({
  pending,
  settle,
}: {
  pending: PendingConfirm | null;
  settle: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const mounted = useClientMounted();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const open = !!pending;
  const danger = pending?.opts.variant === "danger";

  useLockScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        settle(false);
      } else if (e.key === "Enter" && !danger) {
        e.preventDefault();
        settle(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, danger, settle]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => cancelRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!mounted || !pending) return null;

  const Icon = danger ? AlertTriangle : HelpCircle;
  const accent = danger ? "#ff3b30" : "#0071e3";

  return createPortal(
    <div
      data-ui="confirm"
      className="fixed inset-0 z-[130] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={pending.opts.title}
    >
      <div
        className="absolute inset-0 animate-[fadeIn_.18s_ease] bg-black/25 backdrop-blur-[3px]"
        onClick={() => settle(false)}
      />
      <div className="relative w-full animate-[dialogIn_.26s_cubic-bezier(.22,1,.36,1)] rounded-t-[22px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.22)] sm:w-[min(92vw,420px)] sm:rounded-[22px]">
        <div className="flex items-start gap-3.5">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full"
            style={{ background: `${accent}1a` }}
          >
            <Icon className="size-5" style={{ color: accent }} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-[var(--color-ink)]">
              {pending.opts.title}
            </h2>
            {pending.opts.description ? (
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                {pending.opts.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => settle(false)}
            className="h-10 rounded-full border border-[var(--color-line)] bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
          >
            {pending.opts.cancelText ?? t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            style={{ background: danger ? "#ff3b30" : "var(--color-primary)" }}
            className="h-10 rounded-full px-5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
          >
            {pending.opts.confirmText ?? t.ui.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------- Prompt UI ----------------------------- */

function PromptHost({
  pending,
  settle,
}: {
  pending: PendingPrompt | null;
  settle: (v: string | null) => void;
}) {
  const { t } = useI18n();
  const mounted = useClientMounted();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const open = !!pending;
  useLockScroll(open);

  useEffect(() => {
    if (pending) setValue(pending.opts.defaultValue ?? "");
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        settle(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, settle]);

  if (!mounted || !pending) return null;

  const submit = () => settle(value);

  return createPortal(
    <div
      data-ui="prompt"
      className="fixed inset-0 z-[130] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={pending.opts.title}
    >
      <div
        className="absolute inset-0 animate-[fadeIn_.18s_ease] bg-black/25 backdrop-blur-[3px]"
        onClick={() => settle(null)}
      />
      <div className="relative w-full animate-[dialogIn_.26s_cubic-bezier(.22,1,.36,1)] rounded-t-[22px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.22)] sm:w-[min(92vw,420px)] sm:rounded-[22px]">
        <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-[var(--color-ink)]">
          {pending.opts.title}
        </h2>
        {pending.opts.description ? (
          <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            {pending.opts.description}
          </p>
        ) : null}

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          inputMode={pending.opts.inputType === "text" ? "text" : "decimal"}
          placeholder={pending.opts.placeholder}
          className="input mt-4 py-2.5 text-sm"
        />

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => settle(null)}
            className="h-10 rounded-full border border-[var(--color-line)] bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
          >
            {pending.opts.cancelText ?? t.common.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            className="h-10 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
          >
            {pending.opts.confirmText ?? t.ui.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
