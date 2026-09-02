import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import { orderStatusLabel, orderStatusTone, money, date } from "@/lib/format";
import { StatusFlowButtons } from "../status-buttons";

export default async function WholesalerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;
  const { id } = await params;

  const so = await db.supplierOrder.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          retailer: { include: { business: { include: { city: true, country: true } } } },
        },
      },
      items: true,
      relationship: true,
    },
  });
  if (!so || so.wholesalerId !== wholesalerId) notFound();

  const loc = [
    so.order.retailer.business.city?.name,
    so.order.retailer.business.country?.name,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/wholesaler/orders"
        className="text-meta mb-5 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.orders.backToOrders}
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-h1">#{so.order.orderNumber}</h1>
            <span className={`badge ${orderStatusTone(so.status)}`}>
              {orderStatusLabel(so.status, t)}
            </span>
          </div>
          <p className="text-body mt-1">
            {fmt(t.orders.placed, { date: date(so.createdAt) })}
          </p>
        </div>
        <StatusFlowButtons supplierOrderId={so.id} current={so.status} t={t} />
      </div>

      {/* 客户信息 */}
      <div className="card mt-6 p-5">
        <p className="text-meta text-xs">{t.wsOrders.customer}</p>
        <p className="mt-1 font-medium">
          {so.order.retailer.business.tradeName}
        </p>
        <p className="text-meta text-sm">
          {so.order.retailer.business.legalName}
          {loc && ` · ${loc}`}
        </p>
        {so.relationship?.paymentTerms && (
          <p className="text-meta mt-1 text-xs">
            {t.common.terms}: {so.relationship.paymentTerms}
          </p>
        )}
      </div>

      {/* 明细 */}
      <div className="card mt-5 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line-2)] text-meta">
              <th className="px-5 py-3 font-medium">{t.common.product}</th>
              <th className="px-5 py-3 font-medium">SKU</th>
              <th className="px-5 py-3 text-right font-medium">
                {t.wsOrders.unitPrice}
              </th>
              <th className="px-5 py-3 text-right font-medium">
                {t.common.quantity}
              </th>
              <th className="px-5 py-3 text-right font-medium">
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
                <td className="px-5 py-3.5 font-medium">{item.productName}</td>
                <td className="px-5 py-3.5 text-meta">{item.sku}</td>
                <td className="px-5 py-3.5 text-right">{money(item.unitPrice)}</td>
                <td className="px-5 py-3.5 text-right">{item.quantity}</td>
                <td className="px-5 py-3.5 text-right font-medium">
                  {money(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-[var(--color-line-2)] px-5 py-4">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-[var(--color-ink-2)]">
              <span>{t.common.subtotal}</span>
              <span>{money(so.subtotal)}</span>
            </div>
            {Number(so.discount) > 0 && (
              <div className="flex justify-between text-[var(--color-ink-2)]">
                <span>{t.common.discount}</span>
                <span>-{money(so.discount)}</span>
              </div>
            )}
            {Number(so.shipping) > 0 && (
              <div className="flex justify-between text-[var(--color-ink-2)]">
                <span>{t.common.shipping}</span>
                <span>{money(so.shipping)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--color-line-2)] pt-1.5 text-base font-semibold">
              <span>{t.common.total}</span>
              <span>{money(so.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
