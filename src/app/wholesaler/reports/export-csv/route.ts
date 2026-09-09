import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** 月度报表 CSV 导出：?month=YYYY-MM（已完成订单：销售/成本/毛利逐单+合计） */
export async function GET(req: Request) {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "WHOLESALER" ||
    !session.user.wholesalerId
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "")
    ? url.searchParams.get("month")!
    : new Date().toISOString().slice(0, 7);

  const start = new Date(month + "-01T00:00:00");
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setSeconds(-1);

  const orders = await db.supplierOrder.findMany({
    where: {
      wholesalerId: session.user.wholesalerId,
      deletedAt: null,
      status: "COMPLETED",
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: "asc" },
    include: {
      order: {
        select: {
          orderNumber: true,
          retailer: { include: { business: { select: { tradeName: true } } } },
        },
      },
      items: { select: { quantity: true, product: { select: { costPrice: true } } } },
    },
  });

  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ["Order,Customer,Date,Sales,Cost,Margin"];
  let sales = 0;
  let cost = 0;
  for (const o of orders) {
    const c = o.items.reduce(
      (sum, it) => sum + (Number(it.product.costPrice ?? 0) * it.quantity || 0),
      0,
    );
    const amount = Number(o.total);
    sales += amount;
    cost += c;
    lines.push(
      [
        esc(o.order.orderNumber),
        esc(o.order.retailer.business.tradeName ?? ""),
        o.createdAt.toISOString().slice(0, 10),
        amount.toFixed(2),
        c.toFixed(2),
        (amount - c).toFixed(2),
      ].join(","),
    );
  }
  lines.push(
    ["", "", `TOTAL(${orders.length})`, sales.toFixed(2), cost.toFixed(2), (sales - cost).toFixed(2)].join(","),
  );

  const csv = "\uFEFF" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${month}.csv"`,
    },
  });
}
