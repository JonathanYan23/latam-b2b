import Link from "next/link";
import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import {
  relationshipStatusLabel,
  relationshipStatusTone,
  tierLabel,
  money,
  date,
} from "@/lib/format";
import {
  ApproveRejectButtons,
  DeleteCustomerButton,
} from "./customer-actions";

/** 客户等级徽章配色 */
function tierTone(tier: string): string {
  switch (tier) {
    case "VIP":
      return "badge-warning";
    case "GOLD":
      return "badge";
    case "VOLUME":
      return "badge-info";
    default:
      return "badge-neutral";
  }
}

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD"; // 账户货币符号
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
          <div className="mt-4 space-y-8">
            {(["VIP", "GOLD", "VOLUME", "STANDARD"] as const)
              .map((tier) => ({
                tier,
                items: approved.filter((r) => r.tier === tier),
              }))
              .filter((g) => g.items.length > 0)
              .map(({ tier, items }) => (
                <div key={tier}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <span className={`badge ${tierTone(tier)}`}>
                      {tierLabel(tier, t)}
                    </span>
                    <span className="text-meta font-normal">
                      {items.length} {t.common.customer}
                    </span>
                  </h3>
                  <div className="card mt-2 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-line-2)] text-meta">
                          <th className="px-5 py-3 font-medium">{t.common.customer}</th>
                          <th className="hidden w-40 whitespace-nowrap px-5 py-3 font-medium sm:table-cell">
                            {t.wsCustomers.terms}
                          </th>
                          <th className="hidden w-40 whitespace-nowrap px-5 py-3 font-medium md:table-cell">
                            {t.wsCustomers.creditLimit}
                          </th>
                          <th className="w-32 whitespace-nowrap px-5 py-3 font-medium">{t.wsCustomers.pricesSet}</th>
                          <th className="w-36 whitespace-nowrap px-5 py-3 text-right font-medium">
                            {t.common.manage}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((r) => (
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
                            <td className="hidden px-5 py-3.5 text-[var(--color-ink-2)] sm:table-cell">
                              {r.paymentTerms ?? "—"}
                            </td>
                            <td className="hidden px-5 py-3.5 text-[var(--color-ink-2)] md:table-cell">
                              {r.creditLimit ? money(r.creditLimit, cur) : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-[var(--color-ink-2)]">
                              {r._count.customerPrices} {t.common.products}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/wholesaler/customers/${r.id}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                                >
                                  {t.common.manage}
                                </Link>
                                <DeleteCustomerButton
                                  relationshipId={r.id}
                                  customerName={
                                    r.retailer.business.tradeName ??
                                    r.retailer.business.legalName
                                  }
                                  t={t}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
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
