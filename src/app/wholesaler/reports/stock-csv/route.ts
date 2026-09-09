import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** 库存预警 → 采购单草稿 CSV：低库存/缺货商品 + 建议补货量 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "WHOLESALER" || !session.user.wholesalerId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const products = await db.product.findMany({
    where: { wholesalerId: session.user.wholesalerId, active: true },
    include: { inventories: true },
  });
  const stockOf = (p: (typeof products)[number]) =>
    p.inventories.reduce((s, i) => s + i.stock, 0);
  const suggest = (p: (typeof products)[number], s: number) => {
    const th = p.lowStockThreshold ?? p.moq * 3;
    const target = Math.max(th * 2, p.moq);
    if (s >= target) return 0;
    const need = target - s;
    return Math.ceil(need / p.moq) * p.moq;
  };

  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ["Product,SKU,CurrentStock,SuggestedOrder,Unit"];
  for (const p of products) {
    const s = stockOf(p);
    const th = p.lowStockThreshold;
    const isAlert = s <= 0 || (th != null && s <= th) || (th == null && s < 20);
    if (!isAlert) continue;
    lines.push(
      [esc(p.name), esc(p.sku), String(s), String(suggest(p, s)), "unit"].join(","),
    );
  }
  const csv = "\uFEFF" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-draft-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
