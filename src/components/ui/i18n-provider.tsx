"use client";

/**
 * Client 端字典注入
 *
 * 根布局（server）把当前语言字典 + locale 一次性注入，
 * 任意 client 组件都可用 `useI18n()` 取到，无需层层透传 props。
 * 用于 Toast / ConfirmDialog 等全局反馈组件的默认文案。
 */
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";

interface I18nValue {
  t: Dict;
  locale: Locale;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  t,
  locale,
  children,
}: I18nValue & { children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ t, locale }}>
      {children}
    </I18nContext.Provider>
  );
}

/** 取得当前语言字典；必须在 <I18nProvider> 内使用 */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within <I18nProvider>");
  }
  return ctx;
}
