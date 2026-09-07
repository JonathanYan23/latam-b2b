"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2, Check, ArrowRight, X } from "lucide-react";
import { addToDraftAction } from "../../draft-actions";
import { CART_EVENT } from "@/components/cart/cart-shell";
import type { Dict } from "@/i18n";

/** 详情页加购：加入草稿单但不跳转，停留当前页继续选购 */
export function AddToOrderButton({
  productId,
  moq,
  stock,
  t,
}: {
  productId: string;
  moq: number;
  stock: number;
  t: Dict;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(moq);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = () => {
    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 4000);
  };

  const add = () => {
    if (pending) return;
    startTransition(async () => {
      const res = await addToDraftAction(productId, qty);
      if (!res.ok) {
        alert(res.error ?? t.cart.errEmpty);
        return;
      }
      // 停留当前页：角标 +1 + 浮动反馈，绝不强制跳转
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
      showToast();
      window.dispatchEvent(new Event(CART_EVENT));
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 flex-col overflow-hidden rounded-md border border-[var(--color-line)]">
          <button
            type="button"
            onClick={() => setQty((q) => q + moq)}
            className="flex items-center justify-center px-2.5 py-0.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          >
            +
          </button>
          <span className="min-w-[46px] border-y border-[var(--color-line-2)] py-0 text-center text-sm font-medium tabular-nums">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(moq, q - moq))}
            className="flex items-center justify-center px-2.5 py-0.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          >
            −
          </button>
        </div>
        <button
          onClick={add}
          disabled={pending || stock <= 0}
          className={`btn shrink-0 px-5 py-2 text-sm ${
            added ? "bg-[var(--color-success)] text-white" : "btn-primary"
          }`}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : added ? (
            <>
              <Check className="size-4" /> {t.product.added}
            </>
          ) : (
            <>
              <ShoppingBag className="size-4" /> {t.product.addToOrder}
            </>
          )}
        </button>
      </div>

      {/* 加购成功浮动反馈：查看购物车 / 停留继续选购 */}
      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-[80] flex justify-center px-4 md:bottom-8">
          <div className="flex w-full max-w-md animate-fade-up items-center gap-3 rounded-xl border border-[var(--color-line-2)] bg-white px-4 py-3 shadow-xl">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
              <Check className="size-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {t.cart.addedToast}
            </p>
            <button
              type="button"
              onClick={() => {
                setToast(false);
                router.push("/retailer/orders/draft");
                router.refresh();
              }}
              className="btn btn-primary shrink-0 px-3 py-1.5 text-xs"
            >
              {t.cart.viewCart} <ArrowRight className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setToast(false)}
              aria-label="Close"
              className="shrink-0 rounded p-1 text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ink)]"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
