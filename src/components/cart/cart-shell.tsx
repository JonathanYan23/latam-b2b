"use client";

/**
 * Shopping Cart — 右侧滑出 Cart Drawer（重新设计的交互与 UI）
 *
 * Desktop: 右上角 icon + 数量入口 → 右侧滑出 Drawer(≈420px)
 *  - 背景仅轻微变暗（可感知页面仍存在），Drawer 不遮挡全部内容
 *  - Header（标题 + 件数 + 关闭）/ 商品列表（仅此区滚动）/ Footer（小计 + Checkout）三段清晰
 * Mobile: Drawer 占满宽度（近似全屏购物车），Header / 列表 / Checkout 依然分明
 *
 * 数量调整使用 QtyWheel 滚轮选择器；改数量即时乐观更新行小计 / 组小计 / 总额 / 角标，
 * 300ms 后静默同步服务端（无需刷新页面）。
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ShoppingBag, X, Trash2, Loader2, ChevronRight } from "lucide-react";
import {
  getCartSnapshotAction,
  setDraftItemQuantityAction,
  removeDraftItemAction,
  clearDraftAction,
} from "@/app/retailer/draft-actions";
import { QtyWheel } from "@/components/qty-wheel";
import { money } from "@/lib/format";
import { fmt } from "@/i18n/utils";
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

const round2 = (n: number) => Math.round(n * 100) / 100;

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

  const orderIdRef = useRef<string | null>(null);
  const syncTimers = useRef<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    try {
      const s = (await getCartSnapshotAction()) as CartSnap | null;
      setSnap(s);
      setCount(s ? s.count : 0);
      if (s) orderIdRef.current = s.orderId;
      return s;
    } catch {
      return null;
    }
  }, []);

  // 角标同步：仅抽屉未打开时回拉服务端（外部加购等）；打开期间本地乐观态为主导，
  // 避免删除/调量后被陈旧回执“回填复活”
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    const h = () => {
      if (!openRef.current) refresh();
    };
    window.addEventListener(CART_EVENT, h);
    return () => window.removeEventListener(CART_EVENT, h);
  }, [refresh]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // 抽屉打开期间锁定背景滚动（避免 Drawer 打开后页面仍可滚动的割裂感）
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openDrawer = () => {
    setOpen(true);
    setLoading(true);
    startTransition(async () => {
      await refresh();
      setLoading(false);
    });
  };

  /** 纯函数：按目标数量重算快照（行小计 → 组小计 → 总额 → 件数） */
  const applyQtyTo = (prev: CartSnap | null, pid: string, q: number): CartSnap | null => {
    if (!prev) return prev;
    const groups = prev.groups.map((g) => {
      const items = g.items.map((it) =>
        it.productId === pid
          ? { ...it, quantity: q, subtotal: round2(it.unitPrice * q) }
          : it,
      );
      return {
        ...g,
        items,
        subtotal: round2(items.reduce((s, it) => s + it.subtotal, 0)),
      };
    });
    return {
      ...prev,
      groups,
      total: round2(groups.reduce((s, g) => s + g.subtotal, 0)),
      count: groups.reduce(
        (s, g) => s + g.items.reduce((x, it) => x + it.quantity, 0),
        0,
      ),
    };
  };

  const applyQty = (pid: string, q: number) => {
    setSnap((prev) => applyQtyTo(prev, pid, q));
  };

  // 顶栏角标与 Header 件数由快照派生（乐观更新即时一致，不依赖服务端回写）
  useEffect(() => {
    setCount(snap ? snap.count : 0);
  }, [snap]);

  /** 静默落库（每商品 300ms 合并）。UI 完全由本地乐观驱动——服务端永不回写覆盖，保证零回跳零闪烁 */
  const queueSync = (pid: string, q: number) => {
    const t0 = syncTimers.current.get(pid);
    if (t0) window.clearTimeout(t0);
    syncTimers.current.set(
      pid,
      window.setTimeout(() => {
        syncTimers.current.delete(pid);
        void (async () => {
          const oid = orderIdRef.current;
          if (!oid) return;
          try {
            await setDraftItemQuantityAction(oid, pid, q);
          } catch {
            /* 静默失败：忽略 */
          }
          window.dispatchEvent(new Event(CART_EVENT));
        })();
      }, 300),
    );
  };

  const setItemQty = (pid: string, q: number) => {
    applyQty(pid, q);
    queueSync(pid, q);
  };

  /** 乐观删除：立即从本地移除该商品（空组随之消失），后台同步 */
  const removeItem = (pid: string) => {
    if (!window.confirm(t.cart.removeConfirm)) return;
    setSnap((prev) => {
      if (!prev) return prev;
      const groups = prev.groups
        .map((g) => {
          const items = g.items.filter((it) => it.productId !== pid);
          return { ...g, items, subtotal: round2(items.reduce((s, it) => s + it.subtotal, 0)) };
        })
        .filter((g) => g.items.length > 0);
      const next: CartSnap = {
        ...prev,
        groups,
        total: round2(groups.reduce((s, g) => s + g.subtotal, 0)),
        count: groups.reduce((s, g) => s + g.items.reduce((x, it) => x + it.quantity, 0), 0),
      };
      return next;
    });
    startTransition(async () => {
      const oid = orderIdRef.current;
      if (!oid) return;
      try {
        await removeDraftItemAction(oid, pid);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event(CART_EVENT));
    });
  };

  const clear = () => {
    if (!snap) return;
    if (!window.confirm(t.cart.clearConfirm)) return;
    startTransition(async () => {
      setBusy(true);
      try {
        await clearDraftAction(snap.orderId);
        setSnap(null);
        setCount(0);
        window.dispatchEvent(new Event(CART_EVENT));
      } finally {
        setBusy(false);
      }
    });
  };

  const goCheckout = () => {
    setOpen(false);
    router.push("/retailer/orders/draft");
    router.refresh();
  };

  useEffect(() => {
    return () => {
      syncTimers.current.forEach((t0) => window.clearTimeout(t0));
    };
  }, []);

  const badge =
    count > 0 ? (
      <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-[var(--color-danger)] px-1 py-px text-[10px] font-semibold leading-tight text-white">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  const hasItems = !!snap && snap.groups.length > 0;

  return (
    <>
      {/* 右上角固定入口：icon + 当前商品数量 */}
      <button
        type="button"
        onClick={openDrawer}
        aria-label={t.cart.cartTitle}
        title={t.cart.cartTitle}
        className="relative flex size-8 items-center justify-center rounded-full text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
      >
        <ShoppingBag className="size-[17px]" strokeWidth={1.8} />
        {badge}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t.cart.cartTitle}>
          {/* 遮罩：非常轻微的变暗 —— 仍能感知后面的商品页面存在 */}
          <div
            className="cart-fade absolute inset-0 bg-[#0f172a]/20"
            onClick={() => setOpen(false)}
          />

          {/* Drawer：桌面右侧滑出（420px）；移动端全宽（近似全屏购物车） */}
          <aside className="cart-sheet flex flex-col bg-white text-[var(--color-ink)]">
            {/* Header */}
            <header className="flex items-start justify-between gap-3 px-6 pb-4 pt-5">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold tracking-tight">
                  {t.cart.cartTitle}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">
                  {hasItems ? fmt(t.cart.itemsCount, { n: snap!.count }) : " "}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {hasItems && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={clear}
                    className="rounded-md px-2 py-1.5 text-[11px] text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                  >
                    {t.cart.clearCart}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="grid size-7 place-items-center rounded-full text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            {/* 商品列表（仅此区域滚动） */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-[var(--color-line-2)] px-6 py-2">
              {loading && snap === null ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-[var(--color-ink-3)]" />
                </div>
              ) : !hasItems ? (
                <div className="flex flex-col items-center px-4 py-20 text-center">
                  <div className="grid size-14 place-items-center rounded-full bg-[var(--color-bg-subtle)]">
                    <ShoppingBag
                      className="size-5 text-[var(--color-ink-3)]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className="mt-4 text-[15px] font-medium">{t.cart.emptyTitle}</p>
                  <p className="mt-1 max-w-[240px] text-[13px] leading-relaxed text-[var(--color-ink-3)]">
                    {t.cart.emptyDesc}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push("/retailer/browse");
                    }}
                    className="mt-6 h-10 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white transition-colors hover:bg-black active:scale-[0.98]"
                  >
                    {t.retailerHome.browseCta}
                  </button>
                </div>
              ) : (
                <div>
                  {snap!.groups.map((g) => (
                    <div
                      key={g.id}
                      className="border-b border-[var(--color-line-2)] last:border-0"
                    >
                      {/* 供应商分组头 */}
                      <div className="flex items-center gap-1 pb-1 pt-3">
                        <Link
                          href={`/retailer/suppliers/${g.wholesalerId}`}
                          onClick={() => setOpen(false)}
                          className="flex min-w-0 items-center gap-0.5 text-[12px] font-semibold text-[var(--color-ink)] hover:underline"
                        >
                          <span className="truncate">{g.wholesalerName}</span>
                          <ChevronRight className="size-3 shrink-0 text-[var(--color-ink-3)]" />
                        </Link>
                        <span className="ml-auto shrink-0 pl-3 text-[11px] text-[var(--color-ink-3)]">
                          {fmt(t.cart.itemsCount, {
                            n: g.items.reduce((s, it) => s + it.quantity, 0),
                          })}
                        </span>
                      </div>

                      {/* 商品行 */}
                      {g.items.map((item) => {
                        const stockCap = Math.max(1, item.stock > 0 ? item.stock : 999);
                        return (
                          <div
                            key={item.id}
                            className="flex gap-3.5 py-3.5"
                          >
                            <Link
                              href={`/retailer/products/${item.productId}`}
                              onClick={() => setOpen(false)}
                              className="relative block size-11 shrink-0 overflow-hidden rounded-[9px] bg-[var(--color-bg-muted)]"
                            >
                              {item.image && (
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                  unoptimized
                                />
                              )}
                            </Link>

                            <div className="flex min-w-0 flex-1 flex-col">
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  href={`/retailer/products/${item.productId}`}
                                  onClick={() => setOpen(false)}
                                  title={item.name}
                                  className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug hover:underline"
                                >
                                  {item.name}
                                </Link>
                                <button
                                  type="button"
                                  aria-label={t.common.remove}
                                  title={t.common.remove}
                                  onClick={() => removeItem(item.productId)}
                                  className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-1 text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-danger)]"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>

                              {/* 规格：单价 / 单位 · 起订量 · 库存 */}
                              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-ink-3)]">
                                {money(item.unitPrice, currency)} / {t.common.unit}
                                {item.moq > 1 ? (
                                  <span> · {t.common.moq} {item.moq}</span>
                                ) : null}
                                {item.stock > 0 && item.stock <= 99 ? (
                                  <span className="text-[var(--color-ink-2)]">
                                    {" "}
                                    · {t.cart.inStockCount.replace("{n}", String(item.stock))}
                                  </span>
                                ) : null}
                              </p>

                              <div className="mt-2 flex items-center justify-between gap-3">
                                {/* 滚轮式数量选择器（1..库存，拖/滚/键盘均吸附） */}
                                <div className="w-[68px] shrink-0">
                                  <QtyWheel
                                    value={item.quantity}
                                    min={1}
                                    max={stockCap}
                                    ariaLabel={item.name}
                                    onChange={(q) => setItemQty(item.productId, q)}
                                  />
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-[13px] font-semibold tabular-nums">
                                    {money(item.subtotal, currency)}
                                  </p>
                                  <p className="mt-0.5 text-[10px] tabular-nums text-[var(--color-ink-3)]">
                                    {money(item.unitPrice, currency)} × {item.quantity}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer：小计 → Checkout（唯一主操作，始终可见） */}
            {hasItems && (
              <footer className="shrink-0 border-t border-[var(--color-line-2)] px-6 pb-[max(env(safe-area-inset-bottom),14px)] pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[var(--color-ink-2)]">
                    {t.cart.subtotal}
                  </span>
                  <p className="text-[17px] font-semibold tabular-nums tracking-tight">
                    {money(snap!.total, currency)}
                  </p>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-ink-3)]">
                  {t.cart.checkoutNote}
                </p>
                <button
                  type="button"
                  onClick={goCheckout}
                  disabled={busy || pending}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#1d1d1f] text-sm font-medium text-white transition-all hover:bg-black active:scale-[0.99] disabled:opacity-50"
                >
                  {busy || pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {t.cart.goCheckout}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-2.5 w-full text-center text-xs text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ink)]"
                >
                  {t.cart.continueShopping}
                </button>
              </footer>
              )}
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
