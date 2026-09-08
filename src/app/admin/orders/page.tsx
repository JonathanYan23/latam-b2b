import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { orderStatusLabel, orderStatusTone, money, date } from "@/lib/format";
import { AdminRestoreButton } from "./restore-button";

export const metadata = { title: "Orders (Admin)" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; q?: string }>;
}) {
  await requireRole("ADMIN");
  const t = await getDictionary();
  const { d, q } = await searchParams;
  const mode = d === "del" ? "del" : d === "normal" ? "normal" : "all";
  const kw = (q ?? "").trim();

  const orders = await db.supplierOrder.findMany({
    where: {
      ...(mode === "del" ? { deletedAt: { not: null } } : mode === "normal" ? { deletedAt: null } : {}),
      ...(kw
        ? {
            order: {
              OR: [
                { orderNumber: { contains: kw } },
                {
                  retailer: {
                    business: { tradeName: { contains: kw } },
                  },
                },
                { wholesaler: { business: { tradeName: { contains: kw } } } },
              ],
            },
          } as never
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      order: {
        select: {
          orderNumber: true,
          retailer: { include: { business: { select: { tradeName: true } } } },
        },
      },
      wholesaler: {
        select: { business: { select: { tradeName: true } } },
      },
      // 删除人：deletedBy 为 User id → 反查
    },
  });
  const delUsers = await db.user.findMany({
    where: { id: { in: orders.map((o) => o.deletedBy ?? "").filter(Boolean) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(delUsers.map((u) => [u.id, u.name ?? u.email]));

  const chips = [
    { key: "", label: t.admin.allOrders },
    { key: "normal", label: t.admin.normalOnly },
    { key: "del", label: t.admin.deletedOnly },
  ];

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <Link
        href="/admin"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.admin.title}
      </Link>
      <h1 className="text-h1">{t.admin.orders}</h1>
      <p className="text-meta mt-1 text-sm">
        {t.admin.desc} · 删除订单为软删除（前台隐藏），此处永久可查、可恢复。
      </p>

      {/* 筛选 */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => {
            const active = mode === c.key;
            return (
              <Link
                key={c.key}
                href={
                  c.key === "" ? "/admin/orders" : `/admin/orders?d=${c.key}`
                }
                className={
                  active
                    ? "rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-full border border-[var(--color-line-2)] px-3 py-1.5 text-xs text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                }
              >
                {c.label}
              </Link>
            );
          })}
        </div>
        <form method="get" action="/admin/orders" className="flex items-center gap-2">
          {mode !== "all" && <input type="hidden" name="d" value={mode} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
            <input
              name="q"
              defaultValue={kw}
              placeholder={t.wsOrders.searchOrders}
              className="input h-9 w-60 pl-9 text-sm"
            />
          </div>
          <button type="submit" className="btn btn-primary h-9 px-3 text-sm">
            {t.common.search}
          </button>
        </form>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line-2)] text-meta">
              <th className="px-5 py-3 font-medium">{t.admin.orderCol}</th>
              <th className="px-5 py-3 font-medium">{t.common.status}</th>
              <th className="px-5 py-3 font-medium">{t.nav.wholesalerBrand}</th>
              <th className="px-5 py-3 font-medium">{t.admin.buyerCol}</th>
              <th className="px-5 py-3 text-right font-medium">{t.admin.totalCol}</th>
              <th className="px-5 py-3 font-medium">{t.admin.joined}</th>
              <th className="px-5 py-3 font-medium">{t.admin.deleteTime}</th>
              <th className="px-5 py-3 font-medium">{t.admin.operator}</th>
              <th className="px-5 py-3 font-medium">{t.admin.ip}</th>
              <th className="px-5 py-3 font-medium">{t.admin.viewDetails}</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-meta">
                  {t.admin.emptyOrders}
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr
                key={o.id}
                className={
                  o.deletedAt
                    ? "border-b border-[var(--color-line-2)] bg-[#fef2f2]/60 opacity-80"
                    : "border-b border-[var(--color-line-2)]"
                }
              >
                <td className="px-5 py-3">
                  <span className="flex items-center gap-1.5 font-medium">
                    #{o.order.orderNumber}
                    {o.deletedAt && (
                      <span className="badge badge-danger">{t.admin.deletedTag}</span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`badge ${orderStatusTone(o.status)}`}>
                    {orderStatusLabel(o.status, t)}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {o.wholesaler.business.tradeName ?? "—"}
                </td>
                <td className="px-5 py-3">
                  {o.order.retailer.business.tradeName ?? "—"}
                </td>
                <td className="px-5 py-3 text-right">
                  {money(Number(o.total), o.currency)}
                </td>
                <td className="px-5 py-3 text-meta">{date(o.createdAt)}</td>
                <td className="px-5 py-3 text-meta">
                  {o.deletedAt ? date(o.deletedAt) : "—"}
                </td>
                <td className="px-5 py-3 text-meta">
                  {o.deletedBy ? userMap.get(o.deletedBy) ?? o.deletedBy.slice(0, 8) : "—"}
                </td>
                <td className="px-5 py-3 text-meta">{o.deletedIp ?? "—"}</td>
                <td className="px-5 py-3">
                  {o.deletedAt && (
                    <AdminRestoreButton
                      supplierOrderId={o.id}
                      label={t.admin.restore}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
