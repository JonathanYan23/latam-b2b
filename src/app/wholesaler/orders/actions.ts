"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { dictForLocale, getActionLocale } from "@/i18n";
import { fmt } from "@/i18n/utils";
import { syncMasterOrder } from "@/lib/order-status";

const FLOW: OrderStatus[] = [
  "SUBMITTED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

/**
 * 批发商更新供应商订单状态（PRD 23 节）。
 * SUBMITTED → CONFIRMED 时扣减库存；CANCELLED 时回补已扣库存。
 */
export async function updateSupplierOrderStatusAction(
  supplierOrderId: string,
  next: OrderStatus,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("WHOLESALER");
  const wholesalerId = session.wholesalerId!;

  const so = await db.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    include: {
      items: true,
      order: { select: { retailerId: true } },
      relationship: { select: { paymentTerms: true } },
    },
  });
  const t = dictForLocale(await getActionLocale());
  if (!so || so.wholesalerId !== wholesalerId)
    return { ok: false, error: t.wsOrders.errNotFound };

  const current = so.status;

  if (next === "CANCELLED") {
    // 回补库存（若之前已扣）
    if (current === "CONFIRMED" || current === "PREPARING" || current === "READY") {
      await restock(so.id, so.items);
    }
    await db.supplierOrder.update({
      where: { id: supplierOrderId },
      data: { status: "CANCELLED" },
    });
    await syncMasterOrder(db, so.orderId);
    revalidatePath("/wholesaler/orders");
    return { ok: true };
  }

  // 只允许前进（CONFIRMED 可回到？MVP：只前进）
  const i = FLOW.indexOf(current);
  const j = FLOW.indexOf(next);
  if (i === -1 || j === -1 || j <= i) {
    return { ok: false, error: fmt(t.wsOrders.errTransition, { from: current, to: next }) };
  }

  // 确认时扣库存
  if (next === "CONFIRMED") {
    const insufficient = await checkStock(so.id, so.items);
    if (insufficient) {
      return {
        ok: false,
        error: fmt(t.wsOrders.errStock, {
          name: insufficient.name,
          stock: insufficient.stock,
          needed: insufficient.required,
        }),
      };
    }
    await deductStock(so.id, so.items);
    // 生成 Invoice（PRD 24/25 节：确认订单 → 应收账款）
    await createInvoiceFor(so);
  }

  await db.supplierOrder.update({
    where: { id: supplierOrderId },
    data: { status: next },
  });
  await syncMasterOrder(db, so.orderId);

  revalidatePath("/wholesaler/orders");
  revalidatePath(`/wholesaler/orders/${supplierOrderId}`);
  return { ok: true };
}

async function checkStock(supplierOrderId: string, items: { productId: string; quantity: number }[]) {
  for (const item of items) {
    const aggr = await db.inventory.aggregate({
      where: { productId: item.productId },
      _sum: { stock: true },
    });
    const stock = aggr._sum?.stock ?? 0;
    if (stock < item.quantity) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      });
      return { name: product?.name ?? item.productId, stock, required: item.quantity };
    }
  }
  return null;
}

async function deductStock(supplierOrderId: string, items: { productId: string; quantity: number }[]) {
  for (const item of items) {
    // 扣减第一个有库存的仓库（MVP 单仓库）
    const inventory = await db.inventory.findFirst({
      where: { productId: item.productId, stock: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
    });
    if (inventory) {
      await db.inventory.update({
        where: { id: inventory.id },
        data: { stock: { decrement: item.quantity } },
      });
    }
  }
}

async function restock(supplierOrderId: string, items: { productId: string; quantity: number }[]) {
  for (const item of items) {
    await db.inventory.updateMany({
      where: { productId: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

type SoForInvoice = {
  id: string;
  orderId: string;
  wholesalerId: string;
  total: number | { toString(): string };
  relationship: { paymentTerms: string | null } | null;
  order: { retailerId: string };
};

/** 订单确认后生成 Invoice，账期按客户条款（NET30 等）计算 */
async function createInvoiceFor(so: SoForInvoice) {
  const dueDays = parsePaymentTerms(so.relationship?.paymentTerms);
  const invoiceNumber = await nextInvoiceNumber("INV");
  const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

  await db.invoice.create({
    data: {
      invoiceNumber,
      supplierOrderId: so.id,
      orderId: so.orderId,
      wholesalerId: so.wholesalerId,
      retailerId: so.order.retailerId,
      amount: so.total as unknown as number,
      status: "UNPAID",
      dueDate,
    },
  });
}

/** 解析账期字符串："NET30" → 30, "NET15" → 15，默认 0（货到付款） */
function parsePaymentTerms(terms: string | null | undefined): number {
  if (!terms) return 0;
  const m = terms.toUpperCase().match(/^NET\s*(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function nextInvoiceNumber(prefix: string): Promise<string> {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const count = await db.invoice.count({
    where: { invoiceNumber: { startsWith: `${prefix}-${ymd}` } },
  });
  return `${prefix}-${ymd}-${String(count + 1).padStart(3, "0")}`;
}
