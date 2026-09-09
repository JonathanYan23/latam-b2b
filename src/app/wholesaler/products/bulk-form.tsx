"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  Loader2,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  File,
  Eye,
  Sparkles,
  X,
} from "lucide-react";
import { bulkCreateProductsAction } from "../actions";
import { isLikelyDuplicate } from "@/lib/normalize";
import { fmt } from "@/i18n/utils";
import type { Dict } from "@/i18n";

type FileKind = "image" | "pdf" | "excel" | "file";

interface FileItem {
  id: number;
  name: string;
  url: string;
  size: number;
  kind: FileKind;
}

interface Row {
  id: number;
  url: string;
  kind: FileKind;
  name: string;
  sku: string;
  price: string;
  moq: string;
  boxSize: string;
  categoryId?: string;
  selected: boolean;
  ai?: "loading" | "done" | "fail";
}

let uid = 0;

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,.pdf,.xls,.xlsx,.csv,.txt,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain";

function kindOf(file: File): FileKind {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext) || file.type.startsWith("image/"))
    return "image";
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  return "file";
}

function fmtBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

/** 按商品名自动建议分类（词重叠匹配） */
function suggestCategory(name: string, cats: { id: string; name: string }[]): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ一-鿿 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (words.length === 0) return "";
  for (const c of cats) {
    const cn = c.name.toLowerCase();
    if (words.some((w) => cn.includes(w)) || cn.split(/\s+/).some((cw) => words.includes(cw)))
      return c.id;
  }
  return "";
}

/** 打开全局图片预览（模块：全站图片放大预览） */
function zoomUrl(url: string) {
  window.dispatchEvent(
    new CustomEvent("latam:zoom", { detail: { urls: [url], index: 0 } }),
  );
}

type Phase = "upload" | "busy" | "review";

export function BulkProductForm({
  t,
  existing = [],
  categories = [],
}: {
  t: Dict;
  existing?: { name: string; barcode: string | null }[];
  categories?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recognizing, setRecognizing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const wp = t.wsProducts;
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const selectedCount = rows.filter((r) => r.selected).length;

  /** 第 1 步：选择/追加文件 → 仅暂存（不识别） */
  async function handlePick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    setError(null);
    const added: FileItem[] = [];
    for (const file of Array.from(list)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data?.url) continue;
        added.push({
          id: ++uid,
          name: file.name,
          url: data.url,
          size: file.size,
          kind: kindOf(file),
        });
      } catch {
        /* 跳过失败文件 */
      }
    }
    if (added.length === 0) setError(t.messages.errEmpty);
    else setFiles((prev) => [...prev, ...added]);
    setUploading(false);
  }

  /** 第 2 步：一键统一识别（逐个串行，带进度） */
  async function startRecognize() {
    if (files.length === 0) return;
    setPhase("busy");
    setError(null);
    const made: Row[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setRecognizing(i + 1);
      let name = f.name.replace(/\.[^.]+$/, "").trim() || "New product";
      let sku = "";
      let price = "";
      let moq = "1";
      let boxSize = "";
      let ai: Row["ai"] = "done";
      try {
        const res = await fetch("/api/ai/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: f.url,
            kind: f.kind === "image" ? "image" : f.kind,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          disabled?: boolean;
          fields?: {
            name?: string;
            sku?: string;
            publicPrice?: number;
            moq?: number;
            boxSize?: string;
          };
        };
        if (!res.ok || !data?.ok || data.disabled) {
          ai = "fail";
        } else {
          const fld = data.fields ?? {};
          if (typeof fld.name === "string" && fld.name.trim().length >= 2)
            name = fld.name.trim();
          if (typeof fld.sku === "string" && fld.sku.trim()) sku = fld.sku.trim();
          if (typeof fld.publicPrice === "number" && fld.publicPrice >= 0)
            price = String(fld.publicPrice);
          if (typeof fld.moq === "number" && fld.moq >= 1) moq = String(fld.moq);
          if (typeof fld.boxSize === "string" && fld.boxSize.trim())
            boxSize = fld.boxSize.trim();
        }
      } catch {
        ai = "fail";
      }
      made.push({
        id: ++uid,
        url: f.url,
        kind: f.kind,
        name,
        sku,
        price,
        moq,
        boxSize,
        categoryId: suggestCategory(name, categories) || undefined,
        selected: true,
        ai,
      });
    }
    setRows(made);
    setRecognizing(null);
    setPhase("review");
  }

  function update(id: number, field: keyof Row, value: string | boolean | undefined) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function toggleAll() {
    const v = !allSelected;
    setRows((prev) => prev.map((r) => ({ ...r, selected: v })));
  }

  /** 商家内部查重（仅库内+本页草稿；只提示不自动删） */
  function dupNameOf(r: Row): string | null {
    const name = r.name.trim();
    if (name.length < 2) return null;
    for (const e of existing) {
      if (e.barcode && e.barcode === r.sku) return e.name;
      if (isLikelyDuplicate(name, null, { name: e.name })) return e.name;
    }
    for (const o of rows) {
      if (o.id === r.id || !o.name.trim()) continue;
      if (isLikelyDuplicate(name, null, { name: o.name })) return o.name;
    }
    return null;
  }

  /** 第 3 步：确认批量上架 */
  function submit() {
    const selected = rows
      .filter((r) => r.selected)
      .map((r) => ({
        name: r.name,
        sku: r.sku,
        imageUrl: r.url,
        price: Number(r.price) || 0,
        moq: Number(r.moq) || 1,
        boxSize: r.boxSize || null,
        categoryId: r.categoryId ?? null,
      }));
    if (selected.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkCreateProductsAction(selected);
      if (!res.ok) setError(res.error ?? "failed");
      else {
        setRows([]);
        setFiles([]);
        router.push("/wholesaler/products");
        router.refresh();
      }
    });
  }

  function FileThumb({ item, big = false }: { item: FileItem; big?: boolean }) {
    if (item.kind === "image") {
      return (
        <span className={`relative block overflow-hidden rounded-lg bg-[var(--color-bg-muted)] ${big ? "size-20" : "size-14"}`}>
          <Image src={item.url} alt="" fill sizes={big ? "80px" : "56px"} className="object-cover" unoptimized />
        </span>
      );
    }
    const Icon = item.kind === "pdf" ? FileText : item.kind === "excel" ? FileSpreadsheet : File;
    return (
      <span
        className={`grid place-items-center rounded-lg bg-[var(--color-bg-muted)] text-[var(--color-ink-3)] ${big ? "size-20" : "size-14"}`}
      >
        <Icon className={big ? "size-8" : "size-6"} strokeWidth={1.6} />
      </span>
    );
  }

  function kindLabel(k: FileKind): string {
    return k === "image" ? wp.fileImage : k === "pdf" ? wp.filePdf : k === "excel" ? wp.fileExcel : k.toUpperCase();
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

      {/* ============ 阶段 1：上传暂存 ============ */}
      {phase === "upload" && (
        <div className="card p-6">
          <h1 className="text-h2">{wp.bulkTitle}</h1>
          <p className="text-meta mt-1 text-sm">{wp.uploadHintNew}</p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              void handlePick(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="btn btn-secondary mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            {uploading ? wp.uploadingPhotos : files.length === 0 ? wp.chooseFiles : wp.addMore}
          </button>
          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
        </div>
      )}

      {/* 文件待处理列表（上传阶段 + busy 阶段共享展示） */}
      {(phase === "upload" || phase === "busy") && files.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">{fmt(wp.fileCount, { n: files.length })}</p>
            {phase === "upload" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFiles([]);
                    setError(null);
                  }}
                  className="btn btn-ghost px-3 py-1.5 text-xs text-[var(--color-ink-2)]"
                >
                  <Trash2 className="size-3.5" /> {wp.clearFiles}
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="btn btn-ghost inline-flex items-center gap-1 border border-[var(--color-line-2)] px-3 py-1.5 text-xs"
                >
                  <ImagePlus className="size-3.5" /> {wp.addMore}
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="card flex items-center gap-3 p-2.5"
              >
                <button type="button" onClick={() => (f.kind === "image" ? zoomUrl(f.url) : window.open(f.url, "_blank"))} className="shrink-0" aria-label={wp.preview}>
                  <FileThumb item={f} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{f.name}</p>
                  <p className="text-meta mt-0.5 text-[11px]">
                    <span className="badge badge-info mr-1.5">{kindLabel(f.kind)}</span>
                    {fmtBytes(f.size)}
                  </p>
                </div>
                {phase === "upload" && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => (f.kind === "image" ? zoomUrl(f.url) : window.open(f.url, "_blank"))}
                      className="rounded-md p-1.5 text-[var(--color-ink-3)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                      aria-label={wp.preview}
                      title={wp.preview}
                    >
                      <Eye className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      className="rounded-md p-1.5 text-[var(--color-ink-3)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-danger)]"
                      aria-label={wp.deleteSelected}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {phase === "upload" && (
            <button
              type="button"
              onClick={startRecognize}
              disabled={files.length === 0}
              className="btn btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-[15px] disabled:opacity-50"
            >
              <Sparkles className="size-4.5" /> {wp.startRecognize}（{files.length}）
            </button>
          )}
        </div>
      )}

      {/* ============ 阶段 2：识别中 ============ */}
      {phase === "busy" && (
        <div className="card mt-6 flex flex-col items-center px-6 py-12 text-center">
          <Loader2 className="mb-3 size-7 animate-spin text-[var(--color-accent)]" />
          <p className="text-[15px] font-medium">
            {recognizing !== null
              ? fmt(wp.recognizingNow, { i: recognizing, n: files.length })
              : wp.aiDetecting}
          </p>
          <p className="text-meta mt-1 max-w-sm text-sm">
            {recognizing !== null && files[recognizing - 1]
              ? files[recognizing - 1].name
              : ""}
          </p>
        </div>
      )}

      {/* ============ 阶段 3：识别结果（编辑/勾选/上架） ============ */}
      {phase === "review" && rows.length > 0 && (
        <div className="mt-6">
          <div className="card mb-4 flex items-center justify-between gap-2 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-[var(--color-success)]" />
              <p className="text-sm font-medium">{wp.recognizeAll}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRows([]);
                setPhase("upload");
              }}
              className="btn btn-ghost px-3 py-1.5 text-xs text-[var(--color-ink-2)]"
            >
              {wp.backToFiles}
            </button>
          </div>

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
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((r) => {
              const dupName = dupNameOf(r);
              return (
                <div
                  key={r.id}
                  className={`card flex flex-wrap items-center gap-3 p-3 ${
                    dupName && r.selected ? "!border-[var(--color-warning)]" : ""
                  } ${r.selected ? "" : "opacity-60"}`}
                >
                  {categories.length > 0 && (
                    <div className="flex w-full flex-wrap items-center gap-2">
                      <span className="text-[11px] text-[var(--color-ink-3)]">
                        {t.productForm.category}
                      </span>
                      <select
                        value={r.categoryId ?? ""}
                        onChange={(e) => update(r.id, "categoryId", e.target.value || undefined)}
                        className="input h-7 w-full max-w-60 px-2 py-0 text-xs"
                      >
                        <option value="">{t.productForm.uncategorized}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {dupName && (
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md bg-[#fef3c7] px-3 py-2 text-xs text-[#92400e]">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span aria-hidden>⚠</span>
                        <span className="truncate">{fmt(t.wsProducts.dupWarn, { name: dupName })}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => update(r.id, "selected", false)}
                        className="rounded-md border border-[#d97706] px-2 py-1 font-medium text-[#92400e] transition-colors hover:bg-[#92400e] hover:text-white"
                      >
                        {t.wsProducts.skipDup}
                      </button>
                    </div>
                  )}
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={(e) => update(r.id, "selected", e.target.checked)}
                      className="size-4 accent-[var(--color-ink)]"
                    />
                    {r.kind === "image" ? (
                      <button
                        type="button"
                        onClick={() => zoomUrl(r.url)}
                        className="relative block size-14 overflow-hidden rounded-lg bg-[var(--color-bg-muted)]"
                        aria-label={wp.preview}
                      >
                        <Image src={r.url} alt="" fill sizes="56px" className="object-cover" unoptimized />
                      </button>
                    ) : (
                      <span className="grid size-14 place-items-center rounded-lg bg-[var(--color-bg-muted)] text-[var(--color-ink-3)]">
                        {r.kind === "pdf" ? (
                          <FileText className="size-6" strokeWidth={1.6} />
                        ) : r.kind === "excel" ? (
                          <FileSpreadsheet className="size-6" strokeWidth={1.6} />
                        ) : (
                          <File className="size-6" strokeWidth={1.6} />
                        )}
                      </span>
                    )}
                  </label>
                  {r.ai === "fail" && (
                    <span className="badge badge-warning shrink-0">{t.wsProducts.aiFailed}</span>
                  )}
                  {dupName && !r.selected && (
                    <span className="badge badge-warning shrink-0">{t.wsProducts.dupSkipped}</span>
                  )}

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
                    <input
                      value={r.boxSize ?? ""}
                      onChange={(e) => update(r.id, "boxSize", e.target.value)}
                      placeholder={t.productForm.boxSize + " (" + t.productForm.boxSizeHint + ")"}
                      className="input col-span-2 px-2 py-1.5 text-sm sm:col-span-4"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={pending || selectedCount === 0}
            className="btn btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-[15px] disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {wp.createSelected}（{selectedCount}）
          </button>
        </div>
      )}
    </div>
  );
}
