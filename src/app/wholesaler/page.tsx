import Link from "next/link";
import {
  ShoppingCart,
  Users,
  ArrowRight,
  DollarSign,
  Store,
  Package,
  MessageSquare,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import { money, date } from "@/lib/format";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function WholesalerHome() {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;

  const [
    newOrders,
    pendingRequests,
    outOfStockCount,
    lowStockCount,
    productCount,
    activeCustomers,
    receivables,
    recentOrders,
    recentRequests,
  ] = await Promise.all([
    db.supplierOrder.count({
      where: { wholesalerId, status: "SUBMITTED" },
    }),
    db.customerRelationship.count({
      where: { wholesalerId, status: "PENDING" },
    }),
    db.inventory.count({
      where: { warehouse: { wholesalerId }, stock: { lte: 0 } },
    }),
    // 库存趋近 0（1..19 件）的低库存商品数
    db.product.count({
      where: {
        wholesalerId,
        active: true,
        inventories: { some: { stock: { gt: 0, lt: 20 } } },
      },
    }),
    db.product.count({ where: { wholesalerId, active: true } }),
    db.customerRelationship.count({
      where: { wholesalerId, status: "APPROVED" },
    }),
    db.invoice.aggregate({
      where: {
        wholesalerId,
        status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
      },
      _sum: { amount: true },
    }),
    db.supplierOrder.findMany({
      where: { wholesalerId, status: "SUBMITTED" },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: {
        order: { select: { orderNumber: true } },
      },
    }),
    db.customerRelationship.findMany({
      where: { wholesalerId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        retailer: {
          include: { business: { select: { tradeName: true, legalName: true } } },
        },
      },
    }),
  ]);

  const attention: { label: string; count: number; href: string }[] = [
    {
      label: t.wholesalerHome.newOrders,
      count: newOrders,
      href: "/wholesaler/orders",
    },
    {
      label: t.wholesalerHome.customerRequests,
      count: pendingRequests,
      href: "/wholesaler/customers",
    },
    {
      label: t.common.lowStock,
      count: lowStockCount,
      href: "/wholesaler/products",
    },
    {
      label: t.wholesalerHome.outOfStock,
      count: outOfStockCount,
      href: "/wholesaler/products",
    },
  ].filter((a) => a.count > 0);

  // 最近动态：新订单 + 客户申请（时间倒序混排）
  const recent: {
    key: string;
    href: string;
    title: string;
    sub?: string | null;
    time: Date;
    kind: "order" | "request";
  }[] = [
    ...recentOrders.map((o) => ({
      key: o.id,
      href: `/wholesaler/orders/${o.id}`,
      title: `${t.wholesalerHome.newOrders} · ${o.order.orderNumber}`,
      sub: money(o.total, cur),
      time: o.createdAt,
      kind: "order" as const,
    })),
    ...recentRequests.map((r) => ({
      key: r.id,
      href: `/wholesaler/customers`,
      title:
        r.retailer.business.tradeName ?? r.retailer.business.legalName ?? "",
      sub: t.wholesalerHome.customerRequests,
      time: r.requestedAt ?? r.createdAt,
      kind: "request" as const,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
        <AutoRefresh />
      <h1 className="text-h1">{t.wholesalerHome.title}</h1>
      <p className="text-body mt-1">{t.wholesalerHome.desc}</p>

      {attention.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-h3 text-[15px] text-[var(--color-ink-2)]">
            {t.wholesalerHome.attention}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {attention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="card card-hover flex items-center justify-between p-4"
              >
                <span className="text-sm font-medium">{a.label}</span>
                <span className="grid size-9 place-items-center rounded-full bg-[var(--color-danger)] text-sm font-semibold text-white">
                  {a.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card mt-8 flex items-center gap-3 px-5 py-4 text-sm text-[var(--color-ink-2)]">
          <span className="size-2 rounded-full bg-[var(--color-success)]" />
          {t.wholesalerHome.allCaughtUp}
        </div>
      )}

      {/* 核心数据 */}
      <h2 className="text-h3 mt-10 text-[15px] text-[var(--color-ink-2)]">
        {t.wholesalerHome.overview}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/wholesaler/account" className="card card-hover p-5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <DollarSign className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="amount mt-3 text-[15px]">
            {money(receivables._sum?.amount, cur)}
          </p>
          <p className="text-meta mt-0.5">{t.wholesalerHome.receivables}</p>
        </Link>
        <Link href="/wholesaler/products" className="card card-hover p-5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <Package className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">{productCount}</p>
          <p className="text-meta mt-0.5">{t.wholesalerHome.activeProducts}</p>
        </Link>
        <Link href="/wholesaler/customers" className="card card-hover p-5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <Users className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">{activeCustomers}</p>
          <p className="text-meta mt-0.5">{t.wholesalerHome.activeCustomers}</p>
        </Link>
        <Link href="/wholesaler/orders" className="card card-hover p-5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <ShoppingCart className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">{newOrders}</p>
          <p className="text-meta mt-0.5">{t.wholesalerHome.awaitingReview}</p>
        </Link>
      </div>

      {/* 快捷操作 */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link
          href="/wholesaler/products/new"
          className="card card-hover group flex items-center justify-between p-5"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
              <Package className="size-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-[15px] font-medium">
                {t.wholesalerHome.addProduct}
              </span>
              <span className="text-meta block text-sm">
                {t.wholesalerHome.addProductDesc}
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 text-[var(--color-ink-3)] transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/wholesaler/orders"
          className="card card-hover group flex items-center justify-between p-5"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
              <ShoppingCart className="size-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-[15px] font-medium">
                {t.wholesalerHome.processOrders}
              </span>
              <span className="text-meta block text-sm">
                {t.wholesalerHome.processOrdersDesc}
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 text-[var(--color-ink-3)] transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/wholesaler/customers"
          className="card card-hover group flex items-center justify-between p-5"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
              <Store className="size-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-[15px] font-medium">
                {t.wholesalerHome.reviewRequests}
              </span>
              <span className="text-meta block text-sm">
                {pendingRequests > 0
                  ? fmt(t.wholesalerHome.reviewRequestsCount, { n: pendingRequests })
                  : t.wholesalerHome.noPending}
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 text-[var(--color-ink-3)] transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* 最近动态 */}
      <h2 className="text-h3 mt-10 text-[15px] text-[var(--color-ink-2)]">
        {t.wholesalerHome.recentActivity}
      </h2>
      {recent.length === 0 ? (
        <div className="card mt-3 px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">
          {t.wholesalerHome.noActivity}
        </div>
      ) : (
        <div className="card mt-3 divide-y divide-[var(--color-line-2)]">
          {recent.map((r) => (
            <Link
              key={r.key}
              href={r.href}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-bg-subtle)]"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                  r.kind === "order"
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "bg-[#eff6ff] text-[#2563eb]"
                }`}
              >
                {r.kind === "order" ? (
                  <ShoppingCart className="size-4" strokeWidth={1.9} />
                ) : (
                  <MessageSquare className="size-4" strokeWidth={1.9} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {r.title}
                </span>
                <span className="text-meta block text-xs">
                  {r.sub ? `${r.sub} · ` : ""}
                  {date(r.time)}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-[var(--color-ink-3)] transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
