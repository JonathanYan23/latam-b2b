import Link from "next/link";
import { Store, MapPin, Package } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { fmt } from "@/i18n/utils";
import {
  relationshipStatusLabel,
  relationshipStatusTone,
  date,
} from "@/lib/format";
import type { RelationshipStatus } from "@prisma/client";
import { SupplierChatButton } from "./chat-button";

export const metadata = { title: "My Suppliers" };

export default async function SuppliersPage() {
  const session = await requireRole("RETAILER");
  const t = await getDictionary();
  const retailerId = session.retailerId!;

  const [wholesalers, relationships] = await Promise.all([
    db.wholesaler.findMany({
      include: {
        business: { include: { city: true, country: true } },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.customerRelationship.findMany({
      where: { retailerId },
      select: {
        wholesalerId: true,
        status: true,
        approvedAt: true,
        paymentTerms: true,
      },
    }),
  ]);

  const relMap = new Map(
    relationships.map((r) => [
      r.wholesalerId,
      {
        status: r.status,
        approvedAt: r.approvedAt,
        paymentTerms: r.paymentTerms,
      },
    ]),
  );

  // 每个供应商的未读数（对方发来未读）
  const unreadGroups = await db.message.groupBy({
    by: ["wholesalerId"],
    where: { retailerId, senderId: { not: session.userId }, readAt: null },
    _count: { _all: true },
  });
  const unreadMap = new Map(unreadGroups.map((g) => [g.wholesalerId, g._count._all]));

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <h1 className="text-h1">{t.suppliers.title}</h1>
      <p className="text-body mt-1">{t.suppliers.desc}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {wholesalers.length === 0 ? (
          <div className="card col-span-full flex flex-col items-center px-6 py-14 text-center">
            <Store className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
            <p className="text-h3 text-base">{t.suppliers.emptyTitle}</p>
            <p className="text-meta mt-1.5 max-w-sm">{t.suppliers.emptyDesc}</p>
          </div>
        ) : (
          wholesalers.map((w) => {
            const meta = relMap.get(w.id) ?? {
              status: undefined,
              approvedAt: null,
              paymentTerms: null,
            };
            const status = meta.status as unknown as RelationshipStatus | undefined;
            const location = [
              w.business.city?.name,
              w.business.country?.name,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <div
                key={w.id}
                className="card card-hover flex items-center justify-between gap-3 p-5"
              >
                <Link
                  href={`/retailer/suppliers/${w.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3.5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-muted)]">
                    <Store className="size-5 text-[var(--color-ink-2)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {w.business.tradeName ?? w.business.legalName}
                    </span>
                    <span className="text-meta mt-0.5 flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1">
                        <Package className="size-3" />{" "}
                        {fmt(t.suppliers.productsCount, { n: w._count.products })}
                      </span>
                      {location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" /> {location}
                        </span>
                      )}
                    </span>
                    {status === "APPROVED" && (
                      <span className="text-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        {meta.approvedAt && (
                          <span>
                            {t.suppliers.partnerSince}: {date(meta.approvedAt)}
                          </span>
                        )}
                        {meta.paymentTerms && (
                          <span className="badge badge-neutral text-[10px]">
                            {t.common.terms}: {meta.paymentTerms}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  {status === "APPROVED" && (
                    <SupplierChatButton
                      wholesalerId={w.id}
                      supplierName={w.business.tradeName ?? w.business.legalName}
                      unread={unreadMap.get(w.id) ?? 0}
                    />
                  )}
                  {status && (
                    <span className={`badge ${relationshipStatusTone(status)}`}>
                      {relationshipStatusLabel(status, t)}
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
