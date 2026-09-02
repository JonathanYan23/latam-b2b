import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, BadgeCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { priceView, parseImages } from "@/lib/pricing";
import { money } from "@/lib/format";
import { fmt } from "@/i18n/utils";
import { catName } from "@/lib/cat";
import { getDictionary, getLocale } from "@/i18n";
import { RequestPricingButton } from "./request-button";
import { AddToOrderButton } from "./add-to-order-button";

export const metadata = { title: "Product" };

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const retailerId = session.retailerId!;
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: {
      wholesaler: {
        include: { business: { include: { city: true, country: true } } },
      },
      category: true,
      inventories: { include: { warehouse: true } },
    },
  });
  if (!product) notFound();

  const relationship = await db.customerRelationship.findUnique({
    where: {
      wholesalerId_retailerId: {
        wholesalerId: product.wholesalerId,
        retailerId,
      },
    },
    select: { id: true, status: true, tier: true, paymentTerms: true },
  });

  const customerPrice =
    relationship?.status === "APPROVED"
      ? await db.customerPrice.findUnique({
          where: {
            productId_relationshipId: {
              productId: product.id,
              relationshipId: relationship.id,
            },
          },
        })
      : null;

  const view = priceView(product, relationship, customerPrice);
  const images = parseImages(product.images);
  const stock = product.inventories.reduce((s, i) => s + i.stock, 0);
  const location = [
    product.wholesaler.business.city?.name,
    product.wholesaler.business.country?.name,
  ]
    .filter(Boolean)
    .join(", ");

  const relStatus =
    relationship?.status === "APPROVED"
      ? "APPROVED"
      : relationship?.status === "PENDING"
        ? "PENDING"
        : relationship?.status === "REJECTED"
          ? "REJECTED"
          : "NONE";

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <p className="text-meta mb-5">
        <Link href="/retailer/browse" className="hover:text-[var(--color-ink)]">
          {t.browse.title}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--color-ink-2)]">{product.name}</span>
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        {/* 图片区 */}
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-muted)]">
            {images[0] && (
              <Image
                src={images[0]}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                unoptimized
              />
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.slice(1).map((img, i) => (
                <div
                  key={i}
                  className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-muted)]"
                >
                  <Image
                    src={img}
                    alt={`${product.name} ${i + 2}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 信息区 */}
        <div>
          <div className="flex items-center gap-1.5 text-sm text-[var(--color-ink-2)]">
            <BadgeCheck className="size-4 text-[var(--color-ink-3)]" />
            {product.wholesaler.business.tradeName}
            {location && (
              <span className="flex items-center gap-1 text-[var(--color-ink-3)]">
                · <MapPin className="size-3.5" /> {location}
              </span>
            )}
          </div>
          <h1 className="text-h1 mt-2">{product.name}</h1>
          <p className="text-meta mt-1">SKU: {product.sku}</p>

          {product.category && (
            <span className="badge badge-neutral mt-4">{catName(product.category, locale)}</span>
          )}

          <p className="text-body mt-4">{product.description}</p>

          {/* 规格 */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-meta text-xs">{t.product.minOrder}</p>
              <p className="mt-1 text-sm font-semibold">
                {fmt("{n} {u}", {
                  n: customerPrice?.moq ?? product.moq,
                  u: t.common.units,
                })}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-meta text-xs">{t.product.availability}</p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  stock <= 0 ? "text-[var(--color-danger)]" : ""
                }`}
              >
                {stock <= 0
                  ? t.common.outOfStock
                  : fmt("{n} {u} " + t.common.inStock, {
                      n: stock,
                      u: t.common.units,
                    })}
              </p>
            </div>
          </div>

          {/* 价格区 */}
          <div className="card mt-6 p-5">
            {view.price ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tracking-tight">
                    {money(view.price, cur)}
                  </span>
                  {view.priceType === "CUSTOMER" && (
                    <span className="badge badge-success">{t.product.customerPrice}</span>
                  )}
                </div>
                {view.priceType === "CUSTOMER" && customerPrice && (
                  <p className="text-meta mt-1 text-xs">
                    {t.product.publicPrice}:{" "}
                    <span className="line-through">
                      {product.publicPrice ? money(product.publicPrice, cur) : "—"}
                    </span>
                  </p>
                )}
                {relationship?.paymentTerms && (
                  <p className="text-meta mt-2 text-xs">
                    {t.product.paymentTerms}: {relationship.paymentTerms}
                  </p>
                )}
                <div className="mt-4">
                  <AddToOrderButton
                    productId={product.id}
                    moq={customerPrice?.moq ?? product.moq}
                    stock={stock}
                    t={t}
                  />
                </div>
              </>
            ) : (
              <div>
                <p className="text-body text-sm">
                  {relStatus === "REJECTED"
                    ? t.product.rejectedMsg
                    : relStatus === "PENDING"
                      ? t.product.pendingMsg
                      : t.product.customerOnlyMsg}
                </p>
                <div className="mt-4">
                  <RequestPricingButton
                    wholesalerId={product.wholesalerId}
                    status={relStatus}
                    t={t}
                  />
                </div>
                {relStatus === "NONE" && (
                  <p className="text-meta mt-3 text-xs">{t.product.approvalHint}</p>
                )}
              </div>
            )}
          </div>

          {/* 供应商信息 */}
          <div className="mt-6">
            <Link
              href={`/retailer/suppliers/${product.wholesalerId}`}
              className="flex items-center justify-between rounded-xl border border-[var(--color-line-2)] p-4 transition-colors hover:border-[var(--color-line)] hover:bg-[var(--color-bg-subtle)]"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
                  <BadgeCheck className="size-5 text-[var(--color-ink-2)]" />
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {product.wholesaler.business.tradeName}
                  </span>
                  <span className="text-meta block text-xs">
                    {product.wholesaler.business.legalName}
                  </span>
                </span>
              </span>
              <span className="text-sm font-medium text-[var(--color-ink-2)]">
                {t.product.viewSupplier}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
