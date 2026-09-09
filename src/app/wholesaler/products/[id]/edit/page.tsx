import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary} from "@/i18n";
import { ProductForm } from "../../product-form";

export const metadata = { title: "Edit Product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const t = await getDictionary();
  const wholesalerId = session.wholesalerId!;
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sku: true,
      description: true,
      categoryId: true,
      images: true,
      wholesalerId: true,
      moq: true,
      sellingMode: true,
      publicPrice: true,
      costPrice: true,
      lowStockThreshold: true,
      boxSize: true,
      showBoxSize: true,
      nameZh: true,
      nameEn: true,
      nameEs: true,
      inventories: true,
    },
  });
  if (!product || product.wholesalerId !== wholesalerId) notFound();

  const categories = await db.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <Link
        href="/wholesaler/products"
        className="text-meta mb-5 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.productForm.backToProducts}
      </Link>
      <h1 className="text-h1">{t.productForm.editTitle}</h1>
      <p className="text-body mt-1">{product.name}</p>
      <div className="mt-8">
        <ProductForm
          categories={categories}
          t={t}
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            description: product.description,
            categoryId: product.categoryId,
            images: product.images,
            publicPrice: product.publicPrice ? Number(product.publicPrice) : null,
            costPrice: product.costPrice ? Number(product.costPrice) : null,
            lowStockThreshold: product.lowStockThreshold,
            boxSize: product.boxSize,
            showBoxSize: product.showBoxSize !== false,
            nameZh: product.nameZh,
            nameEn: product.nameEn,
            nameEs: product.nameEs,
            moq: product.moq,
            sellingMode: product.sellingMode,
          }}
        />
      </div>
    </div>
  );
}
