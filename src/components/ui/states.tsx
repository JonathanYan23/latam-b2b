"use client";

/**
 * 全局状态面板：错误兜底 / 404
 * 均为 client 组件，依赖根布局注入的 I18nProvider 取文案。
 */
import Link from "next/link";
import { AlertTriangle, Compass, Home, RotateCcw } from "lucide-react";
import { useI18n } from "./i18n-provider";

/** 错误兜底面板（ErrorBoundary 用）：重试 + 返回首页 */
export function ErrorPanel({
  error,
  reset,
  homeHref = "/",
}: {
  error?: Error & { digest?: string };
  reset?: () => void;
  homeHref?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md p-7 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--color-danger)]/10">
          <AlertTriangle
            className="size-6 text-[var(--color-danger)]"
            strokeWidth={1.9}
          />
        </span>
        <h1 className="mt-5 text-[20px] font-semibold tracking-tight">
          {t.ui.errorTitle}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {t.ui.errorDesc}
        </p>
        {error?.digest ? (
          <p className="mt-2 font-mono text-[11px] text-[var(--color-ink-3)]">
            {t.ui.errorRef} {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="btn btn-primary h-10 px-5 text-sm"
            >
              <RotateCcw className="size-4" /> {t.ui.errorRetry}
            </button>
          ) : null}
          <Link href={homeHref} className="btn btn-secondary h-10 px-5 text-sm">
            <Home className="size-4" /> {t.ui.errorHome}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** 404 面板 */
export function NotFoundPanel({ homeHref = "/" }: { homeHref?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md p-7 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--color-bg-muted)]">
          <Compass className="size-6 text-[var(--color-ink-2)]" strokeWidth={1.9} />
        </span>
        <p className="mt-5 font-mono text-[12px] font-medium tracking-widest text-[var(--color-ink-3)]">
          404
        </p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight">
          {t.ui.notFoundTitle}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {t.ui.notFoundDesc}
        </p>
        <div className="mt-7">
          <Link href={homeHref} className="btn btn-primary h-10 px-5 text-sm">
            <Home className="size-4" /> {t.ui.notFoundHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
