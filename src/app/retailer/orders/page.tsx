import Link from "next/link";
import { ShoppingBag, ArrowRight, FileDown, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { fmt } from "@/i18n/utils";
import { money, date, orderStatusLabel, orderStatusTone } from "@/lib/format";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata = { title: "Orders" };

export default async function RetailerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; q?: string; f?: string; t?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const retailerId = session.retailerId!;
  const { s, q, f, t: ft } = await searchParams;

  const STATUSES = [
    "ALL",
    "SUBMITTED",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "COMPLETED",
    "CANCELLED",
  ] as const;
  const activeStatus = STATUSES.includes(
    s as (typeof STATUSES)[number],
  )
    ? (s as (typeof STATUSES)[number])
    : "ALL";
  const keyword = (q ?? "").trim();
  const dateFrom = (f ?? "").trim();
  const dateTo = (ft ?? "").trim();
  const hasFilter = Boolean(keyword || dateFrom || dateTo);

  // 数量统计：已提交订单数（不含草稿）+ 草稿件数
  const [allCount, draft, shown] = await Promise.all([
    db.order.count({ where: { retailerId, status: { not: "DRAFT" } } }),
    db.order.findFirst({
      where: { retailerId, status: "DRAFT" },
      select: {
        id: true,
        supplierOrders: {
          select: {
            total: true,
            items: { select: { quantity: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.order.findMany({
      where: {
        retailerId,
        status: { not: "DRAFT" },
        ...(activeStatus !== "ALL" ? { status: activeStatus } : {}),
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00") } : {}),
                ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
              },
            }
          : {}),
        ...(keyword
          ? {
              OR: [
                { orderNumber: { contains: keyword } },
                {
                  supplierOrders: {
                    some: {
                      wholesaler: {
                        OR: [
                          {
                            business: {
                              OR: [
                                { tradeName: { contains: keyword } },
                                { legalName: { contains: keyword } },
                              ],
                            },
                          },
                          { user: { name: { contains: keyword } } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
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
    }),
  ]);

  const draftItemCount =
    draft?.supplierOrders.reduce(
      (acc, so) => acc + so.items.reduce((x, i) => x + i.quantity, 0),
      0,
    ) ?? 0;
  const draftTotal =
    draft?.supplierOrders.reduce((acc, so) => acc + Number(so.total), 0) ?? 0;
  const hasOrder = allCount > 0 || !!draft;

  const sp = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (activeStatus !== "ALL") p.set("s", activeStatus);
    if (keyword) p.set("q", keyword);
    if (dateFrom) p.set("f", dateFrom);
    if (dateTo) p.set("t", dateTo);
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <AutoRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1">
            {t.orders.title}
            {allCount > 0 && (
              <span className="badge badge-neutral ml-2 align-middle">
                {fmt(t.orders.count, { n: allCount })}
              </span>
            )}
          </h1>
          <p className="text-body mt-1">{t.orders.desc}</p>
        </div>
        {shown.length > 0 && (
          <a
            href={`/retailer/orders/export?ids=${shown.map((o) => o.id).join(",")}`}
            target="_blank"
            className="btn btn-secondary px-3.5 py-2 text-sm"
          >
            <FileDown className="size-4" /> {t.common.exportPdf}
          </a>
        )}
      </div>

      {hasOrder ? (
        <>
          {/* 搜索 + 日期筛选 */}
          <form
            method="get"
            action="/retailer/orders"
            className="card mt-5 flex flex-wrap items-end gap-2 p-3"
          >
            <div className="relative min-w-0 flex-1 basis-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
              <input
                name="q"
                defaultValue={keyword}
                placeholder={t.orders.searchOrders}
                className="input h-10 pl-9 text-sm"
              />
            </div>
            <label className="text-xs text-[var(--color-ink-2)]">
              {t.orders.dateFrom}
              <input
                name="f"
                type="date"
                defaultValue={dateFrom}
                className="input mt-1 h-10 px-2 text-sm"
              />
            </label>
            <label className="text-xs text-[var(--color-ink-2)]">
              {t.orders.dateTo}
              <input
                name="t"
                type="date"
                defaultValue={dateTo}
                className="input mt-1 h-10 px-2 text-sm"
              />
            </label>
            <button type="submit" className="btn btn-primary h-10 px-4 text-sm">
              {t.common.search}
            </button>
            {hasFilter && (
              <a
                href="/retailer/orders"
                className="btn btn-ghost h-10 px-3 text-sm text-[var(--color-ink-2)]"
              >
                {t.orders.resetFilter}
              </a>
            )}
          </form>

          {/* 状态筛选（与搜索组合） */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUSES.map((st) => {
              const active = activeStatus === st;
              const label =
                st === "ALL" ? t.common.all : orderStatusLabel(st, t);
              return (
                <Link
                  key={st}
                  href={`/retailer/orders${sp({ s: st === "ALL" ? undefined : st })}`}
                  className={
                    active
                      ? "rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-full border border-[var(--color-line-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                  }
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* 草稿（购物车）横幅 */}
          {draft && (
            <div className="card mt-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[var(--color-accent)] p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#fef3c7] text-[#92400e]">
                  <ShoppingBag className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{t.cart.title}</p>
                  <p className="text-meta text-xs">
                    {draftItemCount} {t.orders.items} ·{" "}
                    {money(draftTotal, cur)} ·{" "}
                    {fmt(t.orders.masterDesc, { n: draft.supplierOrders.length })}
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

          {shown.length === 0 ? (
            <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
              <Search className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
              <p className="text-h3 text-base">{t.orders.noMatchOrders}</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {shown.map((o) => {
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
          )}
        </>
      ) : (
        <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <ShoppingBag
            className="mb-4 size-8 text-[var(--color-ink-3)]"
            strokeWidth={1.5}
          />
          <p className="text-h3 text-base">{t.orders.emptyTitle}</p>
          <p className="text-meta mt-1.5 max-w-sm">{t.orders.emptyDesc}</p>
          <Link
            href="/retailer/browse"
            className="btn btn-primary mt-6 px-5 py-2 text-sm"
          >
            {t.retailerHome.browseCta}
          </Link>
        </div>
      )}
    </div>
  );
}
