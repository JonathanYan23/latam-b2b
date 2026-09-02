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
import { MessageBox } from "@/components/message-box";

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const retailerId = session.retailerId!;
  const { id } = await params;

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

  // 会话消息
  const messages = await db.message.findMany({
    where: { wholesalerId: id, retailerId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { sender: { select: { name: true, id: true } } },
  });

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
          <span className="grid size-14 place-items-center rounded-2xl bg-[var(--color-bg-muted)]">
            <Store className="size-7 text-[var(--color-ink-2)]" strokeWidth={1.6} />
          </span>
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
      <h2 className="text-h2 text-lg">{t.suppliers.productsTitle}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wholesaler.products.map((p) => {
          const cp = cpMap.get(p.id);
          const view = priceView(p, relationship, cp);
          const stock = p.inventories.reduce((s, i) => s + i.stock, 0);
          const [img] = parseImages(p.images);
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

      {/* 消息（右栏，进店即可见，不需下拉） */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-20">
        <div className="card flex max-h-[min(60vh,560px)] flex-col p-4">
          <p className="mb-3 flex shrink-0 items-center gap-2 border-b border-[var(--color-line-2)] pb-3 text-sm font-medium">
            <MessageCircle className="size-4 text-[var(--color-ink-2)]" />
            {t.suppliers.messagesTitle}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MessageBox
              wholesalerId={id}
              retailerId={retailerId}
              locale={locale}
              t={t}
              messages={messages.map((m) => ({
                id: m.id,
                body: m.body,
                createdAt: m.createdAt.toISOString(),
                mine: m.senderId === session.userId,
                senderName: m.sender.name,
              }))}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
