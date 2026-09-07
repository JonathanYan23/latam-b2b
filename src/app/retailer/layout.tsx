import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { navUnread } from "@/lib/unread";
import {getDictionary, getLocale} from "@/i18n";
import { PortalShell } from "@/components/portal-shell";

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
    >
      {children}
    </PortalShell>
  );
}
