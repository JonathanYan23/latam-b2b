"use client";

/**
 * AppProviders —— 全局客户端能力装配
 *
 * 顺序：i18n 字典 → Toast → Confirm
 * （Toast / Confirm 的默认文案依赖 i18n，因此 i18n 必须在最外层）
 */
import type { ReactNode } from "react";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { I18nProvider } from "./i18n-provider";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirm";
import { RouteProgress } from "./route-progress";
import { OfflineBanner } from "./offline-banner";

export function AppProviders({
  t,
  locale,
  children,
}: {
  t: Dict;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <I18nProvider t={t} locale={locale}>
      <ToastProvider>
        <ConfirmProvider>
          {children}
          {/* 全局感知层：路由进度条 + 断网提示 */}
          <RouteProgress />
          <OfflineBanner />
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
