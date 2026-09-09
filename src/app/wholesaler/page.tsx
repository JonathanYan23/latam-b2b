import Link from "next/link";
import {
  ShoppingCart,
  Users,
  ArrowRight,
  DollarSign,
  Store,
  Package,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  FileDown,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import { money, date } from "@/lib/format";
import { AutoRefresh } from "@/components/auto-refresh";
import Image from "next/image";
import { parseImages } from "@/lib/pricing";

export default async function WholesalerHome() {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;

  const [
    newOrders,
    pendingRequests,
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

  // 库存预警：低于「商品阈值」或默认安全线(阈值未设且 <20)即低库存；0 或缺货单列
  const alertProducts = await db.product.findMany({
    where: { wholesalerId, active: true },
    include: { inventories: true },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  const productCount = alertProducts.length; // 活动商品数（示意，演示店铺小于上限 300）
  const stockOf = (pr: (typeof alertProducts)[number]) =>
    pr.inventories.reduce((sum, i) => sum + i.stock, 0);
  const isLow = (pr: (typeof alertProducts)[number]) => {
    const st = stockOf(pr);
    if (st <= 0) return false; // 缺货单独计
    const th = pr.lowStockThreshold;
    return th != null ? st <= th : st < 20;
  };
  const lowItems = alertProducts.filter(isLow);
  const outOfStockCount = alertProducts.filter((pr) => stockOf(pr) <= 0).length;
  const lowStockCount = lowItems.length;
  const suggestOrder = (pr: (typeof alertProducts)[number]) => {
    const st = stockOf(pr);
    const th = pr.lowStockThreshold ?? pr.moq * 3;
    const target = Math.max(th * 2, pr.moq);
    if (st >= target) return 0;
    return Math.ceil((target - st) / pr.moq) * pr.moq;
  };

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
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <Link
          href="/wholesaler/reports"
          className="card card-hover group flex items-center justify-between p-5"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
              <BarChart3 className="size-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-[15px] font-medium">{t.wsReports.title}</span>
              <span className="text-meta block text-sm">{t.wsReports.desc}</span>
            </span>
          </span>
          <ArrowRight className="size-4 text-[var(--color-ink-3)] transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* 库存预警 */}
      {(lowItems.length > 0 || outOfStockCount > 0) && (
        <div className="card mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <AlertTriangle className="size-4 text-[var(--color-danger)]" />
              {t.common.lowStock}
              <span className="badge badge-danger">{lowStockCount + outOfStockCount}</span>
            </h2>
            <div className="flex items-center gap-2">
              <a
                href="/wholesaler/reports/stock-csv"
                className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <FileDown className="size-3.5" /> {t.wsReports.exportCsv}（采购草稿）
              </a>
              <Link href="/wholesaler/products" className="btn btn-ghost px-3 py-1.5 text-xs">
                {t.common.manage}
              </Link>
            </div>
          </div>
          {lowItems.length > 0 && (
            <div className="mt-3 divide-y divide-[var(--color-line-2)]">
              {lowItems.slice(0, 6).map((pr) => {
                const st = stockOf(pr);
                const [img] = parseImages(pr.images);
                const suggest = suggestOrder(pr);
                return (
                  <div key={pr.id} className="flex items-center gap-3 py-2.5">
                    <span className="relative block size-10 shrink-0 overflow-hidden rounded-md bg-[var(--color-bg-muted)]">
                      {img && (
                        <Image src={img} alt="" fill sizes="40px" className="object-cover" unoptimized />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{pr.name}</p>
                      <p className="text-meta text-[11px]">
                        {t.common.inStock}: {st}
                        {pr.lowStockThreshold != null && (
                          <span> · {t.productForm.lowStockThreshold} {pr.lowStockThreshold}</span>
                        )}
                      </p>
                    </div>
                    {suggest > 0 && (
                      <span className="shrink-0 text-xs text-[var(--color-ink-2)]">
                        建议补货 <b className="text-[var(--color-ink)]">{suggest}</b>
                      </span>
                    )}
                    <Link
                      href={`/wholesaler/products/${pr.id}/edit`}
                      className="btn btn-ghost shrink-0 px-2.5 py-1 text-xs"
                    >
                      {t.common.edit ?? "Edit"}
                    </Link>
                  </div>
                );
              })}
              {lowItems.length > 6 && (
                <p className="pt-2 text-xs text-[var(--color-ink-3)]">
                  +{lowItems.length - 6} … <Link href="/wholesaler/products" className="text-[var(--color-accent)]">{t.common.manage}</Link>
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
