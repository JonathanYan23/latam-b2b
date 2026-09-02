"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { syncMasterOrder } from "@/lib/order-status";
import { dictForLocale, getActionLocale } from "@/i18n";

/**
 * 零售商撤回订单（仅限 SUBMITTED 待批发商确认阶段）。
 * 批发商已确认（CONFIRMED）后不可撤回——需双方协商线下处理。
 */
export async function cancelSupplierOrderAction(
  supplierOrderId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("RETAILER");
  const t = dictForLocale(await getActionLocale());
  const retailerId = session.retailerId!;

  const so = await db.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    include: { order: { select: { retailerId: true } } },
  });
  if (!so || so.order.retailerId !== retailerId) {
    return { ok: false, error: t.orders.errNotFound };
  }
  if (so.status !== "SUBMITTED") {
    return { ok: false, error: t.orders.errCancel };
  }

  await db.supplierOrder.update({
    where: { id: supplierOrderId },
    data: { status: "CANCELLED" },
  });
  await syncMasterOrder(db, so.orderId);

  revalidatePath("/retailer/orders");
  revalidatePath(`/retailer/orders/${so.orderId}`);
  return { ok: true };
}
