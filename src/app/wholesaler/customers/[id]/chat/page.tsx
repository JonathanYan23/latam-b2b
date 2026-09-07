import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { ReadMarker } from "@/components/read-marker";
import { getDictionary, getLocale } from "@/i18n";
import { MessageBox } from "@/components/message-box";
import type { PickCatalog } from "@/components/message-box";
import { parseImages } from "@/lib/pricing";
import { money } from "@/lib/format";

export default async function WholesalerChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const wholesalerId = session.wholesalerId!;
  const { id } = await params;

  const rel = await db.customerRelationship.findUnique({
    where: { id },
    include: { retailer: { include: { business: true } } },
  });
  if (!rel || rel.wholesalerId !== wholesalerId) notFound();
  const retailerId = rel.retailerId;

  const messages = await db.message.findMany({
    where: { wholesalerId, retailerId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: { select: { name: true, id: true } } },
  });

  // 快捷发送候选：我的商品（公开价） + 与该客户的订单
  const cur = session.currency ?? "USD";
  const myProducts = await db.product.findMany({
    where: { wholesalerId, active: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const productsOut = myProducts.map((pr) => {
    const [img] = parseImages(pr.images);
    return {
      id: pr.id,
      title: pr.name,
      sub: `${money(pr.publicPrice, cur)} · ${t.common.moq} ${pr.moq}`,
      href: `/wholesaler/products`,
    };
  });
  const relOrders = await db.supplierOrder.findMany({
    where: { wholesalerId, status: { not: "DRAFT" }, order: { retailerId } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      order: { select: { orderNumber: true, currency: true } },
      items: true,
    },
  });
  const ordersOut = relOrders.map((so) => {
    const sum = so.items.reduce((acc, it) => acc + Number(it.subtotal), 0);
    return {
      id: so.id,
      title: so.order.orderNumber,
      sub: money(sum, so.order.currency ?? cur),
      href: `/wholesaler/orders/${so.id}`,
    };
  });
  const cards: PickCatalog = { products: productsOut, orders: ordersOut };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-3xl flex-col animate-fade-up">
      <ReadMarker wholesalerId={wholesalerId} retailerId={retailerId} />
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line-2)] py-3">
        <Link
          href={`/wholesaler/customers/${id}`}
          className="grid size-8 place-items-center rounded-md text-[var(--color-ink-3)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          aria-label="back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <p className="truncate text-sm font-semibold">
          {rel.retailer.business.tradeName}
        </p>
        <span className="badge badge-neutral ml-auto">{t.suppliers.messagesTitle}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col py-4">
        <MessageBox
          fill
          wholesalerId={wholesalerId}
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
