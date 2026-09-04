import { DollarSign, AlertTriangle, ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import {
  money,
  date,
  invoiceStatusLabel,
  paymentMethodLabel,
} from "@/lib/format";
import { fmt } from "@/i18n/utils";
import { ConfirmPaymentButton } from "./confirm-payment";
import { PolicyForm } from "./policy-form";
import { computeOutstanding } from "@/lib/payments";

export const metadata = { title: "Accounts Receivable" };

export default async function WholesalerAccountPage() {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;

  const [wholesaler, invoices, payments, pendingPayments] = await Promise.all([
    db.wholesaler.findUnique({
      where: { id: wholesalerId },
      select: { minOrderAmount: true },
    }),
    db.invoice.findMany({
      where: {
        wholesalerId,
        status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
      include: { retailer: { include: { business: true } } },
    }),
    db.payment.findMany({
      where: { wholesalerId, status: "RECEIVED" },
      orderBy: { paidAt: "desc" },
      take: 20,
      include: { retailer: { include: { business: true } } },
    }),
    db.payment.findMany({
      where: { wholesalerId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { retailer: { include: { business: true } } },
    }),
  ]);

  // 已收总额按客户分组（发票按到期日升序，FIFO 逐客户抵扣）
  const allReceived = await db.payment.findMany({
    where: { wholesalerId, status: "RECEIVED", paidAt: { not: null } },
    select: { retailerId: true, amount: true },
  });
  const byCustomer = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const arr = byCustomer.get(inv.retailerId) ?? [];
    arr.push(inv);
    byCustomer.set(inv.retailerId, arr);
  }
  const receivedByCustomer = new Map<string, number>();
  for (const p of allReceived) {
    receivedByCustomer.set(
      p.retailerId,
      (receivedByCustomer.get(p.retailerId) ?? 0) + Number(p.amount),
    );
  }
  const perInvoiceOwes = new Map<string, number>();
  let totalOutstanding = 0;
  for (const [rtId, invs] of byCustomer) {
    const r = computeOutstanding(invs, receivedByCustomer.get(rtId) ?? 0);
    for (const [invId, owes] of r.perInvoice) perInvoiceOwes.set(invId, owes);
    totalOutstanding += r.total;
  }
  const now = new Date();
  const overdueCount = invoices.filter(
    (i) => i.dueDate && i.dueDate < now,
  ).length;

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <h1 className="text-h1">{t.wsAccount.title}</h1>
      <p className="text-body mt-1">{t.wsAccount.desc}</p>

      {/* 订单与付款政策 */}
      <div className="card mt-8 p-5">
        <h2 className="text-h3 text-[15px]">{t.wsAccount.policyTitle}</h2>
        <p className="text-meta mt-1 text-xs">{t.wsAccount.policyDesc}</p>
        <PolicyForm
          current={
            wholesaler?.minOrderAmount ? Number(wholesaler.minOrderAmount) : null
          }
          t={t}
        />
      </div>

      {/* 概览 */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: <DollarSign className="size-4" />,
            label: t.wsAccount.totalOutstanding,
            value: money(totalOutstanding, cur),
          },
          {
            icon: <ListChecks className="size-4" />,
            label: t.wsAccount.pendingConfirmations,
            value: String(pendingPayments.length),
          },
          {
            icon: (
              <AlertTriangle
                className={`size-4 ${overdueCount ? "text-[var(--color-danger)]" : ""}`}
              />
            ),
            label: t.wsAccount.overdueInvoices,
            value: String(overdueCount),
          },
        ].map((c, i) => (
          <div key={i} className="card p-5">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)] text-[var(--color-ink-2)]">
              {c.icon}
            </span>
            <p className="mt-3 text-lg font-semibold leading-tight">{c.value}</p>
            <p className="text-meta mt-1 text-xs">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 待确认付款 */}
      {pendingPayments.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold">{t.wsAccount.awaiting}</h2>
          <div className="card mt-3 divide-y divide-[var(--color-line-2)]">
            {pendingPayments.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium">
                    {p.retailer.business.tradeName} —{" "}
                    <span className="font-semibold">{money(p.amount, cur)}</span>
                  </p>
                  <p className="text-meta text-xs">
                    {date(p.createdAt)} · {paymentMethodLabel(p.method, t)}
                    {p.notes && ` · ${p.notes}`}
                  </p>
                </div>
                <ConfirmPaymentButton paymentId={p.id} defaultName={session.name ?? ""} t={t} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* 客户应收明细 */}
      <h2 className="mt-10 text-lg font-semibold">{t.wsAccount.customerOutstanding}</h2>
      {invoices.length === 0 ? (
        <div className="card mt-3 px-5 py-10 text-center text-sm text-[var(--color-ink-3)]">
          {t.wsAccount.allCaughtUp}
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {invoices.map((inv) => {
            const overdue = inv.dueDate && inv.dueDate < now;
            const owes = perInvoiceOwes.get(inv.id) ?? Number(inv.amount);
            return (
              <div key={inv.id} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">
                      {inv.retailer.business.tradeName}
                    </p>
                    <span
                      className={`badge shrink-0 ${
                        inv.status === "OVERDUE"
                          ? "badge-danger"
                          : inv.status === "PARTIALLY_PAID"
                            ? "badge-warning"
                            : "badge-neutral"
                      }`}
                    >
                      {invoiceStatusLabel(inv.status, t)}
                    </span>
                  </div>
                  <p className="text-meta mt-1 text-xs">{inv.invoiceNumber}</p>
                  <p className={`mt-0.5 flex items-center gap-1 text-xs ${overdue ? "text-[var(--color-danger)]" : "text-[var(--color-ink-3)]"}`}>
                    {overdue && <AlertTriangle className="size-3" />}
                    {t.retailerAccount.due}: {date(inv.dueDate)}
                  </p>
                  {owes < Number(inv.amount) && (
                    <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">
                      {t.retailerAccount.paid}: {money(Number(inv.amount) - owes, cur)}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-base font-semibold">{money(owes, cur)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* 收款历史 */}
      <h2 className="mt-10 text-lg font-semibold">{t.wsAccount.paymentHistory}</h2>
      <div className="card mt-3 divide-y divide-[var(--color-line-2)]">
        {payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">
            {t.wsAccount.noPayments}
          </p>
        ) : (
          payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-5 py-4"
            >
              <div>
                <p className="text-sm font-medium">
                  {p.retailer.business.tradeName}
                </p>
                <p className="text-meta text-xs">
                  {date(p.paidAt ?? p.createdAt)} ·{" "}
                  {paymentMethodLabel(p.method, t)}
                </p>
                {p.confirmedByName && (
                  <p className="text-meta mt-0.5 text-xs">
                    {fmt(t.wsAccount.confirmedBy, { name: p.confirmedByName })}
                  </p>
                )}
              </div>
              <p className="text-sm font-semibold">{money(p.amount, cur)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
