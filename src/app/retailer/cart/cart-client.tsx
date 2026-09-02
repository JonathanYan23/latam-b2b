"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, ShoppingBag, Minus, Plus, Loader2 } from "lucide-react";
import { getCartProductsAction, placeOrderAction } from "../actions";
import type { CartProductInfo } from "../actions";
import { fmt } from "@/i18n/utils";
import type { Dict } from "@/i18n";

export const CART_KEY = "latam-cart";

export interface CartItem {
  productId: string;
  quantity: number;
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("latam-cart-change"));
}

export function CartClient({ t }: { t: Dict }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [info, setInfo] = useState<Record<string, CartProductInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const sync = () => {
      const items = readCart();
      setCart(items);
      if (items.length) {
        setLoading(true);
        getCartProductsAction(items.map((i) => i.productId))
          .then(({ products }) => {
            const map: Record<string, CartProductInfo> = {};
            for (const p of products) map[p.productId] = p;
            setInfo(map);
          })
          .finally(() => setLoading(false));
      } else {
        setInfo({});
        setLoading(false);
      }
    };
    sync();
    window.addEventListener("latam-cart-change", sync);
    return () => window.removeEventListener("latam-cart-change", sync);
  }, []);

  const updateQty = useCallback(
    (productId: string, delta: number) => {
      const next = cart
        .map((c) =>
          c.productId === productId
            ? { ...c, quantity: Math.max(1, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0);
      writeCart(next);
    },
    [cart],
  );

  const remove = (productId: string) => {
    writeCart(cart.filter((c) => c.productId !== productId));
  };

  const placeOrder = () => {
    setError(null);
    startTransition(async () => {
      const res = await placeOrderAction(cart);
      if (!res.ok) {
        setError(res.error ?? t.cart.errEmpty);
        return;
      }
      localStorage.removeItem(CART_KEY);
      router.push(`/retailer/orders/${res.orderId}`);
      router.refresh();
    });
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center px-6 py-16 text-[var(--color-ink-3)]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <ShoppingBag
          className="mb-4 size-8 text-[var(--color-ink-3)]"
          strokeWidth={1.5}
        />
        <p className="text-h3 text-base">{t.cart.emptyTitle}</p>
        <p className="text-meta mt-1.5 max-w-sm">{t.cart.emptyDesc}</p>
        <Link href="/retailer/browse" className="btn btn-primary mt-6 px-5 py-2 text-sm">
          {t.retailerHome.browseCta}
        </Link>
      </div>
    );
  }

  const groups = new Map<string, CartItem[]>();
  for (const item of cart) {
    const wsId = info[item.productId]?.wholesalerId ?? "unknown";
    const list = groups.get(wsId) ?? [];
    list.push(item);
    groups.set(wsId, list);
  }

  const grandTotal = [...groups.entries()].reduce((sum, [, items]) => {
    const subtotal = items.reduce((s, i) => {
      const p = info[i.productId];
      return s + (p?.price ?? 0) * i.quantity;
    }, 0);
    return sum + subtotal;
  }, 0);

  const wholesalerNames = [...groups.keys()]
    .map((wsId) => info[groups.get(wsId)![0].productId]?.wholesalerName)
    .filter(Boolean);

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c] animate-fade-in">
          {error}
        </p>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([wsId, items]) => {
          const wsName = info[items[0].productId]?.wholesalerName ?? t.common.supplier;
          const subtotal = items.reduce((s, i) => {
            const p = info[i.productId];
            return s + (p?.price ?? 0) * i.quantity;
          }, 0);
          return (
            <div key={wsId} className="card overflow-hidden">
              <div className="border-b border-[var(--color-line-2)] px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-sm font-medium">{wsName}</p>
                  {(() => {
                    const first = info[items[0].productId];
                    const min = first?.minOrderAmount;
                    if (!min) return null;
                    const sub = items.reduce(
                      (acc, i) => acc + (info[i.productId]?.price ?? 0) * i.quantity,
                      0,
                    );
                    return sub < min ? (
                      <span className="badge badge-warning text-[11px]">
                        {t.cart.minOrder} ${min.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-ink-3)]">
                        {t.cart.minOrder} ${min.toFixed(2)}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="divide-y divide-[var(--color-line-2)]">
                {items.map((item) => {
                  const p = info[item.productId];
                  if (!p) return null;
                  return (
                    <div
                      key={item.productId}
                      className="flex items-center gap-4 px-5 py-4"
                    >
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-muted)]">
                        {p.image && (
                          <Image
                            src={p.image}
                            alt={p.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/retailer/products/${p.productId}`}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <p className="text-meta text-xs">
                          SKU {p.sku} · {t.common.moq} {p.moq}
                        </p>
                        {!p.purchasable && (
                          <p className="mt-0.5 text-xs text-[var(--color-danger)]">
                            {t.product.notPurchasable}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(p.productId, -1)}
                          className="btn btn-secondary size-7 p-0"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(p.productId, 1)}
                          className="btn btn-secondary size-7 p-0"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-sm font-semibold">
                          ${((p.price ?? 0) * item.quantity).toFixed(2)}
                        </p>
                        <p className="text-meta text-xs">
                          @ ${(p.price ?? 0).toFixed(2)}
                          {p.priceType === "CUSTOMER" && (
                            <span className="ml-1 text-[var(--color-accent)]">
                              {t.browse.yourPrice}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => remove(p.productId)}
                        className="text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-danger)]"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-[var(--color-line-2)] px-5 py-3 text-right">
                <span className="text-meta text-sm">{t.common.subtotal} </span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 汇总 */}
      <div className="card sticky bottom-20 mt-6 flex items-center justify-between p-5 md:bottom-4">
        <div>
          <p className="text-meta text-xs">
            {fmt(t.orders.masterDesc, { n: wholesalerNames.length })}
          </p>
          <p className="mt-0.5 text-lg font-semibold">${grandTotal.toFixed(2)}</p>
        </div>
        <button
          onClick={placeOrder}
          disabled={pending}
          className="btn btn-primary px-6 py-2.5 text-sm"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? t.cart.placing : t.cart.placeOrder}
        </button>
      </div>
    </div>
  );
}
