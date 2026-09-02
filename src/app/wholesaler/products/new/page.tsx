import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { ProductForm } from "../product-form";

export const metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const session = await requireRole("WHOLESALER");
  const t = await getDictionary();
  const categories = await db.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <h1 className="text-h1">{t.productForm.addTitle}</h1>
      <p className="text-body mt-1">{t.productForm.addDesc}</p>
      <div className="mt-8">
        <ProductForm categories={categories} t={t} />
      </div>
    </div>
  );
}
