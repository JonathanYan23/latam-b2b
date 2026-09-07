import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { navUnread } from "@/lib/unread";
import { db } from "@/lib/db";
import {getDictionary, getLocale} from "@/i18n";
import { PortalShell } from "@/components/portal-shell";

/** 购物车角标数：当前 DRAFT 草稿单的商品总件数 */
async function cartItemCount(retailerId: string | null | undefined): Promise<number> {
  if (!retailerId) return 0;
  const draft = await db.order.findFirst({
    where: { retailerId, status: "DRAFT" },
    select: {
      supplierOrders: { select: { items: { select: { quantity: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!draft) return 0;
  return draft.supplierOrders.reduce(
    (sum, so) => sum + so.items.reduce((x, i) => x + i.quantity, 0),
    0,
  );
}

export default async function RetailerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/auth");
  if (session.user.role !== "RETAILER") redirect("/");

  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <PortalShell
      role="retailer"
      brand={t.nav.retailerBrand}
      userName={session.user.name}
      userEmail={session.user.email}
      t={t}
      locale={locale}
      unread={await navUnread({
        role: session.user.role,
        userId: session.user.id,
        retailerId: (session.user as { retailerId?: string }).retailerId,
        wholesalerId: (session.user as { wholesalerId?: string }).wholesalerId,
      })}
      cartCount={await cartItemCount(
        (session.user as { retailerId?: string }).retailerId,
      )}
      currency={(session.user as { currency?: string }).currency ?? "USD"}
    >
      {children}
    </PortalShell>
  );
}
