"use client";

/**
 * Toast —— 品牌级全局轻提示（出厂级反馈层）
 *
 * 替代原生 alert / 散落的 DOM hack：
 *  - 堆叠展示（最多同时 4 条），带类型图标与语义色
 *  - 自动消失，鼠标悬停暂停倒计时（进度条同步暂停）
 *  - 支持可点击动作（如「查看购物车」）
 *  - 通过 portal 挂到 body，避免被 header 的 backdrop-filter 影响定位
 *
 * 用法：
 *   const toastApi = useToast();
 *   toastApi.success("已加入购物车");
 *   toastApi.error("库存不足", { description: "仅剩 3 件" });
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "./i18n-provider";
import { useClientMounted } from "./use-mounted";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type?: ToastType;
  description?: string;
  /** 毫秒；0 表示不自动关闭（需手动关闭） */
  duration?: number;
  action?: ToastAction;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  description?: string;
  duration: number;
  action?: ToastAction;
}

export interface ToastApi {
  toast: (message: string, opts?: ToastOptions) => number;
  success: (message: string, opts?: Omit<ToastOptions, "type">) => number;
  error: (message: string, opts?: Omit<ToastOptions, "type">) => number;
  warning: (message: string, opts?: Omit<ToastOptions, "type">) => number;
  info: (message: string, opts?: Omit<ToastOptions, "type">) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** 同屏最多保留的提示条数（超出丢弃最早的） */
const MAX_TOASTS = 4;

const STYLE: Record<
  ToastType,
  { icon: LucideIcon; color: string; soft: string }
> = {
  success: { icon: CheckCircle2, color: "#34c759", soft: "rgba(52,199,89,.12)" },
  error: { icon: XCircle, color: "#ff3b30", soft: "rgba(255,59,48,.12)" },
  warning: {
    icon: AlertTriangle,
    color: "#ff9500",
    soft: "rgba(255,149,0,.12)",
  },
  info: { icon: Info, color: "#0071e3", soft: "rgba(0,113,227,.12)" },
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message: string, opts?: ToastOptions): number => {
    const id = ++idRef.current;
    const type = opts?.type ?? "success";
    setItems((prev) => [
      ...prev.slice(-(MAX_TOASTS - 1)),
      {
        id,
        message,
        type,
        description: opts?.description,
        action: opts?.action,
        duration:
          opts?.duration ?? (type === "error" ? 4500 : type === "warning" ? 3600 : 2600),
      },
    ]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (m, o) => push(m, { ...o, type: "success" }),
      error: (m, o) => push(m, { ...o, type: "error" }),
      warning: (m, o) => push(m, { ...o, type: "warning" }),
      info: (m, o) => push(m, { ...o, type: "info" }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const mounted = useClientMounted();
  if (!mounted || items.length === 0) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(74px+env(safe-area-inset-bottom))] z-[120] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-5 md:right-5 md:items-end md:px-0"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const { t } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const style = STYLE[item.type];
  const Icon = style.icon;

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => onDismiss(item.id), 180);
  }, [item.id, onDismiss]);

  return (
    <div
      data-ui="toast"
      role={item.type === "error" ? "alert" : "status"}
      aria-live={item.type === "error" ? "assertive" : "polite"}
      className={`toast-card pointer-events-auto relative w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 shadow-[0_10px_36px_rgba(0,0,0,.14)] backdrop-blur-xl transition-all duration-200 ${
        leaving
          ? "translate-y-1.5 scale-[0.98] opacity-0"
          : "animate-[toastIn_.3s_cubic-bezier(.22,1,.36,1)]"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span
          className="mt-px grid size-6 shrink-0 place-items-center rounded-full"
          style={{ background: style.soft }}
        >
          <Icon className="size-3.5" style={{ color: style.color }} strokeWidth={2.2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-[var(--color-ink)]">
            {item.message}
          </p>
          {item.description ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
              {item.description}
            </p>
          ) : null}
          {item.action ? (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                close();
              }}
              className="mt-2 text-[12px] font-semibold text-[var(--color-primary)] transition-opacity hover:opacity-70"
            >
              {item.action.label}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={t.ui.close}
          onClick={close}
          className="-mr-1 -mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[var(--color-ink-3)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-ink-2)]"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {item.duration > 0 ? (
        <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-black/[0.04]">
          <div
            className="toast-bar h-full"
            style={{
              background: style.color,
              animationDuration: `${item.duration}ms`,
            }}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
