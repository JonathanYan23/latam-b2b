import Link from "next/link";
import {
  ShoppingCart,
  Users,
  PackageX,
  ArrowRight,
  DollarSign,
  Store,
  Package,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import { money } from "@/lib/format";

export default async function WholesalerHome() {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;

  const [
    newOrders,
    pendingRequests,
    lowStockCount,
    productCount,
    activeCustomers,
    receivables,
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
      label: t.wholesalerHome.outOfStock,
      count: lowStockCount,
      href: "/wholesaler/products",
    },
  ].filter((a) => a.count > 0);

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <h1 className="text-h1">{t.wholesalerHome.title}</h1>
      <p className="text-body mt-1">{t.wholesalerHome.desc}</p>

      {attention.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-h3 text-[15px] text-[var(--color-ink-2)]">
            {t.wholesalerHome.attention}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {attention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="card card-hover flex items-center justify-between p-4"
              >
                <span className="text-sm font-medium">{a.label}</span>
                <span className="grid size-9 place-items-center rounded-full bg-[var(--color-ink)] text-sm font-semibold text-white">
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

      <h2 className="text-h3 mt-10 text-[15px] text-[var(--color-ink-2)]">
        {t.wholesalerHome.overview}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link
          href="/wholesaler/account"
          className="card card-hover p-5"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <DollarSign className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">
            {money(receivables._sum?.amount, cur)}
          </p>
          <p className="text-meta mt-0.5">{t.wholesalerHome.receivables}</p>
        </Link>
        <Link
          href="/wholesaler/products"
          className="card card-hover p-5"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <Package className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">{productCount}</p>
          <p className="text-meta mt-0.5">{t.wholesalerHome.activeProducts}</p>
        </Link>
        <Link
          href="/wholesaler/customers"
          className="card card-hover p-5"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <Users className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">{activeCustomers}</p>
          <p className="text-meta mt-0.5">{t.wholesalerHome.activeCustomers}</p>
        </Link>
        <Link
          href="/wholesaler/orders"
          className="card card-hover p-5"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <ShoppingCart className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">{newOrders}</p>
          <p className="text-meta mt-0.5">{t.wholesalerHome.awaitingReview}</p>
        </Link>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
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
    </div>
  );
}
