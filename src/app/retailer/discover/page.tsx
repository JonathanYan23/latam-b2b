import Image from "next/image";
import Link from "next/link";
import { Store, MapPin, Package, ArrowRight, Search, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { fmt } from "@/i18n/utils";
import { relationshipStatusLabel, relationshipStatusTone } from "@/lib/format";

export const metadata = { title: "Find Suppliers" };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; country?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const t = await getDictionary();
  const retailerId = session.retailerId!;
  const { q, country } = await searchParams;
  const query = (q ?? "").trim();
  const countryCode = country?.trim() || "";

  const [wholesalers, relationships] = await Promise.all([
    db.wholesaler.findMany({
      where: {
        AND: [
          ...(query
            ? [
                {
                  OR: [
                    { business: { tradeName: { contains: query } } },
                    { business: { legalName: { contains: query } } },
                    { user: { name: { contains: query } } },
                  ],
                },
              ]
            : []),
          ...(countryCode
            ? [{ business: { country: { code: countryCode } } }]
            : []),
        ],
      },
      include: {
        business: { include: { city: true, country: true } },
        user: { select: { name: true } },
        _count: { select: { products: true } },
        products: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { images: true, category: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.customerRelationship.findMany({
      where: { retailerId },
      select: { wholesalerId: true, status: true },
    }),
  ]);

  const relMap = new Map(relationships.map((r) => [r.wholesalerId, r.status]));

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <h1 className="text-h1">{t.discover.title}</h1>
      <p className="text-body mt-1">{t.discover.desc}</p>

      {/* 地区筛选：按国家 */}
      {(() => {
        const seen = new Map<string, string>();
        for (const w of wholesalers) {
          const c = w.business.country;
          if (c && !seen.has(c.code)) seen.set(c.code, c.name);
        }
        const codes = [...seen.entries()];
        if (codes.length < 2) return null;
        return (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-meta mr-1 text-xs">{t.discover.filterRegion}</span>
            <Link
              href={query ? `/retailer/discover?q=${encodeURIComponent(query)}` : "/retailer/discover"}
              className={
                !countryCode
                  ? "rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-[var(--color-line-2)] px-3 py-1 text-xs text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
              }
            >
              {t.common.all}
            </Link>
            {codes.map(([code, name]) => {
              const base = query ? `q=${encodeURIComponent(query)}&` : "";
              const active = countryCode === code;
              return (
                <Link
                  key={code}
                  href={`/retailer/discover?${base}country=${code}`}
                  className={
                    active
                      ? "rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-medium text-white"
                      : "rounded-full border border-[var(--color-line-2)] px-3 py-1 text-xs text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                  }
                >
                  {name}
                </Link>
              );
            })}
          </div>
        );
      })()}

      {/* 搜索：批发商名 / 联系人名 */}
      <form
        action="/retailer/discover"
        method="get"
        className="mt-4 flex max-w-md items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input
            name="q"
            defaultValue={query}
            placeholder={t.discover.searchPlaceholder}
            className="input pl-9"
          />
        </div>
        {countryCode && <input type="hidden" name="country" value={countryCode} />}
        <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
          {t.discover.searchBtn}
        </button>
      </form>

      {wholesalers.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <Store className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--color-ink-2)]">{t.discover.noResults}</p>
        </div>
      ) : (
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wholesalers.map((w) => {
          const status = relMap.get(w.id);
          const location = [
            w.business.city?.name,
            w.business.country?.name,
          ]
            .filter(Boolean)
            .join(", ");
          // 3–5 张代表性商品预览图（有图商品，去重，无价格无库存）
          const previewUrls: string[] = [];
          for (const prod of w.products) {
            try {
              const arr = JSON.parse(prod.images || "[]");
              if (Array.isArray(arr)) {
                for (const u of arr) {
                  if (typeof u === "string" && u && !previewUrls.includes(u)) {
                    previewUrls.push(u);
                  }
                  if (previewUrls.length >= 4) break;
                }
              }
            } catch { /* ignore */ }
            if (previewUrls.length >= 4) break;
          }
          const summary = w.business.categorySummary?.trim();
          return (
            <div key={w.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-muted)]">
                  <Store className="size-5 text-[var(--color-ink-2)]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{w.business.tradeName}</p>
                  <p className="text-meta mt-0.5 flex items-center gap-1 text-xs">
                    {location && (
                      <>
                        <MapPin className="size-3 shrink-0" /> {location}
                      </>
                    )}
                  </p>
                  {w.user?.name && (
                    <p className="text-meta mt-0.5 truncate text-[11px]">
                      {t.common.contactPerson}: {w.user.name}
                    </p>
                  )}
                </div>
                {status && (
                  <span
                    className={`badge shrink-0 ${relationshipStatusTone(status)}`}
                  >
                    {relationshipStatusLabel(status, t)}
                  </span>
                )}
              </div>

              {summary && (
                <p className="mt-3 truncate text-xs text-[var(--color-ink-2)]">
                  <span className="font-medium">{t.discover.categoryLine}</span>
                  {summary}
                </p>
              )}
              {previewUrls.length > 0 && (
                <div className="mt-2.5 flex gap-1.5">
                  {previewUrls.map((u, i) => (
                    <span
                      key={u}
                      className="relative block size-12 shrink-0 overflow-hidden rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-muted)]"
                    >
                      <Image
                        src={u}
                        alt=""
                        data-zoom
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized
                      />
                    </span>
                  ))}
                </div>
              )}
              <p className="text-meta mt-3 flex items-center gap-1 text-xs">
                <Package className="size-3.5" />{" "}
                {fmt(t.suppliers.productsCount, { n: w._count.products })}
              </p>

              <div className="mt-4 border-t border-[var(--color-line-2)] pt-4">
                <div className="flex items-center justify-between gap-2">
                  {!status && (
                    <span className="text-xs text-[var(--color-ink-3)]">
                      {t.discover.notCustomer}
                    </span>
                  )}
                  {!status && <span className="flex-1" />}
                  <div className="flex items-center gap-1.5">
                    {status === "APPROVED" && (
                      <Link
                        href={`/retailer/suppliers/${w.id}/chat`}
                        title={t.common.chat}
                        aria-label={t.common.chat}
                        className="grid size-8 place-items-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-bg)] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white"
                      >
                        <MessageCircle className="size-4" />
                      </Link>
                    )}
                    <Link
                      href={`/retailer/suppliers/${w.id}`}
                      className="btn btn-secondary px-3 py-1.5 text-xs"
                    >
                      {t.discover.enter} <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
