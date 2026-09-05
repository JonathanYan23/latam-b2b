import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";

export const metadata = { title: "Wholesalers" };

export default async function AdminWholesalersPage() {
  await requireRole("ADMIN");
  const t = await getDictionary();

  const wholesalers = await db.wholesaler.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      business: { include: { country: true } },
      user: { select: { email: true, name: true } },
      _count: { select: { products: true, customers: true } },
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
      <h1 className="text-h1">{t.admin.wholesalers}</h1>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line-2)] text-meta">
              <th className="px-5 py-3 font-medium">{t.admin.name}</th>
              <th className="px-5 py-3 font-medium">{t.admin.email}</th>
              <th className="px-5 py-3 font-medium">{t.admin.country}</th>
              <th className="px-5 py-3 font-medium">{t.admin.products}</th>
              <th className="px-5 py-3 font-medium">{t.admin.relationships}</th>
              <th className="px-5 py-3 text-right font-medium">{t.admin.viewDetails}</th>
            </tr>
          </thead>
          <tbody>
            {wholesalers.map((w) => (
              <tr key={w.id} className="border-b border-[var(--color-line-2)] last:border-0">
                <td className="px-5 py-3 font-medium">
                  {w.business.tradeName ?? w.business.legalName}
                </td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">{w.user?.email ?? "—"}</td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">
                  {w.business.country?.name ?? "—"}
                </td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">{w._count.products}</td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">
                  {w._count.customers}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/wholesalers/${w.id}`}
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
