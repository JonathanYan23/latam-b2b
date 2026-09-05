import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { money } from "@/lib/format";
import { parseImages } from "@/lib/pricing";

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const t = await getDictionary();
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: { wholesaler: { include: { business: true } }, category: true },
  });
  if (!product) notFound();
  const [img] = parseImages(product.images);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <Link
        href="/admin/products"
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.admin.products}
      </Link>

      <div className="card flex flex-wrap gap-5 p-6">
        <span className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-[var(--color-bg-muted)]">
          {img && (
            <Image src={img} alt={product.name} fill sizes="112px" className="object-cover" unoptimized />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-h2">{product.name}</h1>
          <p className="text-meta mt-0.5 text-sm">
            {t.admin.sku}: {product.sku} · {t.common.moq} {product.moq}
          </p>
          {product.category && (
            <span className="badge badge-neutral mt-2">{product.category.name}</span>
          )}
          <p className="mt-2 text-lg font-semibold">
            {money(product.publicPrice ?? 0, product.currency)}
          </p>
          {product.description && (
            <p className="text-meta mt-2 text-sm">{product.description}</p>
          )}
        </div>
      </div>

      <div className="card mt-4 flex items-center justify-between p-5">
        <div>
          <p className="text-meta text-xs">{t.admin.wholesalers}</p>
          <p className="text-sm font-medium">
            {product.wholesaler.business.tradeName ?? product.wholesaler.business.legalName}
          </p>
        </div>
        <Link
          href={`/admin/wholesalers/${product.wholesalerId}`}
          className="btn btn-secondary px-3 py-1.5 text-xs"
        >
          {t.admin.viewDetails} →
        </Link>
      </div>
    </div>
  );
}
