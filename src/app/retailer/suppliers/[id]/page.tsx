import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Store, MessageCircle, ZoomIn } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { priceView, parseImages } from "@/lib/pricing";
import { money } from "@/lib/format";
import { termsLabel } from "@/lib/terms";
import { productName } from "@/lib/product-name";
import { fmt } from "@/i18n/utils";
import { getDictionary, getLocale } from "@/i18n";
import { RequestPricingButton } from "@/app/retailer/products/[id]/request-button";
import { QuickAdd } from "../../quick-add";

export default async function SupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const retailerId = session.retailerId!;
  const { id } = await params;
  const { new: onlyNew } = await searchParams;

  const wholesaler = await db.wholesaler.findUnique({
    where: { id },
    include: {
      business: { include: { city: true, country: true } },
      user: { select: { name: true } },
      products: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        include: { inventories: true },
      },
    },
  });
  if (!wholesaler) notFound();

  // 新上架：最近 14 天创建；?new=1 时仅展示新上架
  const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
  const isNewProduct = (createdAt: Date) =>
    Date.now() - createdAt.getTime() < NEW_WINDOW_MS;
  const products =
    onlyNew === "1"
      ? wholesaler.products.filter((p) => isNewProduct(p.createdAt))
      : wholesaler.products;

  const relationship = await db.customerRelationship.findUnique({
    where: { wholesalerId_retailerId: { wholesalerId: id, retailerId } },
    select: {
      id: true,
      status: true,
      tier: true,
      paymentTerms: true,
      creditLimit: true,
    },
  });

  const customerPrices =
    relationship?.status === "APPROVED"
      ? await db.customerPrice.findMany({
          where: { relationshipId: relationship.id },
          select: { productId: true, price: true, moq: true },
        })
      : [];
  const cpMap = new Map(customerPrices.map((cp) => [cp.productId, cp]));

  const relStatus =
    relationship?.status === "APPROVED"
      ? "APPROVED"
      : relationship?.status === "PENDING"
        ? "PENDING"
        : relationship?.status === "REJECTED"
          ? "REJECTED"
          : "NONE";
  const location = [
    wholesaler.business.city?.name,
    wholesaler.business.country?.name,
  ]
    .filter(Boolean)
    .join(", ");
  const title = wholesaler.business.tradeName ?? wholesaler.business.legalName;

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <p className="text-meta mb-5">
        <Link href="/retailer/suppliers" className="hover:text-[var(--color-ink)]">
          {t.suppliers.title}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--color-ink-2)]">{title}</span>
      </p>

      {/* 供应商信息区（精简一行式：让出更多空间给商品） */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          {wholesaler.business.logo ? (
            <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-[var(--color-bg-muted)]">
              <Image
                src={wholesaler.business.logo}
                alt={title}
                fill
                sizes="44px"
                className="object-cover"
                unoptimized
              />
            </span>
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-muted)]">
              <Store className="size-5 text-[var(--color-ink-2)]" strokeWidth={1.8} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold">{title}</h1>
            <p className="text-meta truncate text-xs">
              {location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" /> {location}
                </span>
              )}
              {wholesaler.user?.name && (
                <span className="ml-2">
                  {t.common.contactPerson}: {wholesaler.user.name}
                </span>
              )}
              {relationship?.status === "APPROVED" && relationship.paymentTerms && (
                <span className="ml-2 text-[var(--color-ink-2)]">
                  · {termsLabel(relationship.paymentTerms, t)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 右侧：状态 + 发消息直达（不额外占用商品区） */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {relationship && (
            <span
              className={`badge ${
                relationship.status === "APPROVED"
                  ? "badge-success"
                  : relationship.status === "PENDING"
                    ? "badge-warning"
                    : "badge-danger"
              }`}
            >
              {relationship.status === "APPROVED"
                ? t.suppliers.approvedCustomer
                : relationship.status === "PENDING"
                  ? t.suppliers.requestPending
                  : t.suppliers.requestDeclined}
            </span>
          )}
          {relStatus !== "APPROVED" ? (
            <RequestPricingButton wholesalerId={id} status={relStatus} t={t} />
          ) : (
            <Link
              href={`/retailer/suppliers/${id}/chat`}
              className="btn btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-sm"
            >
              <MessageCircle className="size-4" /> {t.suppliers.messagesTitle}
            </Link>
          )}
        </div>
      </div>

      {/* 商品标题 + 全部/新上架 筛选 */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 text-lg">
          {t.suppliers.productsTitle}
          <span className="text-meta ml-2 text-sm font-normal">
            {fmt(t.suppliers.count, { n: wholesaler.products.length })}
          </span>
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-subtle)] p-1 text-xs font-medium">
          <Link
            href={`/retailer/suppliers/${id}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              onlyNew !== "1"
                ? "bg-white text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t.suppliers.allProducts}
          </Link>
          <Link
            href={`/retailer/suppliers/${id}?new=1`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              onlyNew === "1"
                ? "bg-white text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t.suppliers.newArrivals}
          </Link>
        </div>
      </div>

      {/* 商品网格：与「逛市场」同等的大图体验 + 点击放大 + 直达加购 */}
      {products.length === 0 ? (
        <div className="card mt-4 flex flex-col items-center px-6 py-14 text-center">
          <Store className="mb-3 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
          <p className="text-h3 text-base">{t.suppliers.emptySearch}</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const cp = cpMap.get(p.id);
            const view = priceView(p, relationship, cp);
            const stock = p.inventories.reduce((s, i) => s + i.stock, 0);
            const [img] = parseImages(p.images);
            const isNew = isNewProduct(p.createdAt);
            const name = productName(p, locale);
            return (
              <div
                key={p.id}
                className="card card-hover group relative flex flex-col overflow-hidden"
              >
                <div className="relative aspect-square w-full bg-[var(--color-bg-muted)]">
                  {img && (
                    <Image
                      src={img}
                      alt={name}
                      data-zoom
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      unoptimized
                    />
                  )}
                  <span
                    title={t.common.zoomHint}
                    className="absolute right-2 top-2 z-10 grid size-6 place-items-center rounded-full bg-black/35 text-white opacity-70 transition-opacity group-hover:opacity-100"
                  >
                    <ZoomIn className="size-3.5" />
                  </span>
                  {isNew && (
                    <span className="absolute left-2 top-2 rounded-md bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {t.suppliers.newArrivals}
                    </span>
                  )}
                  <span
                    className={`badge absolute bottom-2 left-2 backdrop-blur-sm ${
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
                  <Link
                    href={`/retailer/products/${p.id}`}
                    className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--color-ink)] transition-colors hover:underline"
                  >
                    {name}
                  </Link>
                  <p className="text-meta mt-1 text-[11px]">
                    {t.common.moq} {cp?.moq ?? p.moq}
                    {p.boxSize && p.showBoxSize !== false ? (
                      <span> · {t.common.pack} {p.boxSize}</span>
                    ) : null}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    {view.price ? (
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold">{money(view.price, cur)}</p>
                        {view.priceType === "CUSTOMER" && (
                          <p className="text-[10px] font-medium text-[var(--color-accent)]">
                            {t.browse.yourPrice}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="badge badge-info text-[11px]">
                        {t.suppliers.customerOnly}
                      </span>
                    )}
                    <QuickAdd
                      productId={p.id}
                      moq={cp?.moq ?? p.moq}
                      stock={stock}
                      enabled={!!view.price && stock > 0}
                      t={t}
                    />
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
