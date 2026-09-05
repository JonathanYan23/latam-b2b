import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";

export const metadata = { title: "Retailers" };

export default async function AdminRetailersPage() {
  await requireRole("ADMIN");
  const t = await getDictionary();

  const retailers = await db.retailer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      business: { include: { country: true } },
      user: { select: { email: true } },
      _count: { select: { approvedCustomer: true, orders: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/admin"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.admin.title}
      </Link>
      <h1 className="text-h1">{t.admin.retailers}</h1>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line-2)] text-meta">
              <th className="px-5 py-3 font-medium">{t.admin.name}</th>
              <th className="px-5 py-3 font-medium">{t.admin.email}</th>
              <th className="px-5 py-3 font-medium">{t.admin.country}</th>
              <th className="px-5 py-3 font-medium">{t.admin.relationships}</th>
              <th className="px-5 py-3 font-medium">{t.admin.orders}</th>
              <th className="px-5 py-3 text-right font-medium">{t.admin.viewDetails}</th>
            </tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.id} className="border-b border-[var(--color-line-2)] last:border-0">
                <td className="px-5 py-3 font-medium">
                  {r.business.tradeName ?? r.business.legalName}
                </td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">{r.user?.email ?? "—"}</td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">
                  {r.business.country?.name ?? "—"}
                </td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">
                  {r._count.approvedCustomer}
                </td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">{r._count.orders}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/retailers/${r.id}`}
                    className="text-sm font-medium text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                  >
                    {t.admin.viewDetails} →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
