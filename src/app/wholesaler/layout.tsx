import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {getDictionary, getLocale} from "@/i18n";
import { PortalShell } from "@/components/portal-shell";

export default async function WholesalerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/auth");
  if (session.user.role !== "WHOLESALER") redirect("/");

  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <PortalShell
      role="wholesaler"
      brand={t.nav.wholesalerBrand}
      userName={session.user.name}
      userEmail={session.user.email}
      t={t}
      locale={locale}
    >
      {children}
    </PortalShell>
  );
}
