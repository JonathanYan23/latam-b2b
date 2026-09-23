"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2, Check } from "lucide-react";
import { addToDraftAction } from "../../draft-actions";
import { CART_EVENT, CART_OPEN_EVENT } from "@/components/cart/cart-shell";
import { useToast } from "@/components/ui/toast";
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
  const toast = useToast();
  const [qty, setQty] = useState(moq);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  const add = () => {
    if (pending) return;
    startTransition(async () => {
      const res = await addToDraftAction(productId, qty);
      if (!res.ok) {
        toast.error(res.error || t.ui.networkError);
        return;
      }
      // 停留当前页：按钮 +1 反馈 + 全局 Toast（可一键查看购物车），绝不强制跳转
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
      toast.success(t.cart.addedToast, {
        action: {
          label: t.cart.viewCart,
          onClick: () => window.dispatchEvent(new Event(CART_OPEN_EVENT)),
        },
      });
      window.dispatchEvent(new Event(CART_EVENT));
      router.refresh();
    });
  };

  return (
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
  );
}
