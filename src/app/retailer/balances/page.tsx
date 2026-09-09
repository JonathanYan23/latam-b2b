import Link from "next/link";
import { Search, AlertTriangle, ArrowLeft, FileDown } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { fmt } from "@/i18n/utils";
import { date, money, invoiceStatusLabel } from "@/lib/format";
import { termsLabel } from "@/lib/terms";
import { computeOutstanding } from "@/lib/payments";

export const metadata = { title: "Balances" };

/** 账款明细（应付）：未付发票逐笔 + 真实欠款（FIFO 抵扣）+ 搜索/账期状态/到期时间 */
export default async function BalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; s?: string; f?: string; t?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD";
  const t = await getDictionary();
  const retailerId = session.retailerId!;
  const { q, s, f, t: ft } = await searchParams;
  const kw = (q ?? "").trim();
  const status = (s ?? "ALL").toUpperCase();
  const from = (f ?? "").trim();
  const to = (ft ?? "").trim();
  const hasFilter = Boolean(kw || from || to || status !== "ALL");
  const today = new Date();

  const [openInvoices, payments] = await Promise.all([
    db.invoice.findMany({
      where: {
        retailerId,
        status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
        ...(from || to
          ? {
              dueDate: {
                ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: { wholesaler: { include: { business: true } } },
    }),
    db.payment.findMany({
      where: { retailerId, status: "RECEIVED", paidAt: { not: null } },
      select: { wholesalerId: true, amount: true },
    }),
  ]);

  // 每供应商收款合计 → 每发票真实剩余（按到期升序 FIFO）
  const receivedByWs = new Map<string, number>();
  for (const p of payments) {
    receivedByWs.set(p.wholesalerId, (receivedByWs.get(p.wholesalerId) ?? 0) + Number(p.amount));
  }
  const perInvoice = new Map<string, number>();
  const byWs = new Map<string, typeof openInvoices>();
  for (const inv of openInvoices) {
    const arr = byWs.get(inv.wholesalerId) ?? [];
    arr.push(inv);
    byWs.set(inv.wholesalerId, arr);
  }
  for (const [wsId, invs] of byWs) {
    const { perInvoice: per } = computeOutstanding(invs, receivedByWs.get(wsId) ?? 0);
    for (const [id, v] of per) if (v > 0) perInvoice.set(id, v);
  }

  const rows = openInvoices
    .filter((inv) => {
      if (status === "OVERDUE") return inv.dueDate && inv.dueDate < today;
      if (status !== "ALL" && inv.status !== status) return false;
      if (!kw) return true;
      const hit =
        inv.invoiceNumber.toLowerCase().includes(kw.toLowerCase()) ||
        (inv.wholesaler.business.tradeName ?? "")
          .toLowerCase()
          .includes(kw.toLowerCase()) ||
        (inv.wholesaler.business.legalName ?? "")
          .toLowerCase()
          .includes(kw.toLowerCase());
      return hit;
    })
    .filter((inv) => (perInvoice.get(inv.id) ?? 0) > 0);

  const totalDue = rows.reduce((sum, inv) => sum + (perInvoice.get(inv.id) ?? 0), 0);
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
  const CHIPS = ["ALL", "OVERDUE", "UNPAID", "PARTIALLY_PAID"];

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
          <h1 className="text-h1">{t.retailerAccount.balanceBySupplier}</h1>
          <p className="text-body mt-1">
            {t.retailerHome.payHeader}
            <span className="badge badge-neutral ml-2 align-middle">{rows.length}</span>
          </p>
        </div>
        <p className="amount text-lg">{money(totalDue, cur)}</p>
      </div>

      {/* 搜索 + 到期时间 */}
      <form method="get" action="/retailer/balances" className="card mt-5 flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-0 flex-1 basis-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input name="q" defaultValue={kw} placeholder={t.retailerAccount.searchBalances} className="input h-10 pl-9 pr-24 text-sm" />
        </div>
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
          <Link href="/retailer/balances" className="btn btn-ghost h-10 px-3 text-sm">{t.orders.resetFilter}</Link>
        )}
      </form>

      {/* 账期状态 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CHIPS.map((st) => {
          const active = status === st;
          const label =
            st === "ALL" ? t.common.all : st === "OVERDUE" ? t.statusInvoice.OVERDUE : invoiceStatusLabel(st as never, t);
          return (
            <Link
              key={st}
              href={`/retailer/balances${sp({ s: st === "ALL" ? undefined : st })}`}
              className={
                active
                  ? "rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full border border-[var(--color-line-2)] px-3 py-1.5 text-xs text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="card mt-5 flex flex-col items-center px-6 py-14 text-center">
          <p className="text-h3 text-base">{t.retailerHome.payNoInvoices}</p>
        </div>
      ) : (
        <div className="card mt-5 divide-y divide-[var(--color-line-2)] overflow-hidden">
          {rows.map((inv) => {
            const overdue = !!inv.dueDate && inv.dueDate < today;
            const remain = perInvoice.get(inv.id) ?? 0;
            return (
              <div key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {inv.invoiceNumber}
                    {overdue && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-danger)]">
                        <AlertTriangle className="size-3" /> {t.statusInvoice.OVERDUE}
                      </span>
                    )}
                  </p>
                  <p className="text-meta mt-0.5 truncate text-xs">
                    {inv.wholesaler.business.tradeName}
                  </p>
                </div>
                <div className="hidden shrink-0 text-xs text-[var(--color-ink-3)] sm:block">
                  <p>{t.retailerAccount.due}: {date(inv.dueDate)}</p>
                  <p className="mt-0.5">
                    {termsLabel(inv.wholesaler.paymentTerms, t)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`badge ${invoiceStatusToneLocal(inv.status, overdue)}`}>
                    {overdue ? t.statusInvoice.OVERDUE : invoiceStatusLabel(inv.status, t)}
                  </span>
                  <p className="amount w-24 text-right text-sm">{money(remain, cur)}</p>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between bg-[var(--color-bg-subtle)] px-5 py-3">
            <span className="text-sm font-medium">{t.cart.cartTotal}</span>
            <span className="amount text-sm font-semibold">{money(totalDue, cur)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function invoiceStatusToneLocal(status: string, overdue: boolean): string {
  if (overdue || status === "OVERDUE") return "badge-danger";
  if (status === "UNPAID") return "badge-warning";
  if (status === "PARTIALLY_PAID") return "badge-neutral";
  return "badge-success";
}
