import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { money } from "@/lib/format";
import { ConnectRetailerForm } from "../connect-retailer-form";

export default async function AdminWholesalerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const t = await getDictionary();
  const { id } = await params;

  const ws = await db.wholesaler.findUnique({
    where: { id },
    include: {
      business: { include: { country: true, city: true } },
      user: { select: { email: true, name: true, plan: true } },
      products: { include: { category: true }, orderBy: { createdAt: "desc" } },
      customers: {
        include: { retailer: { include: { business: true } } },
      },
    },
  });
  if (!ws) notFound();

  const retailers = await db.retailer.findMany({
    include: { business: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/admin/wholesalers"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.admin.wholesalers}
      </Link>

      <div className="card flex items-center gap-4 p-6">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-[var(--color-bg-muted)]">
          {ws.business.logo && (
            <Image src={ws.business.logo} alt="" fill sizes="56px" className="object-cover" unoptimized />
          )}
        </span>
        <div className="min-w-0">
          <h1 className="text-h2">{ws.business.tradeName ?? ws.business.legalName}</h1>
          <p className="text-meta mt-0.5 text-sm">
            {ws.business.legalName}
            {ws.business.taxId && ` · ${ws.business.taxId}`}
            {ws.business.country && ` · ${ws.business.country.name}`}
          </p>
          <p className="text-meta mt-0.5 text-xs">
            {ws.user?.email} · {t.admin.role}: WHOLESALER
            {ws.user?.plan === "PLUS" && ` · ${t.admin.connect}`}
          </p>
        </div>
      </div>

      {/* 商品 */}
      <h2 className="text-h2 mt-8 text-lg">
        {t.admin.products}（{ws.products.length}）
      </h2>
      <div className="card mt-3 divide-y divide-[var(--color-line-2)]">
        {ws.products.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">—</p>
        ) : (
          ws.products.slice(0, 30).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-meta text-xs">
                  {t.admin.sku}: {p.sku}
                  {p.category && ` · ${p.category.name}`}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">
                {money(p.publicPrice ?? 0, p.currency)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* 客户关系 */}
      <h2 className="text-h2 mt-8 text-lg">{t.admin.relationships}</h2>
      <div className="card mt-3 divide-y divide-[var(--color-line-2)]">
        {ws.customers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">
            {t.admin.noRelationships}
          </p>
        ) : (
          ws.customers.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium">
                  {r.retailer.business.tradeName ?? r.retailer.business.legalName}
                </p>
                <p className="text-meta text-xs">
                  {r.retailer.business.legalName} · {r.tier}
                </p>
              </div>
              <span className="badge badge-success">{r.status}</span>
            </div>
          ))
        )}
      </div>

      {/* 连接零售商 */}
      <div className="card mt-6 p-5">
        <h3 className="text-h3 text-[15px]">{t.admin.connectRetailer}</h3>
        <div className="mt-3">
          <ConnectRetailerForm
            wholesalerId={id}
            retailers={retailers.map((r) => ({
              id: r.id,
              name: r.business.tradeName ?? r.business.legalName,
            }))}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
