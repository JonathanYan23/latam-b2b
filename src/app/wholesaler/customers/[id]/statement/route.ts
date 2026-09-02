import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatementPdfDocument } from "@/components/pdf-docs";
import { date, invoiceStatusLabel } from "@/lib/format";
import {getLocale, dictForLocale} from "@/i18n";

/** 批发商为客户生成 Account Statement PDF（PRD 25 节） */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "WHOLESALER" || !session.user.wholesalerId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await params;

  const rel = await db.customerRelationship.findUnique({
    where: { id },
    include: {
      wholesaler: { include: { business: true } },
      retailer: { include: { business: true } },
    },
  });
  if (!rel || rel.wholesalerId !== session.user.wholesalerId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const locale = await getLocale();
  const t = dictForLocale(locale);
  const pdf = t.pdf;

  const invoices = await db.invoice.findMany({
    where: { wholesalerId: rel.wholesalerId, retailerId: rel.retailerId },
    orderBy: { createdAt: "asc" },
  });
  const outstanding = invoices
    .filter((i) => ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(i.status))
    .reduce((s, i) => s + Number(i.amount), 0);

  const buffer = await renderToBuffer(
    StatementPdfDocument({
      customer: {
        name: rel.retailer.business.tradeName ?? rel.retailer.business.legalName,
        legalName: rel.retailer.business.legalName,
        taxId: rel.retailer.business.taxId,
      },
      supplier: {
        name: rel.wholesaler.business.tradeName ?? rel.wholesaler.business.legalName,
        legalName: rel.wholesaler.business.legalName,
        taxId: rel.wholesaler.business.taxId,
      },
      date: date(new Date(), locale),
      invoices: invoices.map((i) => ({
        number: i.invoiceNumber,
        date: date(i.createdAt, locale),
        dueDate: i.dueDate ? date(i.dueDate, locale) : undefined,
        amount: Number(i.amount),
        status: invoiceStatusLabel(i.status, t),
      })),
      outstanding,
      t: pdf,
      currency: (session.user as { currency?: string }).currency ?? "USD",
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="statement-${rel.retailer.business.tradeName?.replace(/\s+/g, "-") ?? "customer"}.pdf"`,
    },
  });
}
