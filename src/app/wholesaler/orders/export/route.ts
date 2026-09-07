import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrdersExportPdfDocument } from "@/components/pdf-docs";
import type { ExportOrderDoc } from "@/components/pdf-docs";
import { date } from "@/lib/format";
import { getLocale, dictForLocale } from "@/i18n";

/** 批发订单批量导出/发货单打印：?ids= → 合并 PDF（每单一页：客户/明细/合计） */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "WHOLESALER" || !session.user.wholesalerId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const wholesalerId = session.user.wholesalerId;
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);

  const me = await db.wholesaler.findUnique({
    where: { id: wholesalerId },
    include: { business: true },
  });

  const orders = await db.supplierOrder.findMany({
    where: { id: { in: ids }, wholesalerId },
    include: {
      order: {
        include: {
          retailer: { include: { business: true } },
        },
      },
      items: true,
    },
  });

  const docs: ExportOrderDoc[] = [];
  for (const so of orders) {
    const buyer = so.order.retailer.business;
    docs.push({
      orderNumber: so.order.orderNumber,
      date: date(so.createdAt),
      status: so.status,
      buyerName: buyer.tradeName ?? buyer.legalName ?? "",
      sellerName: me?.business.tradeName ?? me?.business.legalName ?? "",
      sellerLegal: me?.business.legalName ?? null,
      items: so.items.map((i) => ({
        name: i.productName,
        sku: i.sku,
        unitPrice: Number(i.unitPrice),
        quantity: i.quantity,
        subtotal: Number(i.subtotal),
      })),
      total: Number(so.total),
      currency: so.order.currency ?? "USD",
    });
  }

  if (docs.length === 0) return new NextResponse("Not found", { status: 404 });
  const locale = await getLocale();
  const buffer = await renderToBuffer(
    OrdersExportPdfDocument({ docs, t: dictForLocale(locale).pdf }),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="supplier-orders-export-${Date.now()}.pdf"`,
    },
  });
}
