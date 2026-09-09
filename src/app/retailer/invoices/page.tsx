import Link from "next/link";
import { Search, ArrowLeft, FileDown } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { date, money, invoiceStatusLabel } from "@/lib/format";
import type { InvoiceStatus } from "@prisma/client";

export const metadata = { title: "Invoices" };

/** 发票总览：搜索（发票号/供应商/金额）+ 付款状态 + 到期时间 */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; s?: string; f?: string; t?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const cur = session.currency ?? "USD";
  const t = await getDictionary();
  const retailerId = session.retailerId!;
  const { q, s, f, t: ft } = await searchParams;
  const kw = (q ?? "").trim();
  const status = (s ?? "ALL").toUpperCase();
  const from = (f ?? "").trim();
  const to = (ft ?? "").trim();
  const hasFilter = Boolean(kw || from || to || status !== "ALL");

  const invoices = await db.invoice.findMany({
    where: {
      retailerId,
      ...(status !== "ALL" ? { status: status as InvoiceStatus } : {}),
      ...(from || to
        ? {
            dueDate: {
              ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
              ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { wholesaler: { include: { business: true } } },
  });

  const isAmount = /^\d+(\.\d+)?$/.test(kw);
  const rows = invoices.filter((inv) => {
    if (!kw) return true;
    if (isAmount) return Number(inv.amount) === parseFloat(kw);
    return (
      inv.invoiceNumber.toLowerCase().includes(kw.toLowerCase()) ||
      (inv.wholesaler.business.tradeName ?? "").toLowerCase().includes(kw.toLowerCase()) ||
      (inv.wholesaler.business.legalName ?? "").toLowerCase().includes(kw.toLowerCase())
    );
  });

  const STATUSES = ["ALL", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];
  const sp = (p2: Record<string, string | undefined>) => {
    const p3 = new URLSearchParams();
    if (kw) p3.set("q", kw);
    if (from) p3.set("f", from);
    if (to) p3.set("t", to);
    for (const [k, v] of Object.entries(p2)) {
      if (v === undefined) p3.delete(k);
      else p3.set(k, v);
    }
    const qs = p3.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/retailer#finance"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.retailerAccount.title}
      </Link>
      <h1 className="text-h1">
        {t.retailerAccount.invoices}
        <span className="badge badge-neutral ml-2 align-middle">{rows.length}</span>
      </h1>

      <form method="get" action="/retailer/invoices" className="card mt-5 flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-0 flex-1 basis-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input name="q" defaultValue={kw} placeholder={t.retailerAccount.searchInvoices} className="input h-10 pl-9 pr-24 text-sm" />
        </div>
        <label className="text-xs text-[var(--color-ink-2)]">
          {t.orders.dateFrom}
          <input name="f" type="date" defaultValue={from} className="input mt-1 h-10 px-2 text-sm" />
        </label>
        <label className="text-xs text-[var(--color-ink-2)]">
          {t.orders.dateTo}
          <input name="t" type="date" defaultValue={to} className="input mt-1 h-10 px-2 text-sm" />
        </label>
        <button type="submit" className="btn btn-primary h-10 px-4 text-sm">{t.common.search}</button>
        {hasFilter && (
          <Link href="/retailer/invoices" className="btn btn-ghost h-10 px-3 text-sm">{t.orders.resetFilter}</Link>
        )}
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUSES.map((st) => {
          const active = status === st;
          const label = st === "ALL" ? t.common.all : invoiceStatusLabel(st as InvoiceStatus, t);
          return (
            <Link
              key={st}
              href={`/retailer/invoices${sp({ s: st === "ALL" ? undefined : st })}`}
              className={
                active
                  ? "rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full border border-[var(--color-line-2)] px-3 py-1.5 text-xs text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="card mt-5 px-5 py-10 text-center text-sm text-[var(--color-ink-3)]">
          {t.common.noResults}
        </div>
      ) : (
        <div className="card mt-5 divide-y divide-[var(--color-line-2)] overflow-hidden">
          {rows.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                <p className="text-meta mt-0.5 truncate text-xs">
                  {inv.wholesaler.business.tradeName}
                </p>
              </div>
              <div className="hidden shrink-0 text-xs text-[var(--color-ink-3)] sm:block">
                {t.retailerAccount.due}: {date(inv.dueDate)}
              </div>
              <span className={`badge ${inv.status === "PAID" ? "badge-success" : inv.status === "UNPAID" ? "badge-warning" : inv.status === "OVERDUE" ? "badge-danger" : inv.status === "CANCELLED" ? "badge-neutral" : "badge-neutral"}`}>
                {invoiceStatusLabel(inv.status, t)}
              </span>
              <p className="amount w-24 shrink-0 text-right text-sm">{money(inv.amount, cur)}</p>
              <a
                href={`/retailer/invoices/${inv.id}/pdf`}
                target="_blank"
                className="shrink-0 rounded-md p-1.5 text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                title={t.retailerAccount.pdf}
              >
                <FileDown className="size-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
