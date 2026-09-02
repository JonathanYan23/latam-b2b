"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { priceView, parseImages } from "@/lib/pricing";
import { money } from "@/lib/format";
import { dictForLocale, getActionLocale } from "@/i18n";
import { fmt } from "@/i18n/utils";

/** 零售商申请成为某批发商的客户（获得专属价格） */
export async function requestCustomerPricing(
  wholesalerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("RETAILER");
  const t = dictForLocale(await getActionLocale());
  const retailerId = session.retailerId!;

  const wholesaler = await db.wholesaler.findUnique({
    where: { id: wholesalerId },
  });
  if (!wholesaler) return { ok: false, error: t.messages.errWsNotFound };

  const existing = await db.customerRelationship.findUnique({
    where: {
      wholesalerId_retailerId: { wholesalerId, retailerId },
    },
  });

  if (existing?.status === "PENDING") {
    return { ok: true }; // 已在申请中
  }

  await db.customerRelationship.upsert({
    where: {
      wholesalerId_retailerId: { wholesalerId, retailerId },
    },
    update: {
      status: "PENDING",
      requestedAt: new Date(),
    },
    create: {
      wholesalerId,
      retailerId,
      status: "PENDING",
      requestedAt: new Date(),
    },
  });

  revalidatePath("/retailer/suppliers");
  return { ok: true };
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

/**
 * 提交订单（PRD 15/27 节：Master Order → Supplier Order）
 * 购物车按批发商分组，生成 1 个主订单 + N 个供应商子订单。
 */
export async function placeOrderAction(
  cart: CartItemInput[],
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const session = await requireRole("RETAILER");
  const t = dictForLocale(await getActionLocale());
  const retailerId = session.retailerId!;

  if (!cart.length) return { ok: false, error: t.cart.errEmpty };

  // 当前零售商的关系
  const relationships = await db.customerRelationship.findMany({
    where: { retailerId },
    select: { id: true, wholesalerId: true, status: true },
  });
  const relByWholesaler = new Map(
    relationships.map((r) => [r.wholesalerId, r]),
  );
  const relIds = relationships.map((r) => r.id);
  const customerPrices = relIds.length
    ? await db.customerPrice.findMany({
        where: { relationshipId: { in: relIds } },
        select: { productId: true, relationshipId: true, price: true },
      })
    : [];
  const cpByProduct = new Map(customerPrices.map((cp) => [cp.productId, cp]));

  const productIds = cart.map((c) => c.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: { inventories: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // 按批发商分组
  const byWholesaler = new Map<
    string,
    { product: (typeof products)[number]; quantity: number; unitPrice: number }[]
  >();

  for (const item of cart) {
    const product = productMap.get(item.productId);
    if (!product)
      return { ok: false, error: t.cart.errUnavailable };

    const rel = relByWholesaler.get(product.wholesalerId);
    const cp = cpByProduct.get(product.id);
    const view = priceView(product, rel, cp);
    if (!view.purchasable || !view.price) {
      return {
        ok: false,
        error: fmt(t.cart.errNotPurchasable, { name: product.name }),
      };
    }
    if (item.quantity < product.moq) {
      return {
        ok: false,
        error: fmt(t.cart.errMoq, { name: product.name, n: product.moq }),
      };
    }

    const stock = product.inventories.reduce((s, i) => s + i.stock, 0);
    if (stock < item.quantity) {
      return {
        ok: false,
        error: fmt(t.cart.errStock, { name: product.name, n: stock }),
      };
    }

    const list = byWholesaler.get(product.wholesalerId) ?? [];
    list.push({ product, quantity: item.quantity, unitPrice: view.price });
    byWholesaler.set(product.wholesalerId, list);
  }

  // 校验各家批发商「最低订单金额」（PRD：每家可设最小可接受账单金额）
  const wsMinOrders = await db.wholesaler.findMany({
    where: { id: { in: [...byWholesaler.keys()] } },
    select: { id: true, minOrderAmount: true, business: { select: { tradeName: true } } },
  });
  for (const ws of wsMinOrders) {
    const min = ws.minOrderAmount ? Number(ws.minOrderAmount) : 0;
    if (min <= 0) continue;
    const items = byWholesaler.get(ws.id) ?? [];
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    if (subtotal < min) {
      return {
        ok: false,
        error: fmt(t.cart.errMinOrder, {
          supplier: ws.business.tradeName ?? t.common.supplier,
          amount: money(min),
        }),
      };
    }
  }

  // 生成订单号（MVP：日期 + 序号）
  const orderNumber = await nextOrderNumber("OB");

  const order = await db.order.create({
    data: {
      orderNumber,
      retailerId,
      status: "SUBMITTED",
      supplierOrders: {
        create: [...byWholesaler.entries()].map(([wholesalerId, items]) => {
          const subtotal = items.reduce(
            (s, i) => s + i.unitPrice * i.quantity,
            0,
          );
          const rel = relByWholesaler.get(wholesalerId);
          return {
            wholesalerId,
            relationshipId: rel?.id ?? null,
            status: "SUBMITTED",
            subtotal,
            discount: 0,
            shipping: 0,
            total: subtotal,
            items: {
              create: items.map((i) => ({
                productId: i.product.id,
                productName: i.product.name,
                sku: i.product.sku,
                unitPrice: i.unitPrice,
                discount: 0,
                quantity: i.quantity,
                subtotal: i.unitPrice * i.quantity,
              })),
            },
          };
        }),
      },
    },
  });

  revalidatePath("/retailer/orders");
  return { ok: true, orderId: order.id };
}

/** 生成订单号：OB-YYYYMMDD-序号 */
async function nextOrderNumber(prefix: string): Promise<string> {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const count = await db.order.count({
    where: { orderNumber: { startsWith: `${prefix}-${ymd}` } },
  });
  return `${prefix}-${ymd}-${String(count + 1).padStart(3, "0")}`;
}

/** 购物车商品信息查询（server action，供 client 购物车渲染） */
export interface CartProductInfo {
  productId: string;
  name: string;
  sku: string;
  image: string | null;
  wholesalerId: string;
  wholesalerName: string;
  moq: number;
  price: number | null;
  priceType: "PUBLIC" | "CUSTOMER" | null;
  purchasable: boolean;
  stock: number;
  minOrderAmount: number | null;
}

export async function getCartProductsAction(
  productIds: string[],
): Promise<{ products: CartProductInfo[] }> {
  const session = await requireRole("RETAILER");
  const retailerId = session.retailerId!;

  const relationships = await db.customerRelationship.findMany({
    where: { retailerId },
    select: { id: true, wholesalerId: true, status: true },
  });
  const relByWholesaler = new Map(
    relationships.map((r) => [r.wholesalerId, r]),
  );
  const relIds = relationships.map((r) => r.id);
  const customerPrices = relIds.length
    ? await db.customerPrice.findMany({
        where: { relationshipId: { in: relIds } },
        select: { productId: true, price: true },
      })
    : [];
  const cpByProduct = new Map(customerPrices.map((cp) => [cp.productId, cp]));

  const products = await db.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: {
      wholesaler: { include: { business: true } },
      inventories: true,
    },
  });

  const result: CartProductInfo[] = products.map((p) => {
    const rel = relByWholesaler.get(p.wholesalerId);
    const cp = cpByProduct.get(p.id);
    const view = priceView(p, rel, cp);
    const [img] = parseImages(p.images);
    const stock = p.inventories.reduce((s, i) => s + i.stock, 0);
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      image: img ?? null,
      wholesalerId: p.wholesalerId,
      wholesalerName: p.wholesaler.business.tradeName ?? p.wholesaler.business.legalName,
      moq: p.moq,
      price: view.price,
      priceType: view.priceType,
      purchasable: view.purchasable,
      stock,
      minOrderAmount: p.wholesaler.minOrderAmount
        ? Number(p.wholesaler.minOrderAmount)
        : null,
    };
  });

  return { products: result };
}
