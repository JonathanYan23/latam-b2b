import Link from "next/link";
import { ShoppingCart, FileDown, Search } from "lucide-react";
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
import { OrderCheckbox, OrdersBulkBar } from "./orders-bulk";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata = { title: "Orders" };

export default async function WholesalerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; q?: string; f?: string; t?: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;
  const { s, q, f, t: ft } = await searchParams;
  const STATUSES = ["ALL", "DRAFT", "SUBMITTED", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const;
  const activeStatus = STATUSES.includes(s as (typeof STATUSES)[number]) ? (s as (typeof STATUSES)[number]) : "ALL";
  const keyword = (q ?? "").trim();
  const dateFrom = (f ?? "").trim();
  const dateTo = (ft ?? "").trim();
  const hasFilter = Boolean(keyword || dateFrom || dateTo);

  const where = {
    wholesalerId,
    deletedAt: null, // 前台不展示已删除（后台保留）
    ...(activeStatus !== "ALL" ? { status: activeStatus as never } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00") } : {}),
            ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
          } as never,
        }
      : {}),
    ...(keyword
      ? {
          order: {
            OR: [
              { orderNumber: { contains: keyword } },
              {
                retailer: {
                  OR: [
                    { business: { tradeName: { contains: keyword } } },
                    { user: { name: { contains: keyword } } },
                  ],
                },
              },
            ],
          },
        }
      : {}),
  };
  const orders = await db.supplierOrder.findMany({
    where,
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
      items: { select: { quantity: true, product: { select: { costPrice: true } } } },
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
        <AutoRefresh />
      <h1 className="text-h1">{t.wsOrders.title}</h1>
      <p className="text-body mt-1">{t.wsOrders.desc}</p>

      {/* 搜索 + 日期筛选（与状态 chips 组合使用） */}
      <form
        method="get"
        action="/wholesaler/orders"
        className="card mt-5 flex flex-wrap items-end gap-2 p-3"
      >
        {activeStatus !== "ALL" && <input type="hidden" name="s" value={activeStatus} />}
        <div className="relative min-w-0 flex-1 basis-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input
            name="q"
            defaultValue={keyword}
            placeholder={t.wsOrders.searchOrders}
            className="input h-10 pl-9 text-sm"
          />
        </div>
        <label className="text-xs text-[var(--color-ink-2)]">
          {t.wsOrders.dateFrom}
          <input name="f" type="date" defaultValue={dateFrom} className="input mt-1 h-10 px-2 text-sm" />
        </label>
        <label className="text-xs text-[var(--color-ink-2)]">
          {t.wsOrders.dateTo}
          <input name="t" type="date" defaultValue={dateTo} className="input mt-1 h-10 px-2 text-sm" />
        </label>
        <button type="submit" className="btn btn-primary h-10 px-4 text-sm">
          {t.common.search}
        </button>
        {hasFilter && (
          <a
            href="/wholesaler/orders"
            className="btn btn-ghost h-10 px-3 text-sm text-[var(--color-ink-2)]"
          >
            {t.wsOrders.resetFilter}
          </a>
        )}
      </form>

      {/* 状态筛选 + 导出（保留搜索/日期参数） */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((st) => {
          const n = st === "ALL" ? allCount : counts[st] ?? 0;
          const active = activeStatus === st;
          const label = st === "ALL" ? t.common.all : orderStatusLabel(st as never, t);
          const sp = new URLSearchParams();
          if (st !== "ALL") sp.set("s", st);
          if (keyword) sp.set("q", keyword);
          if (dateFrom) sp.set("f", dateFrom);
          if (dateTo) sp.set("t", dateTo);
          const qs = sp.toString();
          return (
            <Link
              key={st}
              href={`/wholesaler/orders${qs ? `?${qs}` : ""}`}
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
        {shown.length > 0 && (
          <a
            href={`/wholesaler/orders/export?ids=${shown.map((o) => o.id).join(",")}`}
            target="_blank"
            className="btn btn-secondary shrink-0 px-3.5 py-2 text-sm"
          >
            <FileDown className="size-4" /> {t.common.exportPdf}
          </a>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <Search className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
          <p className="text-h3 text-base">
            {hasFilter ? t.wsOrders.noMatchOrders : t.wsOrders.emptyTitle}
          </p>
          <p className="text-meta mt-1.5 max-w-sm">
            {hasFilter ? t.wsOrders.desc : t.wsOrders.emptyDesc}
          </p>
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
                className="card group relative flex flex-col p-5 pl-11 transition-shadow hover:shadow-md"
              >
                <div className="absolute left-4 top-5 z-20">
                  <OrderCheckbox id={o.id} />
                </div>
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
                    {(() => {
                      const costs = o.items.reduce(
                        (sum, it) => sum + (Number(it.product.costPrice ?? 0) * it.quantity || 0),
                        0,
                      );
                      const hasCost = o.items.some((it) => it.product.costPrice != null);
                      if (!hasCost || o.items.length === 0) return null;
                      const margin = Number(o.total) - costs;
                      return (
                        <span className={`text-[11px] ${margin >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                          {t.wsOrders.estMargin}: {money(margin, cur)}
                        </span>
                      );
                    })()}
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

      <OrdersBulkBar
        visibleIds={shown.map((o) => o.id)}
        activeIds={shown
          .filter((o) =>
            ["SUBMITTED", "CONFIRMED", "PREPARING", "READY", "COMPLETED"].includes(
              o.status,
            ),
          )
          .map((o) => o.id)}
        t={t}
      />
    </div>
  );
}
