import type {
  OrderStatus,
  RelationshipStatus,
  InvoiceStatus,
  PaymentMethod,
  SellingMode,
  CustomerTier,
} from "@prisma/client";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";

/** 订单状态标签（按字典） */
export function orderStatusLabel(status: OrderStatus, t: Dict): string {
  return t.statusOrder[status];
}

/** 订单状态 badge 样式（无语言依赖） */
export function orderStatusTone(status: OrderStatus): string {
  const tones: Record<OrderStatus, string> = {
    DRAFT: "badge-neutral",
    SUBMITTED: "badge-info",
    CONFIRMED: "badge-info",
    PREPARING: "badge-warning",
    READY: "badge-success",
    COMPLETED: "badge-success",
    CANCELLED: "badge-danger",
  };
  return tones[status];
}

export function relationshipStatusLabel(status: RelationshipStatus, t: Dict): string {
  return t.statusRelationship[status];
}

export function relationshipStatusTone(status: RelationshipStatus): string {
  const tones: Record<RelationshipStatus, string> = {
    PENDING: "badge-warning",
    APPROVED: "badge-success",
    REJECTED: "badge-danger",
  };
  return tones[status];
}

export function invoiceStatusLabel(status: InvoiceStatus, t: Dict): string {
  return t.statusInvoice[status];
}

export function paymentMethodLabel(method: PaymentMethod, t: Dict): string {
  const map: Record<PaymentMethod, keyof Dict["retailerAccount"]> = {
    BANK_TRANSFER: "bankTransfer",
    CASH: "cash",
    CARD: "card",
    OTHER: "other",
  };
  return t.retailerAccount[map[method]];
}

export function sellingModeLabel(mode: SellingMode, t: Dict): string {
  return t.statusSellingMode[mode];
}

export function tierLabel(tier: CustomerTier, t: Dict): string {
  return t.statusTier[tier];
}

/** 金额格式化（B2B 统一 USD 美元格式，语言无关） */
export function money(
  amount: unknown,
  currency = "USD",
): string {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

const LOCALE_STR: Record<Locale, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
};

/** 日期格式化（按当前语言） */
export function date(
  d: Date | string | null | undefined,
  locale: Locale = "en",
): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString(LOCALE_STR[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
