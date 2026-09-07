import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import {
  orderStatusLabel,
  orderStatusTone,
  money,
  date,
} from "@/lib/format";
import { DeleteOrderButton } from "./delete-order-button";

export const metadata = { title: "Orders" };

export default async function WholesalerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;
  const { s } = await searchParams;
  const STATUSES = ["ALL", "DRAFT", "SUBMITTED", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const;
  const activeStatus = STATUSES.includes(s as (typeof STATUSES)[number]) ? (s as (typeof STATUSES)[number]) : "ALL";

  const orders = await db.supplierOrder.findMany({
    where: { wholesalerId },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        include: {
          retailer: {
            include: { business: true, user: { select: { name: true } } },
          },
        },
      },
      _count: { select: { items: true, invoices: true, payments: true } },
    },
  });

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const allCount = orders.length;
  const shown =
    activeStatus === "ALL" ? orders : orders.filter((o) => o.status === activeStatus);

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <h1 className="text-h1">{t.wsOrders.title}</h1>
      <p className="text-body mt-1">{t.wsOrders.desc}</p>

      {/* 状态筛选 */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {STATUSES.map((st) => {
          const n = st === "ALL" ? allCount : counts[st] ?? 0;
          const active = activeStatus === st;
          const label = st === "ALL" ? t.common.all : orderStatusLabel(st as never, t);
          return (
            <Link
              key={st}
              href={st === "ALL" ? "/wholesaler/orders" : `/wholesaler/orders?s=${st}`}
              className={
                active
                  ? "rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full border border-[var(--color-line-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
              }
            >
              {label} {n > 0 && <span className="opacity-70">{n}</span>}
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <ShoppingCart className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
          <p className="text-h3 text-base">{t.wsOrders.emptyTitle}</p>
          <p className="text-meta mt-1.5 max-w-sm">{t.wsOrders.emptyDesc}</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {shown.map((o) => {
            // 可删判定：草稿/未处理/已取消，且无发票/无收款（与 server action 守卫一致）
            const deletable =
              ["DRAFT", "SUBMITTED", "CANCELLED"].includes(o.status) &&
              o._count.invoices === 0 &&
              o._count.payments === 0;
            return (
              <div
                key={o.id}
                className="card group relative flex flex-col p-5 transition-shadow hover:shadow-md"
              >
                <Link
                  href={`/wholesaler/orders/${o.id}`}
                  className="absolute inset-0 rounded-2xl"
                  aria-label={`#${o.order.orderNumber}`}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">#{o.order.orderNumber}</p>
                    <p className="text-meta mt-0.5 truncate">
                      {o.order.retailer.business.tradeName}
                    </p>
                    {o.order.retailer.user?.name && (
                      <p className="text-meta truncate text-[11px]">
                        {t.common.contactPerson}: {o.order.retailer.user.name}
                      </p>
                    )}
                  </div>
                  <span className={`badge shrink-0 ${orderStatusTone(o.status)}`}>
                    {orderStatusLabel(o.status, t)}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-2 border-t border-[var(--color-line-2)] pt-4">
                  <div className="min-w-0">
                    <p className="text-meta text-xs">{date(o.createdAt)}</p>
                    <p className="text-meta mt-0.5 text-xs">
                      {o._count.items} × {t.common.product}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="amount text-sm">{money(o.total, cur)}</p>
                    <div className="relative z-10 flex items-center gap-1.5">
                      <DeleteOrderButton
                        supplierOrderId={o.id}
                        orderNumber={o.order.orderNumber}
                        deletable={deletable}
                        t={t}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
