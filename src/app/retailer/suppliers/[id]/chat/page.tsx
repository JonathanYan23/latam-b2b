import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { ReadMarker } from "@/components/read-marker";
import { getDictionary, getLocale } from "@/i18n";
import { MessageBox } from "@/components/message-box";
import type { PickCatalog } from "@/components/message-box";
import { priceView } from "@/lib/pricing";
import { money } from "@/lib/format";

export default async function RetailerChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("RETAILER");
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const retailerId = session.retailerId!;
  const { id } = await params;

  const ws = await db.wholesaler.findUnique({
    where: { id },
    select: { business: { select: { tradeName: true } } },
  });
  if (!ws) notFound();

  const messages = await db.message.findMany({
    where: { wholesalerId: id, retailerId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: { select: { name: true, id: true } } },
  });

  // 快捷发送候选：本供应商商品 + 我的订单（价格按当前可见价）
  const cur = session.currency ?? "USD";
  const rel = await db.customerRelationship.findUnique({
    where: { wholesalerId_retailerId: { wholesalerId: id, retailerId } },
    select: { id: true, status: true },
  });
  const products = await db.product.findMany({
    where: { wholesalerId: id, active: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const cpMap = new Map<string, { price: import("@prisma/client/runtime/library").Decimal }>();
  if (rel?.status === "APPROVED") {
    const cps = await db.customerPrice.findMany({
      where: { relationshipId: rel.id, productId: { in: products.map((x) => x.id) } },
      select: { productId: true, price: true },
    });
    for (const c of cps) cpMap.set(c.productId, { price: c.price });
  }
  const productsOut = products.map((pr) => {
    const relS = rel?.status === "APPROVED" ? rel : undefined;
    const cpEntry = cpMap.get(pr.id) ?? null;
    const view = priceView(
      pr,
      relS,
      cpEntry ? { price: cpEntry.price } : null,
    );
    const price = view.price ? money(view.price, cur) : null;
    return {
      id: pr.id,
      title: pr.name,
      sub: `${price ? price + " · " : ""}${t.common.moq} ${pr.moq}`,
      href: `/retailer/products/${pr.id}`,
    };
  });
  const myOrders = await db.order.findMany({
    where: { retailerId, status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      supplierOrders: {
        select: { items: { select: { subtotal: true } } },
      },
    },
  });
  const ordersOut = myOrders.map((o) => {
    const sum = o.supplierOrders.reduce(
      (acc, so) => acc + so.items.reduce((x, it) => x + Number(it.subtotal), 0),
      0,
    );
    return {
      id: o.id,
      title: o.orderNumber,
      sub: `${money(sum, cur)}`,
      href: `/retailer/orders/${o.id}`,
    };
  });
  const cards: PickCatalog = { products: productsOut, orders: ordersOut };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-3xl flex-col animate-fade-up">
      <ReadMarker wholesalerId={id} retailerId={retailerId} />
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line-2)] py-3">
        <Link
          href={`/retailer/suppliers/${id}`}
          className="grid size-8 place-items-center rounded-md text-[var(--color-ink-3)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          aria-label="back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <p className="truncate text-sm font-semibold">{ws.business.tradeName}</p>
        <span className="badge badge-neutral ml-auto">{t.suppliers.messagesTitle}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col py-4">
        <MessageBox
          fill
          wholesalerId={id}
          retailerId={retailerId}
          t={t}
          locale={locale}
          messages={messages.map((m) => ({
            id: m.id,
            body: m.body,
            attachments: m.attachments ? parseUrls(m.attachments) : undefined,
            createdAt: m.createdAt.toISOString(),
            mine: m.senderId === session.userId,
            senderName: m.sender.name,
          }))}
          cards={cards}
        />
      </div>
    </div>
  );
}

function parseUrls(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
