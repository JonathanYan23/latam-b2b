import Link from "next/link";
import Image from "next/image";
import { Search, SlidersHorizontal, PackageX, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { priceView, parseImages } from "@/lib/pricing";
import { money } from "@/lib/format";
import { getDictionary, getLocale } from "@/i18n";
import { catName } from "@/lib/cat";
import { fmt } from "@/i18n/utils";

export const metadata = { title: "Browse" };

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; sort?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const retailerId = session.retailerId!;
  const { q, cat, sort } = await searchParams;

  const [categories, relationships, products] = await Promise.all([
    db.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.customerRelationship.findMany({
      where: { retailerId },
      select: { id: true, wholesalerId: true, status: true },
    }),
    db.product.findMany({
      where: {
        active: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
                { description: { contains: q } },
                { keywords: { contains: q } },
              ],
            }
          : {}),
        ...(cat ? { categoryId: cat } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        wholesaler: { include: { business: true } },
        category: true,
        inventories: true,
      },
    }),
  ]);

  const relMap = new Map(relationships.map((r) => [r.wholesalerId, r]));

  const relIds = relationships.map((r) => r.id);
  const customerPrices = relIds.length
    ? await db.customerPrice.findMany({
        where: { relationshipId: { in: relIds } },
        select: { productId: true, relationshipId: true, price: true },
      })
    : [];
  const cpMap = new Map(customerPrices.map((cp) => [cp.productId, cp]));

  // 智能排序：综合(默认=最新上架) / 价格升 / 价格降（按用户可见价）
  const rows = products.map((prod) => {
    const rel = relMap.get(prod.wholesalerId);
    const cp = cpMap.get(prod.id);
    const view = priceView(prod, rel, cp);
    return {
      p: prod,
      view,
      price: view.price ? Number(view.price) : Number.POSITIVE_INFINITY,
    };
  });
  if (sort === "price-asc") rows.sort((x, y) => x.price - y.price);
  else if (sort === "price-desc") rows.sort((x, y) => y.price - x.price);

  // 无结果 → 相似替代推荐（去掉关键词过滤，保留当前分类；最新 6 件）
  const queryTrim = (q ?? "").trim();
  const needAlt = queryTrim.length > 0 && rows.length === 0;
  const alternatives = needAlt
    ? await db.product.findMany({
        where: {
          active: true,
          ...(cat ? { categoryId: cat } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          wholesaler: { include: { business: true } },
          category: true,
          inventories: true,
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-h1">{t.browse.title}</h1>
          <p className="text-body mt-1">{t.browse.desc}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.browse.searchPlaceholder}
            className="input pl-10"
          />
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-xs text-[var(--color-ink-3)]">
            <SlidersHorizontal className="size-3.5" /> {t.browse.category}
          </span>
          <Link
            href="/retailer/browse"
            className={`badge px-3 py-1.5 text-[13px] transition-colors ${
              !cat ? "badge-neutral" : "hover:border-[var(--color-ink-3)]"
            }`}
          >
            {t.common.all}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={{
                pathname: "/retailer/browse",
                query: { ...(q && { q }), cat: c.id },
              }}
              className={`badge px-3 py-1.5 text-[13px] transition-colors ${
                cat === c.id ? "badge-neutral" : "hover:border-[var(--color-ink-3)]"
              }`}
            >
              {catName(c, locale)}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        alternatives.length > 0 ? (
          <div className="card mt-8 p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--color-accent)]" />
              <h2 className="text-[15px] font-semibold">{t.browse.similarTitle}</h2>
            </div>
            <p className="text-meta mt-1 text-sm">{t.browse.similarDesc}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {alternatives.map((a) => {
                const relA = relMap.get(a.wholesalerId);
                const cpA = cpMap.get(a.id);
                const viewA = priceView(a, relA, cpA);
                const stockA = a.inventories.reduce((x, i) => x + i.stock, 0);
                const [imgA] = parseImages(a.images);
                return (
                  <Link
                    key={a.id}
                    href={`/retailer/products/${a.id}`}
                    className="card card-hover group flex flex-col overflow-hidden"
                  >
                    <div className="relative aspect-square w-full bg-[var(--color-bg-muted)]">
                      {imgA && (
                        <Image src={imgA} alt={a.name} fill sizes="(max-width:640px) 100vw,25vw" data-zoom className="object-cover" unoptimized />
                      )}
                      <span className={`badge absolute left-3 top-3 backdrop-blur-sm ${stockA <= 0 ? "badge-danger" : stockA < 20 ? "badge-warning" : "badge-success"}`}>
                        {stockA <= 0 ? t.common.outOfStock : t.common.inStock}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="text-meta truncate text-[11px]">{a.wholesaler.business.tradeName}</p>
                      <h3 className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">{a.name}</h3>
                      <div className="mt-auto pt-1">
                        {viewA.price ? (
                          <p className="text-base font-bold">{money(viewA.price, cur)}</p>
                        ) : (
                          <span className="badge badge-info">{t.browse.requestPricing}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
            <PackageX className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
            <p className="text-h3 text-base">{t.browse.noProductsTitle}</p>
            <p className="text-meta mt-1.5">{t.browse.noProductsDesc}</p>
          </div>
        )
      ) : (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {[
              { s: undefined, label: t.browse.sortDefault },
              { s: "price-asc", label: t.browse.sortPriceAsc },
              { s: "price-desc", label: t.browse.sortPriceDesc },
            ].map((o) => {
              const active = o.s ? sort === o.s : !sort;
              const href = {
                pathname: "/retailer/browse",
                query: {
                  ...(q ? { q } : {}),
                  ...(cat ? { cat } : {}),
                  ...(o.s ? { sort: o.s } : {}),
                },
              };
              return (
                <Link
                  key={o.s ?? "default"}
                  href={href}
                  className={
                    active
                      ? "rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-full border border-[var(--color-line-2)] px-3 py-1.5 text-xs text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                  }
                >
                  {o.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ p, view }) => {
            const stock = p.inventories.reduce((s, i) => s + i.stock, 0);
            const [img] = parseImages(p.images);

            return (
              <Link
                key={p.id}
                href={`/retailer/products/${p.id}`}
                className="card card-hover group flex flex-col overflow-hidden"
              >
                <div className="relative aspect-square w-full bg-[var(--color-bg-muted)]">
                  {img && (
                    <Image
                      src={img}
                      alt={p.name}
                      data-zoom
                      fill
                      sizes="(max-width: 640px) 100vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      unoptimized
                    />
                  )}
                  <span
                    className={`badge absolute left-3 top-3 backdrop-blur-sm ${
                      stock <= 0
                        ? "badge-danger"
                        : stock < 20
                          ? "badge-warning"
                          : "badge-success"
                    }`}
                  >
                    {stock <= 0
                      ? t.common.outOfStock
                      : stock < 20
                        ? fmt(t.common.lowStock + " · {n} " + t.common.units, { n: stock })
                        : t.common.inStock}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-meta truncate text-[11px]">
                    {p.wholesaler.business.tradeName}
                  </p>
                  <h3 className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">
                    {p.name}
                  </h3>
                  <p className="text-meta mt-1 text-[11px]">
                    {t.common.moq} {p.moq}
                  </p>
                  <div className="mt-auto flex items-end justify-between pt-2">
                    {view.price ? (
                      <div>
                        <p className="text-base font-bold">{money(view.price, cur)}</p>
                        {view.priceType === "CUSTOMER" && (
                          <p className="text-[11px] font-medium text-[var(--color-accent)]">
                            {t.browse.yourPrice}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="badge badge-info">{t.browse.requestPricing}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
