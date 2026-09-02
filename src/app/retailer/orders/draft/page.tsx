import Link from "next/link";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { parseImages } from "@/lib/pricing";
import { DraftManager } from "./draft-manager";

export const metadata = { title: "Your Order" };

export default async function DraftOrderPage() {
  const session = await requireRole("RETAILER");
  const t = await getDictionary();
  const retailerId = session.retailerId!;

  const draft = await db.order.findFirst({
    where: { retailerId, status: "DRAFT" },
    include: {
      supplierOrders: {
        include: {
          wholesaler: {
            include: {
              business: true,
              user: { select: { name: true } },
            },
          },
          items: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const productIds = draft?.supplierOrders.flatMap((so) =>
    so.items.map((i) => i.productId),
  ) ?? [];
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, images: true, moq: true, inventories: true },
      })
    : [];
  const infoMap = new Map(
    products.map((p) => [
      p.id,
      {
        image: parseImages(p.images)[0] ?? null,
        moq: p.moq,
        stock: p.inventories.reduce((s, i) => s + i.stock, 0),
      },
    ]),
  );

  const groups =
    draft?.supplierOrders.map((so) => ({
      id: so.id,
      wholesalerName: so.wholesaler.business.tradeName ?? t.common.supplier,
      contact: so.wholesaler.user?.name ?? null,
      items: so.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.productName,
        image: infoMap.get(item.productId)?.image ?? null,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
        moq: infoMap.get(item.productId)?.moq ?? 1,
        stock: infoMap.get(item.productId)?.stock ?? 0,
      })),
      subtotal: Number(so.subtotal),
    })) ?? [];
  const total = groups.reduce((s, g) => s + g.subtotal, 0);

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <Link
        href="/retailer/orders"
        className="text-meta mb-5 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.orders.backToOrders}
      </Link>
      <h1 className="text-h1">{t.cart.title}</h1>
      <p className="text-body mt-1">{t.cart.desc}</p>

      <div className="mt-8">
        {!draft || groups.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <ShoppingBag
              className="mb-4 size-8 text-[var(--color-ink-3)]"
              strokeWidth={1.5}
            />
            <p className="text-h3 text-base">{t.cart.emptyTitle}</p>
            <p className="text-meta mt-1.5 max-w-sm">{t.cart.emptyDesc}</p>
            <Link
              href="/retailer/browse"
              className="btn btn-primary mt-6 px-5 py-2 text-sm"
            >
              {t.retailerHome.browseCta}
            </Link>
          </div>
        ) : (
          <DraftManager
            orderId={draft.id}
            groups={groups}
            total={total}
            t={t}
            currency={session.currency ?? "USD"}
          />
        )}
      </div>
    </div>
  );
}
