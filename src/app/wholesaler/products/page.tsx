import Image from "next/image";
import Link from "next/link";
import { Plus, PackageX, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary, getLocale } from "@/i18n";
import { catName } from "@/lib/cat";
import { fmt } from "@/i18n/utils";
import { money, sellingModeLabel } from "@/lib/format";
import { parseImages } from "@/lib/pricing";
import { StockUpdater, ImportCsvButton } from "./product-tools";

export const metadata = { title: "Products" };

export default async function WholesalerProductsPage() {
  const session = await requireRole("WHOLESALER");
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const wholesalerId = session.wholesalerId!;

  const products = await db.product.findMany({
    where: { wholesalerId },
    orderBy: { createdAt: "desc" },
    include: { category: true, inventories: true },
  });

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-h1">{t.wsProducts.title}</h1>
          <p className="text-body mt-1">
            {fmt(t.wsProducts.countDesc, { n: products.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCsvButton t={t} />
          <Link
            href="/wholesaler/products/new"
            className="btn btn-primary px-4 py-2 text-sm"
          >
            <Plus className="size-4" /> {t.wsProducts.addProduct}
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <PackageX className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
          <p className="text-h3 text-base">{t.wsProducts.emptyTitle}</p>
          <p className="text-meta mt-1.5 max-w-sm">{t.wsProducts.emptyDesc}</p>
          <div className="mt-6 flex gap-2">
            <Link
              href="/wholesaler/products/new"
              className="btn btn-primary px-5 py-2 text-sm"
            >
              {t.wsProducts.addProduct}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const [img] = parseImages(p.images);
            const stock = p.inventories.reduce((x, i) => x + i.stock, 0);
            return (
              <div key={p.id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-muted)]">
                    {img && (
                      <Image src={img} alt={p.name} fill sizes="48px" className="object-cover" unoptimized />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-meta text-xs">{p.sku}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {p.category && (
                        <span className="badge badge-neutral">{catName(p.category, locale)}</span>
                      )}
                      <span className="badge badge-neutral">{sellingModeLabel(p.sellingMode, t)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-[var(--color-line-2)] pt-3">
                  <div>
                    <p className="text-meta text-xs">{t.common.moq} {p.moq}</p>
                    <p className="text-lg font-semibold">{money(p.publicPrice)}</p>
                  </div>
                  <Link
                    href={`/wholesaler/products/${p.id}/edit`}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    <Pencil className="size-3.5" /> {t.wsProducts.edit}
                  </Link>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--color-line-2)] px-3 py-2">
                  <span
                    className={`text-xs font-medium ${
                      stock <= 0
                        ? "text-[var(--color-danger)]"
                        : stock < 20
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-ink-2)]"
                    }`}
                  >
                    {stock <= 0
                      ? t.common.outOfStock
                      : stock < 20
                        ? fmt("{l} · {n}", { l: t.common.lowStock, n: stock })
                        : fmt("{n} {u} " + t.common.inStock, { n: stock, u: t.common.units })}
                  </span>
                  <StockUpdater productId={p.id} initial={stock} t={t} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
