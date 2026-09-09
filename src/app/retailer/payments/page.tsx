import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { date, money, paymentMethodLabel } from "@/lib/format";

export const metadata = { title: "Payment history" };

/** 完整付款记录：搜索（供应商/单号/金额）+ 付款方式 + 时间范围 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; m?: string; f?: string; t?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD";
  const t = await getDictionary();
  const retailerId = session.retailerId!;
  const { q, m, f, t: ft } = await searchParams;
  const kw = (q ?? "").trim();
  const method = (m ?? "").trim();
  const from = (f ?? "").trim();
  const to = (ft ?? "").trim();
  const hasFilter = Boolean(kw || method || from || to);

  const payments = await db.payment.findMany({
    where: {
      retailerId,
      ...(method ? { method: method as never } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
              ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      wholesaler: { include: { business: true } },
      supplierOrder: { select: { order: { select: { orderNumber: true } } } },
    },
  });

  const isAmount = /^\d+(\.\d+)?$/.test(kw);
  const rows = payments.filter((p) => {
    if (!kw) return true;
    if (isAmount) return Number(p.amount) === parseFloat(kw);
    return (
      (p.wholesaler.business.tradeName ?? "").toLowerCase().includes(kw.toLowerCase()) ||
      (p.wholesaler.business.legalName ?? "").toLowerCase().includes(kw.toLowerCase()) ||
      (p.supplierOrder?.order.orderNumber ?? "").toLowerCase().includes(kw.toLowerCase())
    );
  });

  const METHODS = ["ALL", "BANK_TRANSFER", "CASH", "CARD", "OTHER"];
  const sp = (p2: Record<string, string | undefined>) => {
    const p3 = new URLSearchParams();
    if (kw) p3.set("q", kw);
    if (from) p3.set("f", from);
    if (to) p3.set("t", to);
    for (const [k, v] of Object.entries(p2)) {
      if (v === undefined) p3.delete(k);
      else p3.set(k, v);
    }
    const qs = p3.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/retailer#finance"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.retailerAccount.title}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">{t.retailerAccount.paymentHistory}</h1>
          <p className="text-body mt-1">
            {t.retailerAccount.paymentsRecorded}
            <span className="badge badge-neutral ml-2 align-middle">{rows.length}</span>
          </p>
        </div>
      </div>

      <form method="get" action="/retailer/payments" className="card mt-5 flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-0 flex-1 basis-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input name="q" defaultValue={kw} placeholder={t.retailerAccount.paymentMethod} className="input h-10 pl-9 pr-24 text-sm" />
        </div>
        <label className="text-xs text-[var(--color-ink-2)]">
          {t.retailerAccount.paymentMethod}
          <select name="m" defaultValue={method} className="input mt-1 h-10 px-2 text-sm">
            <option value="">{t.common.all}</option>
            {METHODS.slice(1).map((mt) => (
              <option key={mt} value={mt}>
                {paymentMethodLabel(mt as never, t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--color-ink-2)]">
          {t.orders.dateFrom}
          <input name="f" type="date" defaultValue={from} className="input mt-1 h-10 px-2 text-sm" />
        </label>
        <label className="text-xs text-[var(--color-ink-2)]">
          {t.orders.dateTo}
          <input name="t" type="date" defaultValue={to} className="input mt-1 h-10 px-2 text-sm" />
        </label>
        <button type="submit" className="btn btn-primary h-10 px-4 text-sm">{t.common.search}</button>
        {hasFilter && (
          <Link href="/retailer/payments" className="btn btn-ghost h-10 px-3 text-sm">{t.orders.resetFilter}</Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="card mt-5 px-5 py-10 text-center text-sm text-[var(--color-ink-3)]">
          {t.retailerAccount.noPayments}
        </div>
      ) : (
        <div className="card mt-5 divide-y divide-[var(--color-line-2)] overflow-hidden">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">
                  {p.wholesaler.business.tradeName}
                </p>
                <p className="text-meta mt-0.5 text-xs">
                  {date(p.paidAt ?? p.createdAt)} · {paymentMethodLabel(p.method, t)}
                  {p.supplierOrder?.order.orderNumber && (
                    <span className="ml-1 text-[var(--color-ink-3)]">
                      #{p.supplierOrder.order.orderNumber}
                    </span>
                  )}
                </p>
              </div>
              <span className={`badge ${paymentStatusToneLocal(p.status)}`}>
                {p.status === "RECEIVED"
                  ? t.retailerAccount.confirmed
                  : p.status === "FAILED"
                    ? t.retailerAccount.failed
                    : t.retailerAccount.pending}
              </span>
              <p className="amount w-24 shrink-0 text-right text-sm">{money(p.amount, cur)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function paymentStatusToneLocal(status: string): string {
  if (status === "RECEIVED") return "badge-success";
  if (status === "FAILED") return "badge-danger";
  return "badge-warning";
}
