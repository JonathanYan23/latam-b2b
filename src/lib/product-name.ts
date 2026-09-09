/**
 * 商品多语言品名：买家看到的品名自动匹配其界面语言。
 * 供应商上架时录入主名（name）+ 可选三语品名；缺失语言回退主名。
 * zh / en / es 三档与平台界面语言一致。
 */

export interface LocalizedName {
  name: string;
  nameZh?: string | null;
  nameEn?: string | null;
  nameEs?: string | null;
}

/** 取某界面语言下应展示的商品名（缺省回退 name） */
export function productName(p: LocalizedName, locale: string): string {
  if (locale === "zh" && p.nameZh) return p.nameZh;
  if (locale === "en" && p.nameEn) return p.nameEn;
  if (locale === "es" && p.nameEs) return p.nameEs;
  return p.name;
}
