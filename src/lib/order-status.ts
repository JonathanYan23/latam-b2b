import type { PrismaClient } from "@prisma/client";
import type { OrderStatus } from "@prisma/client";

/**
 * 同步主订单（Master Order）状态聚合。
 * 规则：
 * - 全部子单 COMPLETED → COMPLETED
 * - 全部子单 CANCELLED → CANCELLED
 * - 否则取第一个「进行中」子单的状态（CANCELLED/COMPLETED 之外）
 */
export async function syncMasterOrder(
  db: PrismaClient,
  orderId: string,
): Promise<void> {
  const sos = await db.supplierOrder.findMany({
    where: { orderId },
    select: { status: true },
  });
  if (!sos.length) return;

  let master: OrderStatus | null = null;
  if (sos.every((s) => s.status === "COMPLETED")) master = "COMPLETED";
  else if (sos.every((s) => s.status === "CANCELLED")) master = "CANCELLED";
  else {
    const active = sos.find(
      (s) => s.status !== "CANCELLED" && s.status !== "COMPLETED",
    );
    if (active) master = active.status;
  }

  if (master) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (order && order.status !== master) {
      await db.order.update({ where: { id: orderId }, data: { status: master } });
    }
  }
}
