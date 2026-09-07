import Link from "next/link";
import { ShoppingBag, ArrowRight, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { fmt } from "@/i18n/utils";
import { date, money, orderStatusLabel, orderStatusTone } from "@/lib/format";
import { computeOutstanding } from "@/lib/payments";

export default async function RetailerHome() {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const retailerId = session.retailerId!;

  const [
    supplierCount,
    orderCount,
    recentOrders,
    approvedRels,
    openInvoices,
    receivedPayments,
  ] = await Promise.all([
    db.customerRelationship.count({
      where: { retailerId, status: "APPROVED" },
    }),
    db.order.count({ where: { retailerId } }),
    db.order.findMany({
        where: { retailerId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          supplierOrders: {
            include: { wholesaler: { include: { business: true } } },
          },
        },
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
        include: {
          wholesaler: { include: { business: true } },
        },
      }),
      db.payment.findMany({
        where: { retailerId, status: "RECEIVED", paidAt: { not: null } },
        select: { wholesalerId: true, amount: true },
      }),
    ]);

  // 已确认收款按供应商累计（FIFO 抵扣每张发票的真实欠款）
  const termsByWs = new Map(
    approvedRels.map((r) => [
      r.wholesalerId,
      { terms: r.paymentTerms, name: r.wholesaler.business.tradeName },
    ]),
  );
  const receivedByWs = new Map<string, number>();
  for (const p of receivedPayments) {
    receivedByWs.set(
      p.wholesalerId,
      (receivedByWs.get(p.wholesalerId) ?? 0) + Number(p.amount),
    );
  }
  const wsBalances = new Map<
    string,
    { amount: number; due: Date | null; overdue: boolean }
  >();
  let totalOutstanding = 0;
  const byWsInvoices = new Map<string, typeof openInvoices>();
  for (const inv of openInvoices) {
    const arr = byWsInvoices.get(inv.wholesalerId) ?? [];
    arr.push(inv);
    byWsInvoices.set(inv.wholesalerId, arr);
  }
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
    const overdue = invs.some(
      (inv) => inv.dueDate && inv.dueDate < new Date(),
    );
    if (overdue) cur.overdue = true;
    wsBalances.set(wsId, cur);
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      {/* 欢迎（精简：只保留问候） */}
      <h1 className="text-h1">
        {session.name
          ? fmt(t.retailerHome.welcomeName, { name: session.name })
          : t.retailerHome.welcome}
      </h1>

      {/* 核心数据栏：待付款 / 订单 / 供应商 */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Link
          href="/retailer/account"
          className="card card-hover flex flex-col p-4"
        >
          <span className="text-meta text-xs">{t.retailerAccount.totalOutstanding}</span>
          <span className="mt-1 truncate text-lg font-semibold">
            {totalOutstanding > 0 ? (
              <span className="amount">{money(totalOutstanding, cur)}</span>
            ) : (
              <span className="text-[var(--color-ink-2)]">
                {money(0, cur)}
              </span>
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
      </div>

      {/* 快捷入口（极简文字入口） */}
      <div className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-2">
        {[
          { href: "/retailer/browse", label: t.retailerHome.browseTitle },
          { href: "/retailer/orders", label: t.nav.orders },
          { href: "/retailer/account", label: t.retailerAccount.title },
        ].map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="group inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          >
            {e.label}
            <ArrowRight className="size-3.5 text-[var(--color-ink-3)] transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {/* 应付账款 · 各供应商应付明细 */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h2 text-lg">{t.retailerHome.payHeader}</h2>
          {totalOutstanding > 0 && (
            <Link
              href="/retailer/account"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
            >
              {t.retailerAccount.recordPayment}{" "}
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>

        {totalOutstanding === 0 ? (
          <div className="card flex items-center gap-3 px-5 py-4 text-sm text-[var(--color-ink-2)]">
            <span className="size-2 rounded-full bg-[var(--color-success)]" />
            {t.retailerHome.payNoInvoices}
          </div>
        ) : (
          <div className="card divide-y divide-[var(--color-line-2)]">
            {[...wsBalances.entries()].map(([wsId, b]) => {
              const meta = termsByWs.get(wsId);
              const name = meta?.name ?? t.common.supplier;
              return (
                <Link
                  key={wsId}
                  href="/retailer/account"
                  className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-bg-subtle)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-meta mt-0.5 flex items-center gap-2 text-xs">
                      <span className="badge badge-neutral">
                        {t.common.terms}: {meta?.terms ?? "—"}
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
            })}
          </div>
        )}
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h2 text-lg">{t.retailerHome.recentOrders}</h2>
          <Link
            href="/retailer/orders"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
          >
            {t.common.viewAll} <ArrowRight className="size-4" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <ShoppingBag
              className="mb-4 size-8 text-[var(--color-ink-3)]"
              strokeWidth={1.5}
            />
            <p className="text-h3 text-base">{t.retailerHome.noOrdersTitle}</p>
            <p className="text-meta mt-1.5 max-w-sm">
              {t.retailerHome.noOrdersDesc}
            </p>
            <Link
              href="/retailer/browse"
              className="btn btn-primary mt-6 px-5 py-2 text-sm"
            >
              {t.retailerHome.browseCta}
            </Link>
          </div>
        ) : (
          <>
            {/* 桌面：表格 */}
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line-2)] text-meta">
                    <th className="whitespace-nowrap px-5 py-3 font-medium">{t.orders.orderNumber}</th>
                    <th className="px-5 py-3 font-medium">{t.orders.suppliers}</th>
                    <th className="hidden whitespace-nowrap px-5 py-3 font-medium sm:table-cell">
                      {t.common.date}
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">{t.common.total}</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => {
                    const so = o.supplierOrders[0];
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-[var(--color-line-2)] last:border-0"
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 font-medium">#{o.orderNumber}</td>
                        <td className="max-w-[200px] truncate px-5 py-3.5 text-[var(--color-ink-2)]">
                          {so?.wholesaler.business.tradeName ?? "—"}
                        </td>
                        <td className="hidden whitespace-nowrap px-5 py-3.5 text-[var(--color-ink-3)] sm:table-cell">
                          {date(o.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 font-medium">
                          {money(so?.total, o.currency)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span className={`badge ${orderStatusTone(o.status)}`}>
                            {orderStatusLabel(o.status, t)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 手机：卡片式（无需横向拖动） */}
            <div className="grid gap-2.5 md:hidden">
              {recentOrders.map((o) => {
                const so = o.supplierOrders[0];
                return (
                  <Link
                    key={o.id}
                    href={`/retailer/orders/${o.id}`}
                    className="card card-hover flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        #{o.orderNumber}
                      </span>
                      <span className="text-meta mt-0.5 block truncate text-xs">
                        {so?.wholesaler.business.tradeName ?? "—"} · {date(o.createdAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold">
                        {money(so?.total, o.currency)}
                      </span>
                      <span className={`badge ${orderStatusTone(o.status)}`}>
                        {orderStatusLabel(o.status, t)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
