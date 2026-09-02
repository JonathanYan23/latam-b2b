import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import { money, date, orderStatusLabel, orderStatusTone } from "@/lib/format";

export const metadata = { title: "Orders" };

export default async function RetailerOrdersPage() {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const retailerId = session.retailerId!;

  const orders = await db.order.findMany({
    where: { retailerId },
    orderBy: { createdAt: "desc" },
    include: {
      supplierOrders: {
        include: {
          wholesaler: { include: { business: true } },
          invoices: {
            select: { status: true, amount: true },
            take: 1,
          },
          items: { select: { id: true } },
        },
      },
      _count: { select: { supplierOrders: true } },
    },
  });

  const draft = orders.find((o) => o.status === "DRAFT");
  const settled = orders.filter((o) => o.status !== "DRAFT");
  const draftItemCount =
    draft?.supplierOrders.reduce((acc, so) => acc + so.items.length, 0) ?? 0;
  const draftTotal =
    draft?.supplierOrders.reduce((acc, so) => acc + Number(so.total), 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <h1 className="text-h1">{t.orders.title}</h1>
      <p className="text-body mt-1">{t.orders.desc}</p>

      {orders.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <ShoppingBag className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
          <p className="text-h3 text-base">{t.orders.emptyTitle}</p>
          <p className="text-meta mt-1.5 max-w-sm">{t.orders.emptyDesc}</p>
          <Link href="/retailer/browse" className="btn btn-primary mt-6 px-5 py-2 text-sm">
            {t.retailerHome.browseCta}
          </Link>
        </div>
      ) : (
        <>
        {draft && (
          <div className="card mt-8 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[var(--color-accent)] p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#fef3c7] text-[#92400e]">
                <ShoppingBag className="size-5" />
              </span>
              <div>
                <p className="font-medium">{t.cart.title}</p>
                <p className="text-meta text-xs">
                  {draftItemCount} {t.orders.items} · {money(draftTotal, cur)} ·{" "}
                  {fmt(t.orders.masterDesc, { n: draft?.supplierOrders.length ?? 0 })}
                </p>
              </div>
            </div>
            <Link
              href="/retailer/orders/draft"
              className="btn btn-primary px-4 py-2 text-sm"
            >
              {t.cart.placeOrder} <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {settled.map((o) => {
            const total = o.supplierOrders.reduce(
              (s, so) => s + Number(so.total),
              0,
            );
            const names = o.supplierOrders
              .map((so) => so.wholesaler.business.tradeName)
              .slice(0, 2);
            const unpaidInv = o.supplierOrders
              .map((so) => so.invoices[0])
              .find(
                (inv) =>
                  inv &&
                  (inv.status === "UNPAID" ||
                    inv.status === "PARTIALLY_PAID" ||
                    inv.status === "OVERDUE"),
              );
            return (
              <Link
                key={o.id}
                href={`/retailer/orders/${o.id}`}
                className="card card-hover group flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">#{o.orderNumber}</p>
                    <p className="text-meta mt-0.5 truncate">
                      {names.join(", ")}
                      {o.supplierOrders.length > 2 &&
                        ` +${o.supplierOrders.length - 2} ${t.common.more}`}
                    </p>
                  </div>
                  <span className={`badge shrink-0 ${orderStatusTone(o.status)}`}>
                    {orderStatusLabel(o.status, t)}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-[var(--color-line-2)] pt-4">
                  <div>
                    <p className="text-meta text-xs">{date(o.createdAt)}</p>
                    <p className="text-meta mt-0.5 text-xs">
                      {o.supplierOrders.length} × {t.common.supplier}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    {unpaidInv && (
                      <span className="badge badge-warning mb-1 px-2 py-0.5 text-[10px] font-medium">
                        {t.orders.paymentDue}
                      </span>
                    )}
                    <p className="text-sm font-semibold">{money(total, cur)}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink-3)] transition-colors group-hover:text-[var(--color-ink)]">
                      {t.common.view} <ArrowRight className="size-3.5" />
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
