"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  getCartSnapshotAction,
  adjustDraftItemAction,
  removeDraftItemAction,
  clearDraftAction,
} from "@/app/retailer/draft-actions";
import { money } from "@/lib/format";
import type { Dict } from "@/i18n";

/** 购物车变更广播事件：加购 / 抽屉内操作后派发，全局角标据此刷新 */
export const CART_EVENT = "latam-cart-sync";

interface CartGroup {
  id: string;
  wholesalerId: string;
  wholesalerName: string;
  contact?: string | null;
  subtotal: number;
  items: {
    id: string;
    productId: string;
    name: string;
    image?: string | null;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    moq: number;
    stock: number;
  }[];
}
interface CartSnap {
  orderId: string;
  groups: CartGroup[];
  total: number;
  count: number;
}

export function CartButton({
  initialCount,
  t,
  currency = "USD",
}: {
  initialCount: number;
  t: Dict;
  currency?: string;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<CartSnap | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const s = (await getCartSnapshotAction()) as CartSnap | null;
    setSnap(s);
    setCount(s ? s.count : 0);
    return s;
  }, []);

  // 顶栏角标：外部加购（CART_EVENT）后主动拉取最新
  useEffect(() => {
    const h = () => {
      refresh();
    };
    window.addEventListener(CART_EVENT, h);
    return () => window.removeEventListener(CART_EVENT, h);
  }, [refresh]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  const openDrawer = () => {
    setOpen(true);
    setLoading(true);
    startTransition(async () => {
      await refresh();
      setLoading(false);
    });
  };

  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setBusy(true);
      try {
        await fn();
        await refresh();
        window.dispatchEvent(new Event(CART_EVENT));
      } finally {
        setBusy(false);
      }
    });

  const goCheckout = () => {
    setOpen(false);
    router.push("/retailer/orders/draft");
    router.refresh();
  };

  const clear = () => {
    if (!snap) return;
    if (!window.confirm(t.cart.clearConfirm)) return;
    act(() => clearDraftAction(snap.orderId));
  };

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const badge =
    count > 0 ? (
      <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-[var(--color-danger)] px-1 py-px text-[10px] font-semibold leading-tight text-white">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-label={t.cart.cartTitle}
        title={t.cart.cartTitle}
        className="relative flex size-8 items-center justify-center rounded-md text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
      >
        <ShoppingBag className="size-4" strokeWidth={1.9} />
        {badge}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-fade-up flex-col bg-[var(--color-bg)] shadow-2xl">
            {/* 头 */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line-2)] px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-[var(--color-ink-2)]" />
                <h2 className="text-[15px] font-semibold">{t.cart.cartTitle}</h2>
                {count > 0 && (
                  <span className="badge badge-neutral">{count}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button
                    type="button"
                    onClick={clear}
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-xs text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                  >
                    {t.cart.clearCart}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-md p-1.5 text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading && snap === null ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-[var(--color-ink-3)]" />
                </div>
              ) : !snap || snap.groups.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-16 text-center">
                  <ShoppingBag
                    className="size-8 text-[var(--color-ink-3)]"
                    strokeWidth={1.5}
                  />
                  <p className="mt-4 text-[15px] font-medium">
                    {t.cart.emptyTitle}
                  </p>
                  <p className="text-meta mt-1 max-w-xs text-sm">
                    {t.cart.emptyDesc}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push("/retailer/browse");
                    }}
                    className="btn btn-primary mt-5 px-4 py-2 text-sm"
                  >
                    {t.retailerHome.browseCta}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {snap.groups.map((g) => (
                    <div
                      key={g.id}
                      className="overflow-hidden rounded-xl border border-[var(--color-line-2)]"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line-2)] bg-[var(--color-bg-muted)]/60 px-3.5 py-2">
                        <Link
                          href={`/retailer/suppliers/${g.wholesalerId}`}
                          onClick={() => setOpen(false)}
                          className="truncate text-xs font-semibold hover:underline"
                        >
                          {g.wholesalerName}
                        </Link>
                        <span className="shrink-0 text-xs font-medium tabular-nums">
                          {money(g.subtotal, currency)}
                        </span>
                      </div>
                      <div className="divide-y divide-[var(--color-line-2)]">
                        {g.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2.5 px-3.5 py-2.5"
                          >
                            <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-[var(--color-bg-muted)]">
                              {item.image && (
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  sizes="36px"
                                  className="object-cover"
                                  unoptimized
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/retailer/products/${item.productId}`}
                                onClick={() => setOpen(false)}
                                className="block truncate text-[13px] font-medium hover:underline"
                              >
                                {item.name}
                              </Link>
                              <p className="text-meta text-[11px] tabular-nums">
                                {money(item.unitPrice, currency)} × {item.quantity}
                              </p>
                            </div>

                            {/* 数量步进 */}
                            <div className="flex shrink-0 flex-col overflow-hidden rounded-md border border-[var(--color-line)]">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  act(() =>
                                    adjustDraftItemAction(
                                      snap.orderId,
                                      item.productId,
                                      1,
                                    ),
                                  )
                                }
                                className="flex w-7 items-center justify-center py-0.5 text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                              >
                                <Plus className="size-3" />
                              </button>
                              <span className="w-full border-y border-[var(--color-line-2)] py-0.5 text-center text-[11px] font-medium tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  act(() =>
                                    adjustDraftItemAction(
                                      snap.orderId,
                                      item.productId,
                                      -1,
                                    ),
                                  )
                                }
                                className="flex w-7 items-center justify-center py-0.5 text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                              >
                                <Minus className="size-3" />
                              </button>
                            </div>

                            <p className="amount w-16 shrink-0 text-right text-[13px]">
                              {money(item.subtotal, currency)}
                            </p>
                            <button
                              type="button"
                              disabled={busy}
                              aria-label="Remove"
                              onClick={() =>
                                act(() =>
                                  removeDraftItemAction(
                                    snap.orderId,
                                    item.productId,
                                  ),
                                )
                              }
                              className="shrink-0 rounded p-1 text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-danger)]"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底栏 */}
            {snap && snap.groups.length > 0 && (
              <div className="border-t border-[var(--color-line-2)] px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-meta text-sm">{t.cart.cartTotal}</span>
                  <p className="amount text-lg">{money(snap.total, currency)}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn btn-secondary flex-1 px-3 py-2.5 text-sm"
                  >
                    {t.cart.continueShopping}
                  </button>
                  <button
                    type="button"
                    onClick={goCheckout}
                    className="btn btn-primary flex-1 px-3 py-2.5 text-sm"
                  >
                    {t.cart.goCheckout} <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
