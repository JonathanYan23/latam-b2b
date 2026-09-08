"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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
      order: { select: { retailerId: true, currency: true } },
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
  order: { retailerId: string; currency: string };
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
      currency: so.order.currency ?? "USD",
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

/**
 * 删除供应商订单（带后果守卫）：
 * - 仅允许状态 DRAFT / SUBMITTED（未处理）或 CANCELLED（已取消的废单清理）
 * - 已生成发票或已有收款记录的订单禁止删除（财务数据完整性）
 * - 删除订单明细 + 订单本身；若买家主订单下无其他供应商订单，主订单置 CANCELLED（保留买家历史）
 */
export async function deleteSupplierOrderAction(
  supplierOrderId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("WHOLESALER");
  const t = dictForLocale(await getActionLocale());
  const wholesalerId = session.wholesalerId!;

  const so = await db.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    select: { id: true, wholesalerId: true, status: true, orderId: true },
  });
  if (!so || so.wholesalerId !== wholesalerId)
    return { ok: false, error: t.wsOrders.errNotFound };

  const [invCount, payCount] = await Promise.all([
    db.invoice.count({ where: { supplierOrderId } }),
    db.payment.count({ where: { supplierOrderId } }),
  ]);
  if (invCount > 0) return { ok: false, error: t.wsOrders.errHasInvoice };
  if (payCount > 0) return { ok: false, error: t.wsOrders.errHasPayment };
  if (!["DRAFT", "SUBMITTED", "CANCELLED"].includes(so.status))
    return { ok: false, error: t.wsOrders.errActive };

  // 软删除（前台删、后台留）：仅标记，平台管理端完整保留可恢复
  const hd = await headers();
  const ip =
    (hd.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || hd.get("x-real-ip") || null;
  await db.supplierOrder.update({
    where: { id: supplierOrderId },
    data: { deletedAt: new Date(), deletedBy: session.userId, deletedIp: ip },
  });

  revalidatePath("/wholesaler/orders");
  return { ok: true };
}

/** 批量删除选中订单（软删）：逐单守卫（状态/发票/收款），部分失败给出原因 */
export async function deleteSupplierOrdersAction(
  ids: string[],
): Promise<{ ok: boolean; deleted?: number; skipped?: number; error?: string }> {
  const session = await requireRole("WHOLESALER");
  const t = dictForLocale(await getActionLocale());
  const wholesalerId = session.wholesalerId!;
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return { ok: false, error: t.wsOrders.errNotFound };

  const sos = await db.supplierOrder.findMany({
    where: { id: { in: uniq }, wholesalerId, deletedAt: null },
    select: { id: true, status: true },
  });
  const okIds: string[] = [];
  let skipped = 0;
  for (const so of sos) {
    if (!["DRAFT", "SUBMITTED", "CANCELLED"].includes(so.status)) {
      skipped++;
      continue;
    }
    const [invCount, payCount] = await Promise.all([
      db.invoice.count({ where: { supplierOrderId: so.id } }),
      db.payment.count({ where: { supplierOrderId: so.id } }),
    ]);
    if (invCount > 0 || payCount > 0) {
      skipped++;
      continue;
    }
    okIds.push(so.id);
  }
  if (okIds.length > 0) {
    const hd2 = await headers();
    const ip =
      (hd2.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || hd2.get("x-real-ip") || null;
    await db.supplierOrder.updateMany({
      where: { id: { in: okIds } },
      data: { deletedAt: new Date(), deletedBy: session.userId, deletedIp: ip },
    });
  }
  revalidatePath("/wholesaler/orders");
  return { ok: true, deleted: okIds.length, skipped };
}

/** 恢复已删除订单（平台管理端专用） */
export async function restoreSupplierOrderAction(
  supplierOrderId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("ADMIN");
  const so = await db.supplierOrder.findUnique({ where: { id: supplierOrderId } });
  if (!so) return { ok: false, error: "not_found" };
  await db.supplierOrder.update({
    where: { id: supplierOrderId },
    data: { deletedAt: null, deletedBy: null, deletedIp: null },
  });
  revalidatePath("/admin/orders");
  return { ok: true };
}
