import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrdersExportPdfDocument } from "@/components/pdf-docs";
import type { ExportOrderDoc } from "@/components/pdf-docs";
import { date } from "@/lib/format";
import { getLocale, dictForLocale } from "@/i18n";

/** 零售订单批量导出：?ids=a,b,c → 合并 PDF（每供应商子单一页） */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "RETAILER" || !session.user.retailerId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const retailerId = session.user.retailerId;
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);

  const orders = await db.order.findMany({
    where: { id: { in: ids }, retailerId },
    include: {
      retailer: { include: { business: true } },
      supplierOrders: {
        include: {
          wholesaler: { include: { business: true } },
          items: true,
        },
      },
    },
  });

  const docs: ExportOrderDoc[] = [];
  for (const o of orders) {
    const buyerName =
      o.retailer.business.tradeName ?? o.retailer.business.legalName ?? "";
    for (const so of o.supplierOrders) {
      docs.push({
        orderNumber: o.orderNumber,
        date: date(o.createdAt),
        status: so.status,
        buyerName,
        sellerName:
          so.wholesaler.business.tradeName ?? so.wholesaler.business.legalName,
        sellerLegal: so.wholesaler.business.legalName,
        items: so.items.map((i) => ({
          name: i.productName,
          sku: i.sku,
          unitPrice: Number(i.unitPrice),
          quantity: i.quantity,
          subtotal: Number(i.subtotal),
        })),
        total: Number(so.total),
        currency: o.currency ?? "USD",
      });
    }
  }

  if (docs.length === 0) return new NextResponse("Not found", { status: 404 });
  const locale = await getLocale();
  const buffer = await renderToBuffer(
    OrdersExportPdfDocument({ docs, t: dictForLocale(locale).pdf }),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orders-export-${Date.now()}.pdf"`,
    },
  });
}
