import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrderPdfDocument } from "@/components/pdf-docs";
import { date } from "@/lib/format";
import {getLocale, dictForLocale} from "@/i18n";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "RETAILER" || !session.user.retailerId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
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
  if (!order || order.retailerId !== session.user.retailerId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const locale = await getLocale();
  const pdf = dictForLocale(locale).pdf;

  const buffer = await renderToBuffer(
    OrderPdfDocument({
      orderNumber: order.orderNumber,
      date: date(order.createdAt, locale),
      buyer: {
        name: order.retailer.business.tradeName ?? order.retailer.business.legalName,
        legalName: order.retailer.business.legalName,
        taxId: order.retailer.business.taxId,
      },
      sections: order.supplierOrders.map((so) => ({
        supplier: so.wholesaler.business.tradeName ?? so.wholesaler.business.legalName,
        items: so.items.map((i) => ({
          name: i.productName,
          sku: i.sku,
          unitPrice: Number(i.unitPrice),
          quantity: i.quantity,
          subtotal: Number(i.subtotal),
        })),
        subtotal: Number(so.subtotal),
        discount: Number(so.discount),
        shipping: Number(so.shipping),
        total: Number(so.total),
      })),
      notes: order.notes,
      t: pdf,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="order-${order.orderNumber}.pdf"`,
    },
  });
}
