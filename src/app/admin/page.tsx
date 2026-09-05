import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import {getDictionary} from "@/i18n";
import { date } from "@/lib/format";

export default async function AdminHome() {
  const t = await getDictionary();
  const [users, wholesalers, retailers, products, orders, countries] =
    await Promise.all([
      db.user.count(),
      db.wholesaler.count(),
      db.retailer.count(),
      db.product.count(),
      db.order.count(),
      db.country.count(),
    ]);

  const recentUsers = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { retailer: true, wholesaler: { include: { business: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <h1 className="text-h1">{t.admin.title}</h1>
      <p className="text-body mt-1">{t.admin.desc}</p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { label: t.admin.users, value: users },
          { label: t.admin.wholesalers, value: wholesalers },
          { label: t.admin.retailers, value: retailers },
          { label: t.admin.products, value: products },
          { label: t.admin.orders, value: orders },
          { label: t.admin.countries, value: countries },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-lg font-semibold">{s.value}</p>
            <p className="text-meta mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 管理入口 */}
      <h2 className="text-h2 mt-10 text-lg">{t.admin.title}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {[
          { href: "/admin/wholesalers", label: t.admin.wholesalers },
          { href: "/admin/retailers", label: t.admin.retailers },
          { href: "/admin/products", label: t.admin.products },
        ].map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="card card-hover group flex items-center justify-between p-5"
          >
            <p className="font-semibold">{e.label}</p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-ink-3)] transition-colors group-hover:text-[var(--color-ink)]">
              {t.admin.viewAll} <ArrowRight className="size-4" />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="text-h2 mt-10 text-lg">{t.admin.recentUsers}</h2>
      <div className="card mt-3 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line-2)] text-meta">
              <th className="px-5 py-3 font-medium">{t.admin.name}</th>
              <th className="px-5 py-3 font-medium">{t.admin.email}</th>
              <th className="px-5 py-3 font-medium">{t.admin.role}</th>
              <th className="px-5 py-3 font-medium">{t.admin.business}</th>
              <th className="px-5 py-3 font-medium">{t.admin.joined}</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((u) => (
              <tr
                key={u.id}
                className="border-b border-[var(--color-line-2)] last:border-0"
              >
                <td className="px-5 py-3 font-medium">{u.name ?? "—"}</td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">{u.email}</td>
                <td className="px-5 py-3">
                  <span className="badge badge-neutral">{u.role}</span>
                </td>
                <td className="px-5 py-3 text-[var(--color-ink-2)]">
                  {u.wholesaler?.business.tradeName ?? u.retailer?.businessId ?? "—"}
                </td>
                <td className="px-5 py-3 text-[var(--color-ink-3)]">
                  {date(u.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
