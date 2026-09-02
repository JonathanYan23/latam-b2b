"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product, SellingMode } from "@prisma/client";
import { createProductAction, updateProductAction } from "../actions";
import { parseImages } from "@/lib/pricing";
import type { Dict } from "@/i18n";

export function ProductForm({
  categories,
  product,
  t,
}: {
  categories: Pick<Category, "id" | "name">[];
  product?: Pick<
    Product,
    "id" | "name" | "sku" | "description" | "categoryId" | "images" | "moq" | "sellingMode"
  > & { publicPrice: number | null };
  t: Dict;
}) {
  const router = useRouter();
  const isEdit = !!product;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateProductAction.bind(null, product!.id) : createProductAction,
    undefined,
  );

  const [img] = product ? parseImages(product.images) : [""];
  const pf = t.productForm;

  return (
    <form action={formAction} className="card max-w-2xl p-6">
      {state?.error && (
        <p className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c] animate-fade-in">
          {state.error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.name}
          </label>
          <input name="name" className="input" defaultValue={product?.name} required />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.sku}
          </label>
          <input name="sku" className="input" defaultValue={product?.sku} required />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.category}
          </label>
          <select
            name="categoryId"
            className="input"
            defaultValue={product?.categoryId ?? ""}
          >
            <option value="">{pf.uncategorized}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.description}
          </label>
          <textarea
            name="description"
            rows={3}
            className="input resize-none"
            defaultValue={product?.description ?? ""}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.imageUrl}
          </label>
          <input
            name="imageUrl"
            className="input"
            placeholder="https://…"
            defaultValue={img}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.publicPrice}
          </label>
          <input
            name="publicPrice"
            type="number"
            step="0.01"
            min="0"
            className="input"
            defaultValue={product?.publicPrice?.toString() ?? ""}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.moq}
          </label>
          <input
            name="moq"
            type="number"
            min="1"
            className="input"
            defaultValue={product?.moq?.toString() ?? "1"}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.stock}
          </label>
          <input
            name="stock"
            type="number"
            min="0"
            className="input"
            defaultValue={undefined}
            placeholder="0"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {pf.sellingMode}
          </label>
          <select
            name="sellingMode"
            className="input"
            defaultValue={product?.sellingMode ?? "BOTH"}
          >
            <option value="BOTH">{pf.modeBoth}</option>
            <option value="PUBLIC">{pf.modePublic}</option>
            <option value="CUSTOMER_ONLY">{pf.modeCustomer}</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-ghost px-4 py-2 text-sm"
        >
          {t.common.cancel}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary px-5 py-2 text-sm"
        >
          {pending ? t.common.saving : isEdit ? t.common.save : pf.createBtn}
        </button>
      </div>
    </form>
  );
}
