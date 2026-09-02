import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Dict } from "@/i18n";
import { fmt } from "@/i18n/utils";

// =============================================================
// PDF 文档（PRD 12/25 节：Order / Invoice / Statement）
// 极简企业风格，标准 Helvetica 字体，支持多语言标签
// =============================================================

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#18181b", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  brand: { fontSize: 15, fontWeight: "bold", letterSpacing: -0.3 },
  docTitle: { fontSize: 20, fontWeight: "bold", marginTop: 2 },
  docMeta: { fontSize: 8, color: "#71717a", marginTop: 2 },
  muted: { color: "#71717a" },
  h2: { fontSize: 10, fontWeight: "bold", marginTop: 14, marginBottom: 6 },
  parties: { flexDirection: "row", gap: 40 },
  partyBlock: { flex: 1 },
  partyLabel: { fontSize: 7, color: "#71717a", textTransform: "uppercase", marginBottom: 3 },
  partyName: { fontSize: 10, fontWeight: "bold" },
  partyLine: { fontSize: 8, color: "#52525b", marginTop: 1 },
  table: { marginTop: 6, borderTop: 1, borderLeft: 1, borderColor: "#e4e4e7" },
  tableRow: { flexDirection: "row", borderBottom: 1, borderColor: "#e4e4e7" },
  th: { fontSize: 7, color: "#71717a", textTransform: "uppercase", padding: 5, flex: 1 },
  td: { fontSize: 8, padding: 5, flex: 1 },
  tdRight: { fontSize: 8, padding: 5, flex: 1, textAlign: "right" },
  thRight: { fontSize: 7, color: "#71717a", textTransform: "uppercase", padding: 5, flex: 1, textAlign: "right" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalRowBold: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderTop: 1, borderColor: "#e4e4e7", marginTop: 3 },
  footer: { position: "absolute", bottom: 30, left: 36, right: 36, borderTop: 1, borderColor: "#f0f0f1", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#a1a1aa" },
  note: { fontSize: 8, color: "#52525b", marginTop: 10 },
});

export interface PdfParty {
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface PdfItem {
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface PdfSection {
  supplier: string;
  items: PdfItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

function fmt$(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OrderPdfDocument({
  orderNumber,
  date,
  buyer,
  sections,
  notes,
  t,
}: {
  orderNumber: string;
  date: string;
  buyer: PdfParty;
  sections: PdfSection[];
  notes?: string | null;
  t: Dict["pdf"];
}) {
  const grandTotal = sections.reduce((s, sec) => s + sec.total, 0);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{t.brand}</Text>
            <Text style={styles.docMeta}>{t.brandTag}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>{t.purchaseOrder}</Text>
            <Text style={styles.docMeta}>#{orderNumber}</Text>
            <Text style={styles.docMeta}>
              {t.date}: {date}
            </Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>{t.buyer}</Text>
            <Text style={styles.partyName}>{buyer.name}</Text>
            {buyer.legalName && <Text style={styles.partyLine}>{buyer.legalName}</Text>}
            {buyer.taxId && (
              <Text style={styles.partyLine}>
                {t.brand === "Latam B2B" ? "Tax ID" : "Tax ID"}: {buyer.taxId}
              </Text>
            )}
          </View>
        </View>

        {sections.map((sec, i) => (
          <View key={i} wrap={false}>
            <Text style={styles.h2}>{fmt(t.supplier, { n: i + 1 })}: {sec.supplier}</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.th}>{t.product}</Text>
                <Text style={styles.th}>{t.sku}</Text>
                <Text style={styles.thRight}>{t.unitPrice}</Text>
                <Text style={styles.thRight}>{t.qty}</Text>
                <Text style={styles.thRight}>{t.subtotal}</Text>
              </View>
              {sec.items.map((item, j) => (
                <View key={j} style={styles.tableRow}>
                  <Text style={styles.td}>{item.name}</Text>
                  <Text style={styles.td}>{item.sku}</Text>
                  <Text style={styles.tdRight}>{fmt$(item.unitPrice)}</Text>
                  <Text style={styles.tdRight}>{item.quantity}</Text>
                  <Text style={styles.tdRight}>{fmt$(item.subtotal)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.muted}>{t.subtotal}</Text>
                <Text>{fmt$(sec.subtotal)}</Text>
              </View>
              {sec.discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>{t.discount}</Text>
                  <Text>-{fmt$(sec.discount)}</Text>
                </View>
              )}
              {sec.shipping > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>{t.shipping}</Text>
                  <Text>{fmt$(sec.shipping)}</Text>
                </View>
              )}
              <View style={styles.totalRowBold}>
                <Text style={{ fontWeight: "bold" }}>{t.supplierTotal}</Text>
                <Text style={{ fontWeight: "bold" }}>{fmt$(sec.total)}</Text>
              </View>
            </View>
          </View>
        ))}

        <View style={[styles.totals, { alignSelf: "flex-end", marginTop: 16 }]}>
          <View style={styles.totalRowBold}>
            <Text style={{ fontSize: 11, fontWeight: "bold" }}>{t.grandTotal}</Text>
            <Text style={{ fontSize: 11, fontWeight: "bold" }}>{fmt$(grandTotal)}</Text>
          </View>
        </View>

        {notes && (
          <Text style={styles.note}>
            {t.notes} {notes}
          </Text>
        )}

        <View style={styles.footer}>
          <Text>{t.footerOrder}</Text>
          <Text>1</Text>
        </View>
      </Page>
    </Document>
  );
}

export function InvoicePdfDocument({
  invoiceNumber,
  orderNumber,
  date,
  dueDate,
  buyer,
  supplier,
  items,
  subtotal,
  discount,
  shipping,
  total,
  status,
  t,
}: {
  invoiceNumber: string;
  orderNumber?: string | null;
  date: string;
  dueDate?: string;
  buyer: PdfParty;
  supplier: PdfParty;
  items: PdfItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  status: string;
  t: Dict["pdf"];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{t.brand}</Text>
            <Text style={styles.docMeta}>{t.brandTag}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>{t.invoice}</Text>
            <Text style={styles.docMeta}>{invoiceNumber}</Text>
            <Text style={styles.docMeta}>
              {t.date}: {date}
            </Text>
            {dueDate && (
              <Text style={styles.docMeta}>
                {t.due}: {dueDate}
              </Text>
            )}
            <Text style={[styles.docMeta, { color: "#b45309" }]}>
              {t.status}: {status}
            </Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>{t.fromSupplier}</Text>
            <Text style={styles.partyName}>{supplier.name}</Text>
            {supplier.legalName && <Text style={styles.partyLine}>{supplier.legalName}</Text>}
            {supplier.taxId && <Text style={styles.partyLine}>{supplier.taxId}</Text>}
            {supplier.address && <Text style={styles.partyLine}>{supplier.address}</Text>}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>{t.billTo}</Text>
            <Text style={styles.partyName}>{buyer.name}</Text>
            {buyer.legalName && <Text style={styles.partyLine}>{buyer.legalName}</Text>}
            {buyer.taxId && <Text style={styles.partyLine}>{buyer.taxId}</Text>}
          </View>
        </View>

        <Text style={styles.h2}>
          {orderNumber ? fmt(t.orderLabel, { n: orderNumber }) : t.orderItems}
        </Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.th}>{t.product}</Text>
            <Text style={styles.th}>{t.sku}</Text>
            <Text style={styles.thRight}>{t.unitPrice}</Text>
            <Text style={styles.thRight}>{t.qty}</Text>
            <Text style={styles.thRight}>{t.amount}</Text>
          </View>
          {items.map((item, j) => (
            <View key={j} style={styles.tableRow}>
              <Text style={styles.td}>{item.name}</Text>
              <Text style={styles.td}>{item.sku}</Text>
              <Text style={styles.tdRight}>{fmt$(item.unitPrice)}</Text>
              <Text style={styles.tdRight}>{item.quantity}</Text>
              <Text style={styles.tdRight}>{fmt$(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>{t.subtotal}</Text>
            <Text>{fmt$(subtotal)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>{t.discount}</Text>
              <Text>-{fmt$(discount)}</Text>
            </View>
          )}
          {shipping > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>{t.shipping}</Text>
              <Text>{fmt$(shipping)}</Text>
            </View>
          )}
          <View style={styles.totalRowBold}>
            <Text style={{ fontWeight: "bold" }}>{t.totalDue}</Text>
            <Text style={{ fontWeight: "bold" }}>{fmt$(total)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{t.footerInvoice}</Text>
          <Text>{t.brand}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function StatementPdfDocument({
  customer,
  supplier,
  date,
  invoices,
  outstanding,
  t,
}: {
  customer: PdfParty;
  supplier: PdfParty;
  date: string;
  invoices: {
    number: string;
    date: string;
    dueDate?: string;
    amount: number;
    status: string;
  }[];
  outstanding: number;
  t: Dict["pdf"];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{t.brand}</Text>
            <Text style={styles.docMeta}>{t.brandTag}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>{t.statement}</Text>
            <Text style={styles.docMeta}>{fmt(t.asOf, { date })}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>{t.fromSupplier}</Text>
            <Text style={styles.partyName}>{supplier.name}</Text>
            {supplier.taxId && <Text style={styles.partyLine}>{supplier.taxId}</Text>}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>{t.customer}</Text>
            <Text style={styles.partyName}>{customer.name}</Text>
            {customer.legalName && <Text style={styles.partyLine}>{customer.legalName}</Text>}
            {customer.taxId && <Text style={styles.partyLine}>{customer.taxId}</Text>}
          </View>
        </View>

        <Text style={styles.h2}>{t.invoices}</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.th}>{t.invoiceNumber}</Text>
            <Text style={styles.th}>{t.date}</Text>
            <Text style={styles.th}>{t.due}</Text>
            <Text style={styles.thRight}>{t.amount}</Text>
            <Text style={styles.thRight}>{t.status}</Text>
          </View>
          {invoices.map((inv, j) => (
            <View key={j} style={styles.tableRow}>
              <Text style={styles.td}>{inv.number}</Text>
              <Text style={styles.td}>{inv.date}</Text>
              <Text style={styles.td}>{inv.dueDate ?? "—"}</Text>
              <Text style={styles.tdRight}>{fmt$(inv.amount)}</Text>
              <Text style={styles.tdRight}>{inv.status}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.totals, { marginTop: 12 }]}>
          <View style={styles.totalRowBold}>
            <Text style={{ fontWeight: "bold" }}>{t.outstandingBalance}</Text>
            <Text style={{ fontWeight: "bold" }}>{fmt$(outstanding)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{t.footerStatement}</Text>
          <Text>{t.brand}</Text>
        </View>
      </Page>
    </Document>
  );
}
