import Link from "next/link";
import { Store, MapPin, Package } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary, getLocale} from "@/i18n";
import { fmt } from "@/i18n/utils";
import { relationshipStatusLabel, relationshipStatusTone } from "@/lib/format";
import { SupplierChatButton } from "./chat-button";

export const metadata = { title: "My Suppliers" };

export default async function SuppliersPage() {
  const session = await requireRole("RETAILER");
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
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
      select: { wholesalerId: true, status: true },
    }),
  ]);

  const relMap = new Map(relationships.map((r) => [r.wholesalerId, r.status]));

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
            const status = relMap.get(w.id);
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
                  </span>
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  {status === "APPROVED" && (
                    <SupplierChatButton
                      wholesalerId={w.id}
                      retailerId={retailerId}
                      supplierName={w.business.tradeName ?? w.business.legalName}
                      t={t}
                      locale={locale}
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
