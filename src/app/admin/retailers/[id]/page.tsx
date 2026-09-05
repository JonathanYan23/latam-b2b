import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";

export default async function AdminRetailerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const t = await getDictionary();
  const { id } = await params;

  const rt = await db.retailer.findUnique({
    where: { id },
    include: {
      business: { include: { country: true } },
      user: { select: { email: true, name: true } },
      approvedCustomer: {
        include: { wholesaler: { include: { business: true } } },
      },
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!rt) notFound();

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/admin/retailers"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.admin.retailers}
      </Link>

      <div className="card p-6">
        <h1 className="text-h2">{rt.business.tradeName ?? rt.business.legalName}</h1>
        <p className="text-meta mt-0.5 text-sm">
          {rt.business.legalName}
          {rt.business.taxId && ` · ${rt.business.taxId}`}
          {rt.business.country && ` · ${rt.business.country.name}`}
        </p>
        <p className="text-meta mt-0.5 text-xs">{rt.user?.email}</p>
      </div>

      <h2 className="text-h2 mt-8 text-lg">{t.admin.relationships}</h2>
      <div className="card mt-3 divide-y divide-[var(--color-line-2)]">
        {rt.approvedCustomer.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">
            {t.admin.noRelationships}
          </p>
        ) : (
          rt.approvedCustomer.map((r) => (
            <Link
              key={r.id}
              href={`/admin/wholesalers/${r.wholesalerId}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-bg-subtle)]"
            >
              <div>
                <p className="text-sm font-medium">
                  {r.wholesaler.business.tradeName ?? r.wholesaler.business.legalName}
                </p>
                <p className="text-meta text-xs">{r.tier}</p>
              </div>
              <span className="badge badge-success">{r.status}</span>
            </Link>
          ))
        )}
      </div>

      <h2 className="text-h2 mt-8 text-lg">{t.admin.orders}（{rt.orders.length}）</h2>
      <div className="card mt-3 divide-y divide-[var(--color-line-2)]">
        {rt.orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">—</p>
        ) : (
          rt.orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-5 py-3">
              <p className="text-sm font-medium">#{o.orderNumber}</p>
              <span className="badge badge-neutral">{o.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
