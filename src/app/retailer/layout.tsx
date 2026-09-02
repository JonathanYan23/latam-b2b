import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
    >
      {children}
    </PortalShell>
  );
}
