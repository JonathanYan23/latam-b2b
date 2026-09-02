// =============================================================
// 拉美国家 × 货币（注册时选择国家 → 自动带该国货币）
// 说明：当前为「符号随国家」模式（金额数值仍为美元定价值），
//       未来接入汇率表后，在此处换算即可（money() 单点升级）。
// =============================================================

export interface LatamCountry {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  nameEs: string;
  currency: string; // ISO 4217
}

export const LATAM_COUNTRIES: LatamCountry[] = [
  { code: "DO", name: "Dominican Republic", nameEs: "República Dominicana", currency: "DOP" },
  { code: "PA", name: "Panama", nameEs: "Panamá", currency: "PAB" },
  { code: "CO", name: "Colombia", nameEs: "Colombia", currency: "COP" },
  { code: "MX", name: "Mexico", nameEs: "México", currency: "MXN" },
  { code: "BR", name: "Brazil", nameEs: "Brasil", currency: "BRL" },
  { code: "AR", name: "Argentina", nameEs: "Argentina", currency: "ARS" },
  { code: "CL", name: "Chile", nameEs: "Chile", currency: "CLP" },
  { code: "PE", name: "Peru", nameEs: "Perú", currency: "PEN" },
  { code: "EC", name: "Ecuador", nameEs: "Ecuador", currency: "USD" },
  { code: "VE", name: "Venezuela", nameEs: "Venezuela", currency: "VES" },
  { code: "CR", name: "Costa Rica", nameEs: "Costa Rica", currency: "CRC" },
  { code: "GT", name: "Guatemala", nameEs: "Guatemala", currency: "GTQ" },
  { code: "UY", name: "Uruguay", nameEs: "Uruguay", currency: "UYU" },
  { code: "PY", name: "Paraguay", nameEs: "Paraguay", currency: "PYG" },
  { code: "BO", name: "Bolivia", nameEs: "Bolivia", currency: "BOB" },
];

export const COUNTRY_CURRENCY: Record<string, string> = Object.fromEntries(
  LATAM_COUNTRIES.map((c) => [c.code, c.currency]),
);

/** 货币 → 展示符号（避免多个拉美国家共用 $ 造成混淆，用带国别前缀的写法） */
export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  DOP: "RD$",
  PAB: "B/",
  COP: "COL$",
  MXN: "MX$",
  BRL: "R$",
  ARS: "ARS$",
  CLP: "CL$",
  PEN: "S/",
  VES: "Bs",
  CRC: "₡",
  GTQ: "Q",
  UYU: "$U",
  PYG: "₲",
  BOB: "Bs",
};

/** 取货币符号；未知货币回落美元符号 */
export function currencySymbol(currency?: string | null): string {
  if (!currency) return "$";
  return CURRENCY_SYMBOL[currency] ?? `$(${currency})`;
}
