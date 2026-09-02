import Link from "next/link";
import { Wallet, CreditCard, FileDown } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import {
  money,
  date,
  invoiceStatusLabel,
  paymentMethodLabel,
} from "@/lib/format";
import { PaymentForm } from "./payment-form";
import { computeOutstanding } from "@/lib/payments";

export const metadata = { title: "Payments & Accounts" };

export default async function RetailerAccountPage() {
  const session = await requireRole("RETAILER");
  const t = await getDictionary();
  const retailerId = session.retailerId!;

  const [invoices, payments] = await Promise.all([
    db.invoice.findMany({
      where: { retailerId },
      orderBy: { createdAt: "desc" },
      include: { wholesaler: { include: { business: true } } },
    }),
    db.payment.findMany({
      where: { retailerId },
      orderBy: { createdAt: "desc" },
      include: { wholesaler: { include: { business: true } } },
    }),
  ]);

  const openInvoices = invoices.filter(
    (inv) => inv.status !== "PAID" && inv.status !== "CANCELLED",
  );
  // 每张发票真实欠款 = 发票额 − FIFO 已抵（按到期日升序抵扣）
  const receivedTotal = payments
    .filter((p) => p.status === "RECEIVED" && p.paidAt)
    .reduce((s, p) => s + Number(p.amount), 0);
  const { perInvoice, total: totalOutstanding } = computeOutstanding(
    [...openInvoices].sort(
      (a, b) =>
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
    ),
    receivedTotal,
  );

  const wsList = new Map<string, { name: string; outstanding: number }>();
  for (const inv of openInvoices) {
    const owes = perInvoice.get(inv.id) ?? 0;
    if (owes <= 0) continue;
    const cur = wsList.get(inv.wholesalerId) ?? {
      name: inv.wholesaler.business.tradeName ?? t.common.supplier,
      outstanding: 0,
    };
    cur.outstanding += owes;
    wsList.set(inv.wholesalerId, cur);
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <h1 className="text-h1">{t.retailerAccount.title}</h1>
      <p className="text-body mt-1">{t.retailerAccount.desc}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <Wallet className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="mt-3 text-lg font-semibold">{money(totalOutstanding)}</p>
          <p className="text-meta mt-0.5">{t.retailerAccount.totalOutstanding}</p>
        </div>
        <div className="card p-5">
          <p className="text-meta text-xs">{t.retailerAccount.openInvoices}</p>
          <p className="mt-1 text-lg font-semibold">
            {
              invoices.filter(
                (i) => i.status !== "PAID" && i.status !== "CANCELLED",
              ).length
            }
          </p>
        </div>
        <div className="card p-5">
          <p className="text-meta text-xs">{t.retailerAccount.paymentsRecorded}</p>
          <p className="mt-1 text-lg font-semibold">{payments.length}</p>
        </div>
      </div>

      {/* 付款（紧随概览，无需下拉即可操作） */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="size-5 text-[var(--color-ink-2)]" />
            <h2 className="text-h3 text-[15px]">{t.retailerAccount.recordPayment}</h2>
          </div>
          <PaymentForm
            wholesalers={[...wsList.entries()].map(([id, w]) => ({
              id,
              name: w.name,
              outstanding: w.outstanding,
            }))}
            t={t}
          />
        </div>

        <div className="card p-6">
          <h2 className="text-h3 mb-4 text-[15px]">
            {t.retailerAccount.paymentHistory}
          </h2>
          {payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-ink-3)]">
              {t.retailerAccount.noPayments}
            </p>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-line-2)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {p.wholesaler.business.tradeName}
                    </p>
                    <p className="text-meta text-xs">
                      {date(p.paidAt ?? p.createdAt)} ·{" "}
                      {paymentMethodLabel(p.method, t)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{money(p.amount)}</p>
                    <span
                      className={`badge text-[11px] ${
                        p.status === "RECEIVED"
                          ? "badge-success"
                          : p.status === "FAILED"
                            ? "badge-danger"
                            : "badge-warning"
                      }`}
                    >
                      {p.status === "RECEIVED"
                        ? t.retailerAccount.confirmed
                        : p.status === "FAILED"
                          ? t.retailerAccount.failed
                          : t.retailerAccount.pending}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* 应付明细 */}
      <h2 className="text-h2 mt-10 text-lg">{t.retailerAccount.balanceBySupplier}</h2>
      <div className="card mt-3 overflow-hidden">
        {wsList.size === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">
            {t.retailerAccount.noBalance}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line-2)] text-meta">
                <th className="px-5 py-3 font-medium">{t.retailerAccount.wholesaler}</th>
                <th className="px-5 py-3 font-medium">{t.retailerAccount.outstanding}</th>
              </tr>
            </thead>
            <tbody>
              {[...wsList.entries()].map(([id, w]) => (
                <tr
                  key={id}
                  className="border-b border-[var(--color-line-2)] last:border-0"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/retailer/suppliers/${id}`}
                      className="font-medium hover:underline"
                    >
                      {w.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 font-semibold">{money(w.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 发票列表 */}
      <h2 className="text-h2 mt-10 text-lg">{t.retailerAccount.invoices}</h2>
      {invoices.length === 0 ? (
        <div className="card mt-3 px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">
          {t.common.noResults}
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {invoices.map((inv) => (
            <div key={inv.id} className="card flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{inv.invoiceNumber}</p>
                  <span className="badge shrink-0">{invoiceStatusLabel(inv.status, t)}</span>
                </div>
                <p className="text-meta mt-1 truncate text-sm">
                  {inv.wholesaler.business.tradeName}
                </p>
                <p className="text-meta mt-0.5 text-xs">
                  {t.retailerAccount.due}: {date(inv.dueDate)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <p className="text-base font-semibold">{money(inv.amount)}</p>
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
  );
}
