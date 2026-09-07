import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { db } from "@/lib/db";
import { BulkProductForm } from "../bulk-form";

export const metadata = { title: "Bulk products" };

export default async function BulkProductsPage() {
  const session = await requireRole("WHOLESALER");
  const t = await getDictionary();
  // 商家内部查重基准：仅本店已上架商品（严禁跨商家比对）
  const existing = await db.product.findMany({
    where: { wholesalerId: session.wholesalerId! },
    select: { name: true, barcode: true },
  });
  return <BulkProductForm t={t} existing={existing} />;
}
