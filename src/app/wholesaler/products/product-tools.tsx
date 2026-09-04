"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2, Trash2, Upload, X } from "lucide-react";
import { updateStockAction, importProductsAction, deleteProductAction } from "../actions";
import type { Dict } from "@/i18n";

/** 列表页内联库存更新 */
export function StockUpdater({
  productId,
  initial,
  t,
}: {
  productId: string;
  initial: number;
  t: Dict;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="input w-20 px-2 py-1 text-center text-sm"
      />
      <button
        disabled={pending || value === initial}
        onClick={() =>
          startTransition(async () => {
            await updateStockAction(productId, value);
          })
        }
        className="btn btn-secondary px-2.5 py-1 text-xs"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : t.common.update}
      </button>
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
