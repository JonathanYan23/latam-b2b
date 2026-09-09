import Link from "next/link";
import {
  ShoppingBag,
  ArrowRight,
  AlertTriangle,
  CreditCard,
  Wallet,
  FileDown,
  PackageSearch,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { fmt } from "@/i18n/utils";
import {
  date,
  money,
  invoiceStatusLabel,
  paymentMethodLabel,
} from "@/lib/format";
import { termsLabel } from "@/lib/terms";
import { computeOutstanding } from "@/lib/payments";
import { AutoRefresh } from "@/components/auto-refresh";
import { PaymentForm } from "./account/payment-form";

export default async function RetailerHome() {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const retailerId = session.retailerId!;

  const [
    supplierCount,
    orderCount,
    draftOrder,
    approvedRels,
    openInvoices,
    payments,
    invoices,
  ] = await Promise.all([
    db.customerRelationship.count({
      where: { retailerId, status: "APPROVED" },
    }),
    db.order.count({ where: { retailerId, status: { not: "DRAFT" } } }),
    db.order.findFirst({
      where: { retailerId, status: "DRAFT" },
      select: {
        id: true,
        supplierOrders: {
          select: { items: { select: { quantity: true } }, total: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.customerRelationship.findMany({
      where: { retailerId, status: "APPROVED" },
      select: {
        wholesalerId: true,
        paymentTerms: true,
        wholesaler: {
          select: { business: { select: { tradeName: true } } },
        },
      },
    }),
    db.invoice.findMany({
      where: {
        retailerId,
        status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
      include: { wholesaler: { include: { business: true } } },
    }),
    db.payment.findMany({
      where: { retailerId, status: "RECEIVED", paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      take: 8,
      include: { wholesaler: { include: { business: true } } },
    }),
    db.invoice.findMany({
      where: { retailerId },
      orderBy: { createdAt: "desc" },
      include: { wholesaler: { include: { business: true } } },
    }),
  ]);

  // 应付总额与各供应商应付（FIFO 抵扣真实欠款）
  const termsByWs = new Map(
    approvedRels.map((r) => [
      r.wholesalerId,
      { terms: r.paymentTerms, name: r.wholesaler.business.tradeName },
    ]),
  );
  const receivedByWs = new Map<string, number>();
  for (const p of payments) {
    receivedByWs.set(
      p.wholesalerId,
      (receivedByWs.get(p.wholesalerId) ?? 0) + Number(p.amount),
    );
  }
  const byWsInvoices = new Map<string, typeof openInvoices>();
  for (const inv of openInvoices) {
    const arr = byWsInvoices.get(inv.wholesalerId) ?? [];
    arr.push(inv);
    byWsInvoices.set(inv.wholesalerId, arr);
  }
  const wsBalances = new Map<
    string,
    { amount: number; due: Date | null; overdue: boolean }
  >();
  let totalOutstanding = 0;
  for (const [wsId, invs] of byWsInvoices) {
    const owes = computeOutstanding(invs, receivedByWs.get(wsId) ?? 0).total;
    if (owes <= 0) continue;
    totalOutstanding += owes;
    const cur = wsBalances.get(wsId) ?? {
      amount: 0,
      due: null as Date | null,
      overdue: false,
    };
    cur.amount = owes;
    const earliest = invs.reduce<Date | null>(
      (min, inv) =>
        !min || (inv.dueDate && inv.dueDate < min) ? inv.dueDate ?? min : min,
      null,
    );
    cur.due = earliest;
    cur.overdue = invs.some(
      (inv) => inv.dueDate && inv.dueDate < new Date(),
    );
    wsBalances.set(wsId, cur);
  }

  const draftItemCount =
    draftOrder?.supplierOrders.reduce(
      (sum, so) =>
        sum + so.items.reduce((x, i) => x + i.quantity, 0),
      0,
    ) ?? 0;
  const payeeList = [...wsBalances.entries()].map(([id, b]) => ({
    id,
    name: termsByWs.get(id)?.name ?? t.common.supplier,
    outstanding: b.amount,
  }));

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <AutoRefresh />
      {/* 欢迎（简洁一行） */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-h1">
          {session.name
            ? fmt(t.retailerHome.welcomeName, { name: session.name })
            : t.retailerHome.welcome}
        </h1>
        {orderCount === 0 && (
          <Link
            href="/retailer/browse"
            className="btn btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm"
          >
            <PackageSearch className="size-4" /> {t.retailerHome.browseCta}
          </Link>
        )}
      </div>

      {/* 核心数据卡：应付 / 订单 / 供应商 / 购物车草稿 */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link
          href="#finance"
          className="card card-hover flex flex-col p-4"
        >
          <span className="text-meta text-xs">{t.retailerAccount.totalOutstanding}</span>
          <span className="mt-1 truncate text-lg font-semibold">
            {totalOutstanding > 0 ? (
              <span className="amount">{money(totalOutstanding, cur)}</span>
            ) : (
              <span className="text-[var(--color-ink-2)]">{money(0, cur)}</span>
            )}
          </span>
        </Link>
        <Link
          href="/retailer/orders"
          className="card card-hover flex flex-col p-4"
        >
          <span className="text-meta text-xs">{t.nav.orders}</span>
          <span className="mt-1 text-lg font-semibold">{orderCount}</span>
        </Link>
        <Link
          href="/retailer/suppliers"
          className="card card-hover flex flex-col p-4"
        >
          <span className="text-meta text-xs">{t.nav.suppliers}</span>
          <span className="mt-1 text-lg font-semibold">{supplierCount}</span>
        </Link>
        <Link
          href="/retailer/orders/draft"
          className={`card card-hover flex flex-col p-4 ${
            draftItemCount > 0 ? "border-l-4 border-l-[var(--color-accent)]" : ""
          }`}
        >
          <span className="text-meta text-xs">{t.cart.title}</span>
          <span className="mt-1 text-lg font-semibold">{draftItemCount}</span>
          {draftItemCount > 0 && (
            <span className="mt-0.5 text-[11px] font-medium text-[var(--color-accent)]">
              {t.cart.goCheckout} <ArrowRight className="inline size-3" />
            </span>
          )}
        </Link>
      </div>

      {/* 账务中心（首页 × 账户合并：#finance） */}
      <div id="finance" className="mt-9 scroll-mt-20">
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="size-4 text-[var(--color-ink-2)]" />
          <h2 className="text-h2 text-lg">{t.retailerAccount.title}</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* 应付明细（账期本地化 + 到期/逾期） */}
          <div className="card divide-y divide-[var(--color-line-2)] self-start">
            {totalOutstanding === 0 ? (
              <p className="flex items-center gap-3 px-5 py-6 text-sm text-[var(--color-ink-2)]">
                <span className="size-2 rounded-full bg-[var(--color-success)]" />
                {t.retailerHome.payNoInvoices}
              </p>
            ) : (
              [...wsBalances.entries()].map(([wsId, b]) => {
                const meta = termsByWs.get(wsId);
                const name = meta?.name ?? t.common.supplier;
                return (
                  <Link
                    key={wsId}
                    href={`/retailer/suppliers/${wsId}`}
                    className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-bg-subtle)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="text-meta mt-0.5 flex items-center gap-2 text-xs">
                        <span className="badge badge-neutral">
                          {termsLabel(meta?.terms, t)}
                        </span>
                        {b.due && (
                          <span
                            className={
                              b.overdue
                                ? "flex items-center gap-1 text-[var(--color-danger)]"
                                : "text-[var(--color-ink-3)]"
                            }
                          >
                            {b.overdue && <AlertTriangle className="size-3" />}
                            {t.retailerAccount.due}: {date(b.due)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="amount text-sm">{money(b.amount, cur)}</p>
                      <ArrowRight className="size-4 text-[var(--color-ink-3)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-ink)]" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* 记录付款（常驻：无欠款时展示空态说明，避免"找不到框"） + 最近付款 */}
          <div className="flex flex-col gap-4">
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="size-4 text-[var(--color-ink-2)]" />
                <h3 className="text-[14px] font-semibold">
                  {t.retailerAccount.recordPayment}
                </h3>
              </div>
              {payeeList.length > 0 ? (
                <PaymentForm wholesalers={payeeList} currency={cur} t={t} />
              ) : (
                <p className="flex items-center gap-2.5 rounded-lg border border-[var(--color-line-2)] px-3.5 py-3 text-sm text-[var(--color-ink-2)]">
                  <span className="size-2 shrink-0 rounded-full bg-[var(--color-success)]" />
                  {t.retailerHome.payNoInvoices}
                </p>
              )}
            </div>
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold">
                {t.retailerAccount.paymentHistory}
              </h3>
              {payments.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--color-ink-3)]">
                  {t.retailerAccount.noPayments}
                </p>
              ) : (
                <div className="mt-2 space-y-2.5">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-line-2)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">
                          {p.wholesaler.business.tradeName}
                        </p>
                        <p className="text-meta text-[11px]">
                          {date(p.paidAt ?? p.createdAt)} ·{" "}
                          {paymentMethodLabel(p.method, t)}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-semibold">
                        {money(p.amount, cur)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 发票（完整列表，含 PDF 下载） */}
        <h2 id="invoices" className="text-h2 mt-8 scroll-mt-20 text-lg">
          {t.retailerAccount.invoices}
          <span className="text-meta ml-2 text-sm font-normal">{invoices.length}</span>
        </h2>
        {invoices.length === 0 ? (
          <div className="card mt-3 px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">
            {t.common.noResults}
          </div>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="card flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{inv.invoiceNumber}</p>
                    <span className="badge shrink-0">
                      {invoiceStatusLabel(inv.status, t)}
                    </span>
                  </div>
                  <p className="text-meta mt-1 truncate text-sm">
                    {inv.wholesaler.business.tradeName}
                  </p>
                  <p className="text-meta mt-0.5 text-xs">
                    {t.retailerAccount.due}: {date(inv.dueDate)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="amount text-base">{money(inv.amount, cur)}</p>
                  <a
                    href={`/retailer/invoices/${inv.id}/pdf`}
                    className="btn btn-ghost px-2 py-1 text-xs"
                    title="PDF"
                  >
                    <FileDown className="size-3.5" /> {t.retailerAccount.pdf}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
