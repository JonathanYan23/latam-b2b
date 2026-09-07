import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { AccountSecurity } from "@/components/account-security";

export const metadata = { title: "Account & Security" };

export default async function WholesalerSecurityPage() {
  const session = await requireRole("WHOLESALER");
  const t = await getDictionary();

  const wholesaler = await db.wholesaler.findUnique({
    where: { id: session.wholesalerId! },
    select: { business: { select: { tradeName: true } } },
  });

  return (
    <AccountSecurity
      t={t}
      name={session.name}
      email={session.email}
      role="WHOLESALER"
      currency={session.currency}
      businessName={wholesaler?.business.tradeName ?? null}
    />
  );
}
