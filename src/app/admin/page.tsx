import Link from "next/link";
import { Search, ArrowRight, Globe2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { date } from "@/lib/format";
import { fmt } from "@/i18n/utils";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole("ADMIN");
  const t = await getDictionary();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  // 用户查询（按姓名/邮箱）
  const users = query
    ? await db.user.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          retailer: { select: { id: true, business: { select: { tradeName: true, country: true } } } },
          wholesaler: { select: { id: true, business: { select: { tradeName: true, country: true } } } },
        },
      })
    : await db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          retailer: { select: { id: true, business: { select: { tradeName: true, country: true } } } },
          wholesaler: { select: { id: true, business: { select: { tradeName: true, country: true } } } },
        },
      });

  // 国家聚合（只显示有注册的国家）
  const groups = await db.business.groupBy({
    by: ["countryId"],
    where: { countryId: { not: null } },
    _count: { _all: true },
  });

  const countryStats = await Promise.all(
    groups.map(async (g) => {
      const countryId = g.countryId!;
      const [wsCount, rtCount, productCount, orderCount] = await Promise.all([
        db.wholesaler.count({ where: { business: { countryId } } }),
        db.retailer.count({ where: { business: { countryId } } }),
        db.product.count({ where: { wholesaler: { business: { countryId } } } }),
        db.supplierOrder.count({ where: { wholesaler: { business: { countryId } } } }),
      ]);
      const country = await db.country.findUnique({ where: { id: countryId } });
      return {
        country,
        companies: g._count._all,
        wsCount,
        rtCount,
        productCount,
        orderCount,
      };
    }),
  );
  const stats = countryStats
    .filter((s) => s.country)
    .sort((a, b) => b.companies - a.companies);

  const entityOf = (u: (typeof users)[number]) => {
    const ws = u.wholesaler;
    const rt = u.retailer;
    return {
      href: ws ? `/admin/wholesalers/${ws.id}` : rt ? `/admin/retailers/${rt.id}` : null,
      business: ws?.business?.tradeName ?? rt?.business?.tradeName ?? null,
      country: ws?.business?.country?.name ?? rt?.business?.country?.name ?? null,
      role: u.role,
    };
  };

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <h1 className="text-h1">{t.admin.title}</h1>
      <p className="text-body mt-1">{t.admin.desc}</p>

      {/* 用户查询 */}
      <div className="card mt-8 p-6">
        <h2 className="text-h3 text-[15px]">{t.admin.usersSearch}</h2>
        <p className="text-meta mt-1 text-xs">{t.admin.usersSearchHint}</p>
        <form action="/admin" method="get" className="mt-3 flex max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
            <input name="q" defaultValue={query} className="input pl-9" placeholder={t.admin.usersSearchHint} />
          </div>
          <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
            {t.admin.usersSearch}
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          {users.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-ink-3)]">
              {t.admin.noUsers}
            </p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line-2)] text-meta">
                  <th className="px-3 py-2.5 font-medium">{t.admin.name}</th>
                  <th className="px-3 py-2.5 font-medium">{t.admin.email}</th>
                  <th className="px-3 py-2.5 font-medium">{t.admin.role}</th>
                  <th className="px-3 py-2.5 font-medium">{t.admin.business}</th>
                  <th className="px-3 py-2.5 font-medium">{t.admin.joined}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t.admin.manageBtn}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const e = entityOf(u);
                  return (
                    <tr key={u.id} className="border-b border-[var(--color-line-2)] last:border-0">
                      <td className="px-3 py-3 font-medium">{u.name ?? "—"}</td>
                      <td className="px-3 py-3 text-[var(--color-ink-2)]">{u.email}</td>
                      <td className="px-3 py-3">
                        <span className="badge badge-neutral">{u.role}</span>
                      </td>
                      <td className="px-3 py-3 text-[var(--color-ink-2)]">
                        {e.business ?? "—"}
                        {e.country && <span className="ml-1 text-[11px]">· {e.country}</span>}
                      </td>
                      <td className="px-3 py-3 text-[var(--color-ink-3)]">{date(u.createdAt)}</td>
                      <td className="px-3 py-3 text-right">
                        {e.href ? (
                          <Link
                            href={e.href}
                            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                          >
                            {t.admin.manageBtn} →
                          </Link>
                        ) : (
                          <span className="text-[var(--color-ink-3)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 国家与地区 */}
      <h2 className="text-h2 mt-10 flex items-center gap-2 text-lg">
        <Globe2 className="size-5 text-[var(--color-ink-3)]" /> {t.admin.countriesList}
      </h2>
      <p className="text-meta mt-1 text-xs">
        {t.admin.noRegions}:{" "}
        {stats.map((s) => s.country!.name).join(" · ") || "—"}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.country!.id}
            href={`/admin/countries/${s.country!.code}`}
            className="card card-hover group flex flex-col p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{s.country!.name}</p>
                <p className="text-meta mt-0.5 text-xs">{s.country!.code}</p>
              </div>
              <span className="badge badge-neutral">{s.companies}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-[var(--color-bg-subtle)] py-2">
                <p className="font-semibold">{s.wsCount}</p>
                <p className="text-meta">{t.admin.wholesalers}</p>
              </div>
              <div className="rounded-lg bg-[var(--color-bg-subtle)] py-2">
                <p className="font-semibold">{s.rtCount}</p>
                <p className="text-meta">{t.admin.retailers}</p>
              </div>
              <div className="rounded-lg bg-[var(--color-bg-subtle)] py-2">
                <p className="font-semibold">{s.productCount}</p>
                <p className="text-meta">{t.admin.products}</p>
              </div>
            </div>
            <p className="text-meta mt-2 text-center text-[11px]">
              {fmt(t.admin.companies, { n: s.companies })} · {t.admin.orders}: {s.orderCount}
            </p>
            <span className="mt-3 inline-flex items-center justify-center gap-1 text-xs font-medium text-[var(--color-ink-3)] transition-colors group-hover:text-[var(--color-ink)]">
              {t.admin.viewCountry} <ArrowRight className="size-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
