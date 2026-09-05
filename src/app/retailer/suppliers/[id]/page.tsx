import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Store, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { priceView, parseImages } from "@/lib/pricing";
import { money } from "@/lib/format";
import { fmt } from "@/i18n/utils";
import {getDictionary, getLocale} from "@/i18n";
import { RequestPricingButton } from "@/app/retailer/products/[id]/request-button";

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
  const isNewProduct = (createdAt: Date) => Date.now() - createdAt.getTime() < NEW_WINDOW_MS;
  const products = onlyNew === "1"
    ? wholesaler.products.filter((p) => isNewProduct(p.createdAt))
    : wholesaler.products;

  const relationship = await db.customerRelationship.findUnique({
    where: { wholesalerId_retailerId: { wholesalerId: id, retailerId } },
    select: { id: true, status: true, tier: true, paymentTerms: true, creditLimit: true },
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

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <p className="text-meta mb-5">
        <Link href="/retailer/suppliers" className="hover:text-[var(--color-ink)]">
          {t.suppliers.title}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--color-ink-2)]">
          {wholesaler.business.tradeName}
        </span>
      </p>

      {/* 供应商头部 */}
      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {wholesaler.business.logo ? (
            <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-[var(--color-bg-muted)]">
              <Image
                src={wholesaler.business.logo}
                alt={wholesaler.business.tradeName ?? ""}
                fill
                sizes="56px"
                className="object-cover"
                unoptimized
              />
            </span>
          ) : (
            <span className="grid size-14 place-items-center rounded-2xl bg-[var(--color-bg-muted)]">
              <Store className="size-7 text-[var(--color-ink-2)]" strokeWidth={1.6} />
            </span>
          )}
          <div>
            <h1 className="text-h2">{wholesaler.business.tradeName}</h1>
            <p className="text-meta mt-0.5 text-sm">
              {wholesaler.business.legalName}
              {location && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {location}
                </span>
              )}
            </p>
            {wholesaler.user?.name && (
              <p className="text-meta mt-0.5 text-xs">
                {t.common.contactPerson}: {wholesaler.user.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {relationship && (
            <div className="flex flex-wrap gap-2">
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
              {relationship.paymentTerms && (
                <span className="badge badge-neutral">{relationship.paymentTerms}</span>
              )}
              {wholesaler.minOrderAmount && Number(wholesaler.minOrderAmount) > 0 && (
                <span className="badge badge-warning">
                  {t.suppliers.minOrderValue}: ${Number(wholesaler.minOrderAmount).toLocaleString()}
                </span>
              )}
            </div>
          )}
          {relStatus !== "APPROVED" && (
            <div className="w-full sm:w-56">
              <RequestPricingButton wholesalerId={id} status={relStatus} t={t} />
            </div>
          )}
        </div>
      </div>

      {/* 商品（左）+ 消息（右侧贴店名可见）双栏 */}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="order-2 min-w-0 lg:order-1">
      {/* 该供应商的商品 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 text-lg">{t.suppliers.productsTitle}</h2>
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
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const cp = cpMap.get(p.id);
          const view = priceView(p, relationship, cp);
          const stock = p.inventories.reduce((s, i) => s + i.stock, 0);
          const [img] = parseImages(p.images);
          const isNew = isNewProduct(p.createdAt);
          return (
            <Link
              key={p.id}
              href={`/retailer/products/${p.id}`}
              className="card card-hover flex gap-4 p-4"
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-muted)]">
                {img && (
                  <Image
                    src={img}
                    alt={p.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                )}
                {isNew && (
                  <span className="absolute left-0 top-0 rounded-br-md bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {t.suppliers.newArrivals}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium">{p.name}</h3>
                <p className="text-meta text-xs">
                  {t.common.moq} {cp?.moq ?? p.moq}
                </p>
                <div className="mt-2">
                  {view.price ? (
                    <>
                      <span className="text-sm font-semibold">
                        {money(view.price, cur)}
                      </span>
                      {view.priceType === "CUSTOMER" && (
                        <span className="badge badge-success ml-2 text-[11px]">
                          {t.browse.yourPrice}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="badge badge-info text-[11px]">
                      {t.suppliers.customerOnly}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-1 text-xs ${
                    stock <= 0 ? "text-[var(--color-danger)]" : "text-[var(--color-ink-3)]"
                  }`}
                >
                  {stock <= 0
                    ? t.common.outOfStock
                    : fmt("{n} {u} " + t.common.inStock, { n: stock, u: t.common.units })}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      </div>

      {/* 进入聊天（独立整页，支持图片/PDF 附件） */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-20">
        <Link
          href={`/retailer/suppliers/${id}/chat`}
          className="card flex flex-col items-center gap-2 p-6 text-center transition-shadow hover:shadow-md"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-[var(--color-bg-muted)]">
            <MessageCircle className="size-6 text-[var(--color-ink-2)]" strokeWidth={1.6} />
          </span>
          <p className="text-sm font-semibold">{t.suppliers.messagesTitle}</p>
          <p className="text-meta text-xs">{t.suppliers.chatHint}</p>
          <span className="btn btn-secondary mt-1 px-4 py-1.5 text-xs">{t.suppliers.openChat}</span>
        </Link>
      </div>
      </div>
    </div>
  );
}
