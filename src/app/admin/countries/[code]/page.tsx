import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { money, orderStatusLabel } from "@/lib/format";
import type { Dict } from "@/i18n";

export const metadata = { title: "Country" };

export default async function AdminCountryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireRole("ADMIN");
  const t = await getDictionary();
  const { code } = await params;

  const country = await db.country.findUnique({ where: { code } });
  if (!country) notFound();

  const [users, wholesalers, retailers, products, orders] = await Promise.all([
    db.user.findMany({
      where: {
        OR: [
          { wholesaler: { business: { countryId: country.id } } },
          { retailer: { business: { countryId: country.id } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        retailer: { select: { id: true, business: { select: { tradeName: true } } } },
        wholesaler: { select: { id: true, business: { select: { tradeName: true } } } },
      },
    }),
    db.wholesaler.findMany({
      where: { business: { countryId: country.id } },
      include: { business: true, user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.retailer.findMany({
      where: { business: { countryId: country.id } },
      include: { business: true, user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({
      where: { wholesaler: { business: { countryId: country.id } } },
      include: { wholesaler: { include: { business: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.supplierOrder.findMany({
      where: { wholesaler: { business: { countryId: country.id } } },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        wholesaler: { include: { business: true } },
        order: { include: { retailer: { include: { business: true } } } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/admin"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.admin.title}
      </Link>
      <h1 className="text-h1">
        {country.name} <span className="badge badge-neutral ml-2 align-middle">{country.code}</span>
      </h1>

      {/* 批发商 */}
      <Section title={`${t.admin.wholesalers}（${wholesalers.length}）`}>
        {wholesalers.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-[var(--color-line-2)]">
            {wholesalers.map((w) => (
              <li key={w.id}>
                <Link href={`/admin/wholesalers/${w.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-bg-subtle)]">
                  <span className="font-medium">{w.business.tradeName ?? w.business.legalName}</span>
                  <span className="text-meta text-xs">{w.user?.email ?? "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 零售商 */}
      <Section title={`${t.admin.retailers}（${retailers.length}）`}>
        {retailers.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-[var(--color-line-2)]">
            {retailers.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/retailers/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-bg-subtle)]">
                  <span className="font-medium">{r.business.tradeName ?? r.business.legalName}</span>
                  <span className="text-meta text-xs">{r.user?.email ?? "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 用户 */}
      <Section title={`${t.admin.users}（${users.length}）`}>
        {users.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line-2)] text-meta">
                <th className="px-5 py-2.5 font-medium">{t.admin.name}</th>
                <th className="px-5 py-2.5 font-medium">{t.admin.email}</th>
                <th className="px-5 py-2.5 font-medium">{t.admin.role}</th>
                <th className="px-5 py-2.5 font-medium">{t.admin.business}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const biz = u.wholesaler?.business.tradeName ?? u.retailer?.business.tradeName;
                const href = u.wholesaler
                  ? `/admin/wholesalers/${u.wholesaler.id}`
                  : u.retailer
                    ? `/admin/retailers/${u.retailer.id}`
                    : null;
                return (
                  <tr key={u.id} className="border-b border-[var(--color-line-2)] last:border-0">
                    <td className="px-5 py-3 font-medium">{u.name ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-2)]">{u.email}</td>
                    <td className="px-5 py-3"><span className="badge badge-neutral">{u.role}</span></td>
                    <td className="px-5 py-3 text-[var(--color-ink-2)]">
                      {href ? <Link href={href} className="hover:underline">{biz ?? "—"}</Link> : biz ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* 商品 */}
      <Section title={`${t.admin.products}（${products.length}）`}>
        {products.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-[var(--color-line-2)]">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-[var(--color-bg-subtle)]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-meta text-xs">{p.sku} · {p.wholesaler.business.tradeName ?? p.wholesaler.business.legalName}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{money(p.publicPrice ?? 0, p.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 订单 */}
      <Section title={`${t.admin.orders}（${orders.length}）`}>
        {orders.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-[var(--color-line-2)]">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">#{o.order.orderNumber}</span>
                  <span className="text-meta text-xs">
                    {o.wholesaler.business.tradeName ?? ""} → {o.order.retailer.business.tradeName ?? o.order.retailer.business.legalName}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold">{money(o.total, o.currency)}</span>
                  <span className="badge badge-neutral">{orderStatusLabel(o.status, t)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-h3 text-[15px]">{title}</h2>
      <div className="card mt-2 overflow-x-auto">{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">—</p>
  );
}

export const dynamic = "force-dynamic";
export type AdminDict = Dict;
