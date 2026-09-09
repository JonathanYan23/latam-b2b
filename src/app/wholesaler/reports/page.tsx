import Link from "next/link";
import { ArrowLeft, FileDown, BarChart3 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { money, date } from "@/lib/format";

export const metadata = { title: "Monthly report" };

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  return d.toISOString().slice(0, 7);
});

export default async function WholesalerReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD";
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;
  const { month } = await searchParams;
  const picked = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : MONTHS[0];

  const [start, end] = [
    new Date(picked + "-01T00:00:00"),
    new Date(new Date(new Date(picked + "-01T00:00:00").setMonth(new Date(picked + "-01").getMonth() + 1)).toISOString().slice(0, 10) + "T00:00:00"),
  ];
  end.setSeconds(-1); // 月末最后一刻

  const orders = await db.supplierOrder.findMany({
    where: {
      wholesalerId,
      deletedAt: null,
      status: "COMPLETED",
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: {
          orderNumber: true,
          retailer: { include: { business: { select: { tradeName: true } } } },
        },
      },
      items: { select: { quantity: true, product: { select: { costPrice: true } } } },
    },
  });

  const rows = orders.map((o) => {
    const cost = o.items.reduce(
      (sum, it) => sum + (Number(it.product.costPrice ?? 0) * it.quantity || 0),
      0,
    );
    const amount = Number(o.total);
    return { o, amount, cost, margin: amount - cost };
  });
  const totalSales = rows.reduce((a, r) => a + r.amount, 0);
  const totalCost = rows.reduce((a, r) => a + r.cost, 0);
  const totalMargin = rows.reduce((a, r) => a + r.margin, 0);

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/wholesaler"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.nav.home}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-h1">
            <BarChart3 className="size-7 text-[var(--color-ink-3)]" /> {t.wsReports.title}
          </h1>
          <p className="text-body mt-1">{t.wsReports.desc}</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="text-xs text-[var(--color-ink-2)]">
            {t.wsReports.month}
            <select name="month" className="input mt-1 h-9 text-sm" defaultValue={picked}>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary h-9 px-3 text-sm">
            {t.common.view}
          </button>
        </form>
      </div>

      {/* 汇总 */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: t.wsReports.sales, val: totalSales },
          { label: t.wsReports.cost, val: totalCost },
          { label: t.wsReports.margin, val: totalMargin, tone: totalMargin >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]" },
        ].map((x) => (
          <div key={x.label} className="card p-5">
            <p className="text-meta text-xs">{x.label}</p>
            <p className={`amount mt-1 text-2xl ${x.tone ?? ""}`}>{money(x.val, cur)}</p>
          </div>
        ))}
      </div>
      <p className="text-meta mt-2 text-xs">{t.wsReports.marginNote}</p>

      {orders.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
          <BarChart3 className="mb-3 size-7 text-[var(--color-ink-3)]" strokeWidth={1.5} />
          <p className="text-h3 text-base">{t.wsReports.emptyReport}</p>
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line-2)] text-meta">
                <th className="px-5 py-3 font-medium">{t.wsReports.orderCol}</th>
                <th className="px-5 py-3 font-medium">{t.wsReports.dateCol}</th>
                <th className="px-5 py-3 font-medium">{t.wsReports.customerCol}</th>
                <th className="px-5 py-3 text-right font-medium">{t.wsReports.sales}</th>
                <th className="px-5 py-3 text-right font-medium">{t.wsReports.cost}</th>
                <th className="px-5 py-3 text-right font-medium">{t.wsReports.margin}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, amount, cost, margin }) => (
                <tr key={o.id} className="border-b border-[var(--color-line-2)] last:border-0">
                  <td className="px-5 py-3 font-medium">#{o.order.orderNumber}</td>
                  <td className="px-5 py-3 text-meta">{date(o.createdAt)}</td>
                  <td className="px-5 py-3">{o.order.retailer.business.tradeName ?? "—"}</td>
                  <td className="px-5 py-3 text-right">{money(amount, cur)}</td>
                  <td className="px-5 py-3 text-right text-meta">{money(cost, cur)}</td>
                  <td className={`px-5 py-3 text-right ${margin >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                    {money(margin, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orders.length > 0 && (
        <a
          href={`/wholesaler/reports/export-csv?month=${picked}`}
          className="btn btn-secondary mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm"
        >
          <FileDown className="size-4" /> {t.wsReports.exportCsv}
        </a>
      )}
    </div>
  );
}
