import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InvoicePdfDocument } from "@/components/pdf-docs";
import { date, invoiceStatusLabel } from "@/lib/format";
import {getLocale, dictForLocale} from "@/i18n";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      wholesaler: { include: { business: true } },
      retailer: { include: { business: true } },
      supplierOrder: { include: { items: true } },
      order: { select: { orderNumber: true } },
    },
  });
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  // 权限：该发票的买卖双方可查看
  const isBuyer =
    session.user.role === "RETAILER" && invoice.retailerId === session.user.retailerId;
  const isSeller =
    session.user.role === "WHOLESALER" && invoice.wholesalerId === session.user.wholesalerId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isBuyer && !isSeller && !isAdmin)
    return new NextResponse("Forbidden", { status: 403 });

  const items = (invoice.supplierOrder?.items ?? []).map((i) => ({
    name: i.productName,
    sku: i.sku,
    unitPrice: Number(i.unitPrice),
    quantity: i.quantity,
    subtotal: Number(i.subtotal),
  }));
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

  const locale = await getLocale();
  const pdf = dictForLocale(locale).pdf;

  const buffer = await renderToBuffer(
    InvoicePdfDocument({
      invoiceNumber: invoice.invoiceNumber,
      orderNumber: invoice.order?.orderNumber ?? null,
      date: date(invoice.createdAt, locale),
      dueDate: invoice.dueDate ? date(invoice.dueDate, locale) : undefined,
      buyer: {
        name: invoice.retailer.business.tradeName ?? invoice.retailer.business.legalName,
        legalName: invoice.retailer.business.legalName,
        taxId: invoice.retailer.business.taxId,
      },
      supplier: {
        name: invoice.wholesaler.business.tradeName ?? invoice.wholesaler.business.legalName,
        legalName: invoice.wholesaler.business.legalName,
        taxId: invoice.wholesaler.business.taxId,
      },
      items,
      subtotal,
      discount: 0,
      shipping: 0,
      total: Number(invoice.amount),
      status: invoiceStatusLabel(invoice.status, dictForLocale(locale)),
      t: pdf,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
