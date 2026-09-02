import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import {
  relationshipStatusLabel,
  relationshipStatusTone,
  tierLabel,
  date,
} from "@/lib/format";
import { ApproveRejectButtons } from "./customer-actions";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const session = await requireRole("WHOLESALER");
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;

  const relationships = await db.customerRelationship.findMany({
    where: { wholesalerId },
    orderBy: { createdAt: "desc" },
    include: {
      retailer: {
        include: {
          business: { include: { city: true, country: true } },
          user: { select: { name: true } },
        },
      },
      _count: { select: { customerPrices: true } },
    },
  });

  const pending = relationships.filter((r) => r.status === "PENDING");
  const approved = relationships.filter((r) => r.status === "APPROVED");
  const rejected = relationships.filter((r) => r.status === "REJECTED");

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <h1 className="text-h1">{t.wsCustomers.title}</h1>
      <p className="text-body mt-1">{t.wsCustomers.desc}</p>

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="text-h3 text-[15px] text-[var(--color-ink-2)]">
            {fmt(t.wsCustomers.requests, { n: pending.length })}
          </h2>
          <div className="mt-3 grid gap-3">
            {pending.map((r) => {
              const loc = [
                r.retailer.business.city?.name,
                r.retailer.business.country?.name,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <div
                  key={r.id}
                  className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-muted)]">
                      <Users className="size-5 text-[var(--color-ink-2)]" />
                    </span>
                    <div>
                      <p className="font-medium">
                        {r.retailer.business.tradeName}
                      </p>
                      <p className="text-meta mt-0.5 text-xs">
                        {r.retailer.business.legalName}
                        {loc && ` · ${loc}`} ·{" "}
                        {fmt(t.wsCustomers.requestedAt, {
                          date: date(r.requestedAt),
                        })}
                      </p>
                      {r.retailer.user?.name && (
                        <p className="text-meta mt-0.5 text-xs">
                          {t.common.contactPerson}: {r.retailer.user.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <ApproveRejectButtons relationshipId={r.id} t={t} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-h3 text-[15px] text-[var(--color-ink-2)]">
          {fmt(t.wsCustomers.approved, { n: approved.length })}
        </h2>
        {approved.length === 0 ? (
          <div className="card mt-3 flex flex-col items-center px-6 py-12 text-center">
            <p className="text-meta">{t.wsCustomers.noApproved}</p>
          </div>
        ) : (
          <div className="card mt-3 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line-2)] text-meta">
                  <th className="px-5 py-3 font-medium">{t.common.customer}</th>
                  <th className="px-5 py-3 font-medium">{t.wsCustomers.tier}</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">
                    {t.wsCustomers.terms}
                  </th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">
                    {t.wsCustomers.creditLimit}
                  </th>
                  <th className="px-5 py-3 font-medium">{t.wsCustomers.pricesSet}</th>
                  <th className="px-5 py-3 text-right font-medium">
                    {t.common.manage}
                  </th>
                </tr>
              </thead>
              <tbody>
                {approved.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--color-line-2)] last:border-0"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium">
                        {r.retailer.business.tradeName}
                      </p>
                      <p className="text-meta text-xs">
                        {r.retailer.business.legalName}
                      </p>
                      {r.retailer.user?.name && (
                        <p className="text-meta mt-0.5 text-xs">
                          {t.common.contactPerson}: {r.retailer.user.name}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="badge badge-neutral">
                        {tierLabel(r.tier, t)}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3.5 text-[var(--color-ink-2)] sm:table-cell">
                      {r.paymentTerms ?? "—"}
                    </td>
                    <td className="hidden px-5 py-3.5 text-[var(--color-ink-2)] md:table-cell">
                      {r.creditLimit
                        ? `$${Number(r.creditLimit).toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--color-ink-2)]">
                      {r._count.customerPrices} {t.common.product}s
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/wholesaler/customers/${r.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                      >
                        {t.common.manage} <ArrowRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {rejected.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h3 text-[15px] text-[var(--color-ink-2)]">
            {fmt(t.wsCustomers.declined, { n: rejected.length })}
          </h2>
          <div className="card mt-3 divide-y divide-[var(--color-line-2)]">
            {rejected.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-medium">
                    {r.retailer.business.tradeName}
                  </p>
                  <p className="text-meta text-xs">
                    {r.retailer.business.legalName} ·{" "}
                    {fmt(t.wsCustomers.requestedAt, {
                      date: date(r.requestedAt),
                    })}
                  </p>
                </div>
                <span className="badge badge-danger">
                  {relationshipStatusLabel(r.status, t)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
