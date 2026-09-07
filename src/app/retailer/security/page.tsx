import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { AccountSecurity } from "@/components/account-security";

export const metadata = { title: "Account & Security" };

export default async function RetailerSecurityPage() {
  const session = await requireRole("RETAILER");
  const t = await getDictionary();

  const retailer = await db.retailer.findUnique({
    where: { id: session.retailerId! },
    select: { business: { select: { tradeName: true } } },
  });

  return (
    <AccountSecurity
      t={t}
      name={session.name}
      email={session.email}
      role="RETAILER"
      currency={session.currency}
      businessName={retailer?.business.tradeName ?? null}
    />
  );
}
