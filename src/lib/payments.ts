import type { Prisma } from "@prisma/client";

/** 重算客户发票状态：已收款项按时间顺序抵扣未付发票 */
export async function applyPayments(
  tx: Prisma.TransactionClient,
  wholesalerId: string,
  retailerId: string,
) {
  const [invoices, payments] = await Promise.all([
    tx.invoice.findMany({
      where: {
        wholesalerId,
        retailerId,
        status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
      },
      orderBy: { createdAt: "asc" },
    }),
    tx.payment.findMany({
      where: {
        wholesalerId,
        retailerId,
        status: "RECEIVED",
        paidAt: { not: null },
      },
      orderBy: { paidAt: "asc" },
    }),
  ]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  let remaining = totalPaid;

  for (const inv of invoices) {
    const amount = Number(inv.amount);
    if (remaining <= 0) {
      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: isOverdue(inv) ? "OVERDUE" : "UNPAID" },
      });
    } else if (remaining >= amount) {
      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: "PAID" },
      });
      remaining -= amount;
    } else {
      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: "PARTIALLY_PAID" },
      });
      remaining = 0;
    }
  }
}

function isOverdue(inv: { dueDate: Date | null }): boolean {
  return !!inv.dueDate && inv.dueDate < new Date();
}

/**
 * 计算"真实未付余额"：部分付款的发票不能按全额计入。
 * 收款按时间顺序（FIFO）从最早的未付发票开始抵扣，
 * 返回每张发票实际还欠多少 + 合计。
 */
export function computeOutstanding(
  invoices: { id: string; amount: { toString(): string } }[],
  receivedTotal: number,
) {
  let remaining = receivedTotal;
  let total = 0;
  const map = new Map<string, number>();
  for (const inv of invoices) {
    const amount = Number(inv.amount);
    const pay = Math.min(remaining, amount);
    remaining -= pay;
    const owes = amount - pay;
    map.set(inv.id, owes);
    total += owes;
  }
  return { perInvoice: map, total };
}
