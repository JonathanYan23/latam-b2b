import Link from "next/link";
import { Users, MessageCircle, Search } from "lucide-react";
import { InviteCustomerButton } from "./invite-button";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  relationshipStatusLabel,
  relationshipStatusTone,
  tierLabel,
  money,
  date,
} from "@/lib/format";
import { termsLabel } from "@/lib/terms";
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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const cur = session.currency ?? "USD"; // 账户货币符号
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const relationships = await db.customerRelationship.findMany({
    where: {
      wholesalerId,
      ...(query
        ? {
            retailer: {
              OR: [
                { business: { tradeName: { contains: query } } },
                { business: { legalName: { contains: query } } },
                { user: { name: { contains: query } } },
              ],
            },
          }
        : {}),
    },
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

  // 每个客户会话的未读数（对方发来未读）
  const unreadGroups = await db.message.groupBy({
    by: ["retailerId"],
    where: {
      wholesalerId,
      senderId: { not: session.userId },
      readAt: null,
    },
    _count: { _all: true },
  });
  const unreadMap = new Map(unreadGroups.map((g) => [g.retailerId, g._count._all]));

  const pending = relationships.filter((r) => r.status === "PENDING");
  const approved = relationships.filter((r) => r.status === "APPROVED");
  const rejected = relationships.filter((r) => r.status === "REJECTED");

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
        <AutoRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1">{t.wsCustomers.title}</h1>
          <p className="text-body mt-1">{t.wsCustomers.desc}</p>
        </div>
        <InviteCustomerButton
          wholesalerId={wholesalerId}
          label={t.wsCustomers.inviteCustomer}
          copiedLabel={t.wsCustomers.inviteCopied}
        />
      </div>

      {/* 搜索客户：公司/联系人 */}
      <form action="/wholesaler/customers" method="get" className="mt-5 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input
            name="q"
            defaultValue={query}
            placeholder={t.wsCustomers.searchPlaceholder}
            className="input pl-9"
          />
        </div>
        <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
          {t.common.search}
        </button>
      </form>

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
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {items.map((r) => {
                      const unread = unreadMap.get(r.retailerId) ?? 0;
                      return (
                        <div
                          key={r.id}
                          className="card flex flex-col gap-3 p-4"
                        >
                          {/* 头部：名称 + 操作 */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/wholesaler/customers/${r.id}`}
                                className="block truncate font-medium hover:underline"
                              >
                                {r.retailer.business.tradeName}
                              </Link>
                              <p className="text-meta truncate text-xs">
                                {r.retailer.business.legalName}
                              </p>
                              {r.retailer.user?.name && (
                                <p className="text-meta mt-0.5 truncate text-[11px]">
                                  {t.common.contactPerson}: {r.retailer.user.name}
                                </p>
                              )}
                            </div>
                            <DeleteCustomerButton
                              relationshipId={r.id}
                              customerName={
                                r.retailer.business.tradeName ??
                                r.retailer.business.legalName
                              }
                              t={t}
                            />
                          </div>

                          {/* 条款行 */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {r.paymentTerms && (
                              <span className="badge badge-neutral text-[11px]">
                                {termsLabel(r.paymentTerms, t)}
                              </span>
                            )}
                            {r.creditLimit != null && (
                              <span className="badge badge-neutral text-[11px]">
                                {money(r.creditLimit, cur)}
                              </span>
                            )}
                            <span className="text-meta ml-auto text-[11px]">
                              {r._count.customerPrices} {t.common.products}
                            </span>
                          </div>

                          {/* 底部：聊天 + 管理 */}
                          <div className="flex items-center gap-1.5 border-t border-[var(--color-line-2)] pt-2.5">
                            <Link
                              href={`/wholesaler/customers/${r.id}/chat`}
                              title={t.common.chat}
                              className="relative grid size-8 place-items-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-bg)] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white"
                            >
                              <MessageCircle className="size-4" />
                              {unread > 0 && (
                                <span className="absolute -right-1 -top-1 grid min-w-3.5 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-semibold leading-tight text-white">
                                  {unread > 9 ? "9+" : unread}
                                </span>
                              )}
                            </Link>
                            <Link
                              href={`/wholesaler/customers/${r.id}`}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--color-line-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                            >
                              {t.common.manage} →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
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
