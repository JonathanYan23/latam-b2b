"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2, ArrowLeft } from "lucide-react";
import { bulkCreateProductsAction } from "../actions";
import type { Dict } from "@/i18n";

interface Row {
  id: number;
  imageUrl: string;
  name: string;
  sku: string;
  price: string;
  moq: string;
  selected: boolean;
}

let uid = 0;

export function BulkProductForm({ t }: { t: Dict }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const selectedCount = rows.filter((r) => r.selected).length;
  const wp = t.wsProducts;

  async function handleFiles(files: FileList) {
    setUploading(true);
    setError(null);
    const newRows: Row[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) continue;
        const name = file.name.replace(/\.[^.]+$/, "").trim() || "New product";
        newRows.push({
          id: ++uid,
          imageUrl: data.url,
          name,
          sku: "",
          price: "",
          moq: "1",
          selected: true,
        });
      } catch {
        /* 跳过失败文件 */
      }
    }
    setRows((prev) => [...prev, ...newRows]);
    setUploading(false);
    if (newRows.length === 0) setError(t.messages.errEmpty);
  }

  function update(id: number, field: keyof Row, value: string | boolean) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  function toggleAll() {
    const v = !allSelected;
    setRows((prev) => prev.map((r) => ({ ...r, selected: v })));
  }

  function submit() {
    const selected = rows
      .filter((r) => r.selected)
      .map((r) => ({
        name: r.name,
        sku: r.sku,
        imageUrl: r.imageUrl,
        price: Number(r.price) || 0,
        moq: Number(r.moq) || 1,
      }));
    if (selected.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkCreateProductsAction(selected);
      if (!res.ok) setError(res.error ?? "failed");
      else {
        setRows([]);
        router.push("/wholesaler/products");
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <button
        type="button"
        onClick={() => router.push("/wholesaler/products")}
        className="text-meta mb-4 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.wsProducts.title}
      </button>

      <div className="card p-6">
        <h1 className="text-h2">{wp.bulkTitle}</h1>
        <p className="text-meta mt-1 text-sm">{wp.bulkHint}</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="btn btn-secondary mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {uploading ? wp.uploadingPhotos : wp.bulkUpload}
        </button>
        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      </div>

      {rows.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={toggleAll}
              className="btn btn-ghost px-3 py-1.5 text-xs"
            >
              {allSelected ? wp.deselectAll : wp.selectAll}（{selectedCount}/{rows.length}）
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((r) => !r.selected))}
                disabled={selectedCount === 0}
                className="btn btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--color-danger)] disabled:opacity-40"
              >
                <Trash2 className="size-3.5" /> {wp.deleteSelected}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || selectedCount === 0}
                className="btn btn-primary px-4 py-1.5 text-xs disabled:opacity-50"
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                {wp.createSelected}（{selectedCount}）
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="card flex flex-wrap items-center gap-3 p-3">
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={(e) => update(r.id, "selected", e.target.checked)}
                    className="size-4 accent-[var(--color-ink)]"
                  />
                  <span className="relative block size-14 overflow-hidden rounded-lg bg-[var(--color-bg-muted)]">
                    <Image
                      src={r.imageUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                </label>

                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                  <input
                    value={r.name}
                    onChange={(e) => update(r.id, "name", e.target.value)}
                    placeholder={t.productForm.name}
                    className="input col-span-2 px-2 py-1.5 text-sm sm:col-span-1"
                  />
                  <input
                    value={r.sku}
                    onChange={(e) => update(r.id, "sku", e.target.value)}
                    placeholder={t.productForm.sku}
                    className="input px-2 py-1.5 text-sm"
                  />
                  <input
                    value={r.price}
                    onChange={(e) => update(r.id, "price", e.target.value)}
                    inputMode="decimal"
                    placeholder={t.common.price}
                    className="input px-2 py-1.5 text-sm"
                  />
                  <input
                    value={r.moq}
                    onChange={(e) => update(r.id, "moq", e.target.value)}
                    inputMode="numeric"
                    placeholder={t.common.moq}
                    className="input px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
