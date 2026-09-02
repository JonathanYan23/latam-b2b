"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { priceView } from "@/lib/pricing";
import { money } from "@/lib/format";
import { dictForLocale, getActionLocale } from "@/i18n";
import { fmt } from "@/i18n/utils";

/** 查找零售商当前草稿订单（状态 DRAFT，一次一个进行中草稿） */
async function activeDraft(retailerId: string) {
  return db.order.findFirst({
    where: { retailerId, status: "DRAFT" },
    include: {
      supplierOrders: {
        include: { items: true, wholesaler: { include: { business: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * 加入草稿订单：选择数量加入即持久化为 DRAFT 订单，
 * 可继续加购/调量，提交后才真正下单（PRD：先建立订单再正式提交）。
 */
export async function addToDraftAction(
  productId: string,
  quantity: number,
): Promise<{ ok: boolean; draftId?: string; error?: string }> {
  const session = await requireRole("RETAILER");
  const t = dictForLocale(await getActionLocale());
  const retailerId = session.retailerId!;
  const qty = Math.max(1, Math.floor(quantity));

  const product = await db.product.findUnique({
    where: { id: productId, active: true },
    include: { inventories: true },
  });
  if (!product) return { ok: false, error: t.cart.errUnavailable };

  // 可见价格（关系/专属价）
  const rel = await db.customerRelationship.findUnique({
    where: {
      wholesalerId_retailerId: { wholesalerId: product.wholesalerId, retailerId },
    },
    select: { id: true, status: true },
  });
  const cp =
    rel?.status === "APPROVED"
      ? await db.customerPrice.findUnique({
          where: {
            productId_relationshipId: {
              productId,
              relationshipId: rel.id,
            },
          },
          select: { price: true },
        })
      : null;
  const view = priceView(product, rel, cp);
  if (!view.purchasable || !view.price) {
    return { ok: false, error: fmt(t.cart.errNotPurchasable, { name: product.name }) };
  }

  const draft = await activeDraft(retailerId);
  const supplierOrder = draft?.supplierOrders.find(
    (so) => so.wholesalerId === product.wholesalerId,
  );

  await db.$transaction(async (tx) => {
    let soId: string;
    if (!draft) {
      const order = await tx.order.create({
        data: {
          orderNumber: `DRFT-${Date.now().toString(36)}${Math.random()
            .toString(36)
            .slice(2, 6)}`.toUpperCase(),
          retailerId,
          status: "DRAFT",
        },
      });
      const so = await tx.supplierOrder.create({
        data: {
          orderId: order.id,
          wholesalerId: product.wholesalerId,
          relationshipId: rel?.id ?? null,
          status: "DRAFT",
          subtotal: 0,
          discount: 0,
          shipping: 0,
          total: 0,
        },
      });
      soId = so.id;
    } else if (supplierOrder) {
      soId = supplierOrder.id;
    } else {
      const so = await tx.supplierOrder.create({
        data: {
          orderId: draft!.id,
          wholesalerId: product.wholesalerId,
          relationshipId: rel?.id ?? null,
          status: "DRAFT",
          subtotal: 0,
          discount: 0,
          shipping: 0,
          total: 0,
        },
      });
      soId = so.id;
    }

    const item = await tx.orderItem.findFirst({
      where: { supplierOrderId: soId, productId },
    });
    const price = view.price!;
    if (item) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { quantity: item.quantity + qty, subtotal: price * (item.quantity + qty) },
      });
    } else {
      await tx.orderItem.create({
        data: {
          supplierOrderId: soId,
          productId,
          productName: product.name,
          sku: product.sku,
          unitPrice: price,
          quantity: qty,
          subtotal: price * qty,
        },
      });
    }
  });

  const draft2 = await activeDraft(retailerId);
  // 重算各组小计
  for (const so of draft2?.supplierOrders ?? []) {
    const subtotal = so.items.reduce((s, i) => s + Number(i.subtotal), 0);
    await db.supplierOrder.update({
      where: { id: so.id },
      data: { subtotal, total: subtotal },
    });
  }

  revalidatePath("/retailer/orders");
  return { ok: true, draftId: draft2?.id };
}

/** 草稿页：调整行数量（delta +1/-1），行小计实时重算 */
export async function adjustDraftItemAction(
  orderId: string,
  productId: string,
  delta: number,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("RETAILER");
  const t = dictForLocale(await getActionLocale());
  const order = await db.order.findFirst({
    where: { id: orderId, retailerId: session.retailerId!, status: "DRAFT" },
    include: { supplierOrders: { include: { items: true } } },
  });
  if (!order) return { ok: false, error: t.orders.errNotFound };

  for (const so of order.supplierOrders) {
    const item = so.items.find((i) => i.productId === productId);
    if (!item) continue;
    const next = Math.max(1, item.quantity + delta);
    const subtotal = Number(item.unitPrice) * next;
    await db.orderItem.update({
      where: { id: item.id },
      data: { quantity: next, subtotal },
    });
    const items = so.items.map((i) =>
      i.id === item.id ? { quantity: next, subtotal } : i,
    );
    const sum = items.reduce(
      (acc, i) => acc + Number(i.subtotal ?? 0),
      0,
    );
    await db.supplierOrder.update({
      where: { id: so.id },
      data: { subtotal: sum, total: sum },
    });
    revalidatePath("/retailer/orders/draft");
    return { ok: true };
  }
  return { ok: false, error: t.orders.errNotFound };
}

/** 草稿页：移除某商品（供应商单无货则删除整组） */
export async function removeDraftItemAction(
  orderId: string,
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("RETAILER");
  const t = dictForLocale(await getActionLocale());
  const order = await db.order.findFirst({
    where: { id: orderId, retailerId: session.retailerId!, status: "DRAFT" },
    include: { supplierOrders: { include: { items: true } } },
  });
  if (!order) return { ok: false, error: t.orders.errNotFound };

  await db.$transaction(async (tx) => {
    for (const so of order.supplierOrders) {
      const item = so.items.find((i) => i.productId === productId);
      if (!item) continue;
      await tx.orderItem.delete({ where: { id: item.id } });
      const rest = await tx.orderItem.findMany({ where: { supplierOrderId: so.id } });
      if (rest.length === 0) {
        await tx.supplierOrder.delete({ where: { id: so.id } });
      } else {
        const sum = rest.reduce((acc, i) => acc + Number(i.subtotal), 0);
        await tx.supplierOrder.update({
          where: { id: so.id },
          data: { subtotal: sum, total: sum },
        });
      }
    }
  });
  revalidatePath("/retailer/orders/draft");
  return { ok: true };
}

/**
 * 正式提交草稿订单：校验（非空/MOQ/库存/最低订单金额）→ DRAFT→SUBMITTED，
 * 生成正式单号。确认扣库存仍在批发商确认环节。
 */
export async function submitDraftAction(
  orderId: string,
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const session = await requireRole("RETAILER");
  const t = dictForLocale(await getActionLocale());
  const retailerId = session.retailerId!;

  const order = await db.order.findFirst({
    where: { id: orderId, retailerId, status: "DRAFT" },
    include: {
      supplierOrders: {
        include: {
          items: true,
          wholesaler: { select: { minOrderAmount: true, business: { select: { tradeName: true } } } },
        },
      },
    },
  });
  if (!order) return { ok: false, error: t.orders.errNotFound };

  const productIds = order.supplierOrders.flatMap((so) =>
    so.items.map((i) => i.productId),
  );
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { inventories: true },
  });
  const pMap = new Map(products.map((p) => [p.id, p]));

  // 逐行校验
  for (const so of order.supplierOrders) {
    if (so.items.length === 0) continue;
    for (const item of so.items) {
      const p = pMap.get(item.productId);
      if (!p) return { ok: false, error: t.cart.errUnavailable };
      if (item.quantity < p.moq) {
        return {
          ok: false,
          error: fmt(t.cart.errMoq, { name: item.productName, n: p.moq }),
        };
      }
      const stock = p.inventories.reduce((acc, i) => acc + i.stock, 0);
      if (stock < item.quantity) {
        return {
          ok: false,
          error: fmt(t.cart.errStock, { name: item.productName, n: stock }),
        };
      }
    }
    const min = so.wholesaler.minOrderAmount ? Number(so.wholesaler.minOrderAmount) : 0;
    if (min > 0 && Number(so.total) < min) {
      return {
        ok: false,
        error: fmt(t.cart.errMinOrder, {
          supplier: so.wholesaler.business.tradeName ?? t.common.supplier,
          amount: money(min),
        }),
      };
    }
  }

  // 正式单号
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const count = await db.order.count({
    where: { orderNumber: { startsWith: `OB-${ymd}` } },
  });
  const orderNumber = `OB-${ymd}-${String(count + 1).padStart(3, "0")}`;

  await db.$transaction(async (tx) => {
    for (const so of order.supplierOrders) {
      const sum = so.items.reduce((s, i) => s + Number(i.subtotal), 0);
      await tx.supplierOrder.update({
        where: { id: so.id },
        data: { status: "SUBMITTED", subtotal: sum, total: sum },
      });
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: "SUBMITTED", orderNumber },
    });
  });

  revalidatePath("/retailer/orders");
  return { ok: true, orderId: order.id };
}
