import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { fmt } from "@/i18n/utils";
import {
  money,
  date,
  orderStatusLabel,
  orderStatusTone,
  invoiceStatusLabel,
} from "@/lib/format";
import { CancelOrderButton } from "../cancel-order-button";

export default async function RetailerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("RETAILER");
  const t = await getDictionary();
  const retailerId = session.retailerId!;
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      retailer: { include: { business: true } },
      supplierOrders: {
        include: {
          wholesaler: {
            include: { business: true, user: { select: { name: true } } },
          },
          items: true,
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              amount: true,
              status: true,
              dueDate: true,
            },
            take: 1,
          },
        },
      },
    },
  });
  if (!order || order.retailerId !== retailerId) notFound();

  const total = order.supplierOrders.reduce((s, so) => s + Number(so.total), 0);

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/retailer/orders"
        className="text-meta mb-5 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.orders.backToOrders}
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-h1">#{order.orderNumber}</h1>
            <span className={`badge ${orderStatusTone(order.status)}`}>
              {orderStatusLabel(order.status, t)}
            </span>
          </div>
          <p className="text-body mt-1">{fmt(t.orders.placed, { date: date(order.createdAt) })}</p>
        </div>
        <Link
          href={`/retailer/orders/${order.id}/pdf`}
          className="btn btn-secondary px-4 py-2 text-sm"
        >
          <FileDown className="size-4" /> {t.orders.orderPdf}
        </Link>
      </div>

      {/* 各供应商子订单 */}
      <div className="mt-8 space-y-6">
        {order.supplierOrders.map((so) => (
          <div key={so.id} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line-2)] px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {so.wholesaler.business.tradeName}
                </p>
                {so.wholesaler.user?.name && (
                  <p className="text-meta mt-0.5 text-[11px]">
                    {t.common.contactPerson}: {so.wholesaler.user.name}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {(() => {
                  const inv = so.invoices[0];
                  const unpaid =
                    inv &&
                    (inv.status === "UNPAID" ||
                      inv.status === "PARTIALLY_PAID" ||
                      inv.status === "OVERDUE");
                  return unpaid ? (
                    <Link
                      href="/retailer/account"
                      className="badge badge-warning font-medium transition-opacity hover:opacity-80"
                    >
                      {t.orders.paymentDue} · {money(inv.amount)}
                    </Link>
                  ) : inv ? (
                    <span className="badge badge-success">
                      {invoiceStatusLabel(inv.status, t)}
                    </span>
                  ) : null;
                })()}
                {so.status === "SUBMITTED" && (
                  <CancelOrderButton supplierOrderId={so.id} t={t} />
                )}
                <span className={`badge ${orderStatusTone(so.status)}`}>
                  {orderStatusLabel(so.status, t)}
                </span>
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line-2)] text-meta">
                  <th className="px-5 py-2.5 font-medium">{t.common.product}</th>
                  <th className="px-5 py-2.5 font-medium">SKU</th>
                  <th className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">
                    {t.wsOrders.unitPrice}
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">
                    {t.common.quantity}
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">
                    {t.common.subtotal}
                  </th>
                </tr>
              </thead>
              <tbody>
                {so.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--color-line-2)] last:border-0"
                  >
                    <td className="px-5 py-3">{item.productName}</td>
                    <td className="px-5 py-3 text-meta">{item.sku}</td>
                    <td className="hidden px-5 py-3 text-right text-[var(--color-ink-2)] sm:table-cell">
                      {money(item.unitPrice)}
                    </td>
                    <td className="px-5 py-3 text-right">{item.quantity}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {money(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end border-t border-[var(--color-line-2)] px-5 py-3">
              <span className="text-sm">
                <span className="text-meta">{t.orders.supplierTotal}: </span>
                <span className="font-semibold">{money(so.total)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 总额 */}
      <div className="card mt-6 flex items-center justify-between p-5">
        <div>
          <p className="text-meta text-xs">
            {fmt(t.orders.masterDesc, { n: order.supplierOrders.length })}
          </p>
          {order.notes && (
            <p className="text-meta mt-1 text-sm">{t.orders.notes} {order.notes}</p>
          )}
        </div>
        <p className="text-xl font-semibold">{money(total)}</p>
      </div>
    </div>
  );
}
