import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { BulkProductForm } from "../bulk-form";

export const metadata = { title: "Bulk products" };

export default async function BulkProductsPage() {
  await requireRole("WHOLESALER");
  const t = await getDictionary();
  return <BulkProductForm t={t} />;
}
