import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { money } from "@/lib/format";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  await requireRole("ADMIN");
  const t = await getDictionary();

  const products = await db.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { wholesaler: { include: { business: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/admin"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.admin.title}
      </Link>
      <h1 className="text-h1">{t.admin.products}</h1>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line-2)] text-meta">
              <th className="px-5 py-3 font-medium">{t.admin.name}</th>
              <th className="px-5 py-3 font-medium">{t.admin.sku}</th>
              <th className="px-5 py-3 font-medium">{t.admin.wholesalers}</th>
              <th className="px-5 py-3 font-medium">{t.admin.products}</th>
              <th className="px-5 py-3 text-right font-medium">{t.admin.viewDetails}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-[var(--color-line-2)] last:border-0">
                <td className="px-5 py-3 font-medium">{p.name}</td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">{p.sku}</td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">
                  {p.wholesaler.business.tradeName ?? p.wholesaler.business.legalName}
                </td>
                <td className="px-5 py-3 font-medium">{money(p.publicPrice ?? 0, p.currency)}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/products/${p.id}`}
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
