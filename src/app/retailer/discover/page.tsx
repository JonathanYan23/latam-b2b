import Link from "next/link";
import { Store, MapPin, Package, ArrowRight, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { fmt } from "@/i18n/utils";
import { relationshipStatusLabel, relationshipStatusTone } from "@/lib/format";

export const metadata = { title: "Find Suppliers" };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const t = await getDictionary();
  const retailerId = session.retailerId!;
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [wholesalers, relationships] = await Promise.all([
    db.wholesaler.findMany({
      where: query
        ? {
            OR: [
              { business: { tradeName: { contains: query } } },
              { business: { legalName: { contains: query } } },
              { user: { name: { contains: query } } },
            ],
          }
        : undefined,
      include: {
        business: { include: { city: true, country: true } },
        user: { select: { name: true } },
        _count: { select: { products: true } },
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

      {/* 搜索：批发商名 / 联系人名 */}
      <form
        action="/retailer/discover"
        method="get"
        className="mt-6 flex max-w-md items-center gap-2"
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
                  <Link
                    href={`/retailer/suppliers/${w.id}`}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    {t.discover.enter} <ArrowRight className="size-3.5" />
                  </Link>
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
