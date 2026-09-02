import { cookies } from "next/headers";
import type en from "./dict/en";
import { COOKIE_NAME, DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import enDict from "./dict/en";
import zhDict from "./dict/zh";
import esDict from "./dict/es";

export type Dict = typeof en;

const dicts: Record<Locale, Dict> = {
  en: enDict,
  zh: zhDict,
  es: esDict,
};

/** 按语言取字典（server action / 非组件场景用） */
export function dictForLocale(locale: Locale): Dict {
  return dicts[locale];
}

/** 从 cookie 读取当前语言（服务端） */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const v = cookieStore.get(COOKIE_NAME)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** 获取当前语言字典（服务端组件用） */
export async function getDictionary(): Promise<Dict> {
  return dicts[await getLocale()];
}

/** 读取 cookie 语言（供 server action 使用） */
export async function getActionLocale(): Promise<Locale> {
  return getLocale();
}

// fmt 由 @/i18n/utils 提供（纯函数，client/server 通用）
