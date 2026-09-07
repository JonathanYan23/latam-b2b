"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Loader2, Trash2, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import {
  updateStockAction,
  importProductsAction,
  deleteProductAction,
  bulkProductsAction,
} from "../actions";
import type { Dict } from "@/i18n";

/** 列表页内联库存更新（0 库存不显示数字，留空待填） */
export function StockUpdater({
  productId,
  initial,
  t,
}: {
  productId: string;
  initial: number;
  t: Dict;
}) {
  // 缺货(0)时输入框置空，由批发商自行填量
  const [value, setValue] = useState<string>(initial > 0 ? String(initial) : "");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const parsed = value === "" ? NaN : Number(value);
  const changed = !Number.isNaN(parsed) && parsed !== initial;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setErr(null);
        }}
        placeholder={initial > 0 ? String(initial) : "0"}
        className="input w-20 px-2 py-1 text-center text-sm"
      />
      <button
        disabled={pending || !changed}
        onClick={() =>
          startTransition(async () => {
            setErr(null);
            const res = await updateStockAction(productId, parsed);
            if (!res.ok) setErr(res.error ?? "error");
            else {
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
              router.refresh();
            }
          })
        }
        className="btn btn-secondary px-2.5 py-1 text-xs"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : t.common.update}
      </button>
      {saved && <CheckCircle2 className="size-4 text-[var(--color-success)]" />}
      {err && (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-danger)]">
          <AlertCircle className="size-3.5" /> {err}
        </span>
      )}
    </div>
  );
}

/** CSV 批量导入（居中弹窗） */
export function ImportCsvButton({ t }: { t: Dict }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 打开时禁止背景滚动（可选体验增强）
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-secondary px-4 py-2 text-sm"
      >
        <Upload className="size-4" />
        {t.wsProducts.importCsv}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              className="card relative w-full max-w-md p-6 shadow-[var(--shadow-pop)]"
              style={{ maxHeight: "calc(100vh - 2rem)", overflowY: "auto" }}
            >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">{t.wsProducts.csvTitle}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-meta mt-2 text-xs leading-relaxed">
              {t.wsProducts.csvHint}
            </p>
            {error && (
              <p className="mt-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-2 py-1.5 text-xs text-[#b91c1c]">
                {error}
              </p>
            )}
            {done && (
              <p className="mt-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1.5 text-xs text-[#15803d]">
                {t.wsProducts.csvDone}
              </p>
            )}
            <form
              action={async (fd) => {
                setError(null);
                setDone(false);
                startTransition(async () => {
                  const res = await importProductsAction(undefined, fd);
                  if (res?.error) setError(res.error);
                  else {
                    setDone(true);
                    setTimeout(() => setOpen(false), 900);
                  }
                });
              }}
              className="mt-4 space-y-3"
            >
              <input
                name="file"
                type="file"
                accept=".csv"
                required
                className="input py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary w-full py-2 text-sm"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {t.wsProducts.csvUpload}
              </button>
            </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** 列表页商品删除按钮：确认后删除；被引用商品自动停用隐藏 */
export function DeleteProductButton({
  productId,
  productName,
  t,
}: {
  productId: string;
  productName: string;
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`${t.wsProducts.deleteConfirm}\n\n「${productName}」`)) return;
        startTransition(async () => {
          const res = await deleteProductAction(productId);
          if (!res.ok) window.alert(res.error);
        });
      }}
      className="btn btn-ghost inline-flex items-center gap-1 border border-[var(--color-line-2)] px-2.5 py-1.5 text-xs text-[var(--color-danger)] hover:border-[var(--color-danger)]/40 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      {t.wsProducts.deleteProduct}
    </button>
  );
}

/** 批量商品管理工具条：收集 .bulk-ck 勾选项执行 上下架/设价/删除 */
export function BulkBar({ t }: { t: Dict }) {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    setCount(
      document.querySelectorAll<HTMLInputElement>("input.bulk-ck:checked").length,
    );

  useEffect(() => {
    refresh();
    document.addEventListener("change", refresh);
    return () => document.removeEventListener("change", refresh);
  }, []);

  const collect = () =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>("input.bulk-ck:checked"),
    ).map((i) => i.value);

  const run = async (op: "delete" | "activate" | "deactivate" | "price") => {
    const ids = collect();
    if (ids.length === 0) return;
    let value: number | undefined;
    if (op === "price") {
      const raw = window.prompt(t.wsProducts.bulkPricePrompt);
      if (raw === null) return;
      value = Number(raw);
      if (Number.isNaN(value) || value < 0) return;
    }
    if (op === "delete") {
      if (!window.confirm(t.wsProducts.bulkDeleteConfirm)) return;
    }
    setBusy(true);
    const res = await bulkProductsAction(ids, op, value);
    setBusy(false);
    if (!res.ok) {
      alert(res.error ?? "error");
      return;
    }
    window.location.reload();
  };

  const btn =
    "inline-flex items-center gap-1 rounded-md border border-[var(--color-line-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink-3)] hover:text-[var(--color-ink)] disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-meta text-xs">
        {count > 0 ? `${count} ${t.common.selected}` : t.wsProducts.bulkSelectHint}
      </span>
      <button type="button" disabled={busy || count === 0} onClick={() => run("activate")} className={btn}>
        {t.wsProducts.activate}
      </button>
      <button type="button" disabled={busy || count === 0} onClick={() => run("deactivate")} className={btn}>
        {t.wsProducts.deactivate}
      </button>
      <button type="button" disabled={busy || count === 0} onClick={() => run("price")} className={btn}>
        {t.wsProducts.bulkSetPrice}
      </button>
      <button
        type="button"
        disabled={busy || count === 0}
        onClick={() => run("delete")}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-danger)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)] hover:text-white disabled:pointer-events-none disabled:opacity-40"
      >
        {t.wsProducts.bulkDelete}
      </button>
    </div>
  );
}
