"use client";

/**
 * Shopping Cart — 右侧滑出 Cart Drawer（重新设计的交互与 UI）
 *
 * Desktop: 右上角 icon + 数量入口 → 右侧滑出 Drawer(≈420px)
 *  - 背景仅轻微变暗（可感知页面仍存在），Drawer 不遮挡全部内容
 *  - Header（标题 + 件数 + 关闭）/ 商品列表（仅此区滚动）/ Footer（小计 + Checkout）三段清晰
 * Mobile: Drawer 占满宽度（近似全屏购物车），Header / 列表 / Checkout 依然分明
 *
 * 数量调整使用 QtyStepper 步进器（− / 直接输入 / +）；改数量即时乐观更新行小计 / 组小计 / 总额 / 角标，
 * 300ms 后静默同步服务端（无需刷新页面）。
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ShoppingBag, X, Trash2, Loader2, ChevronRight } from "lucide-react";
import {
  getCartSnapshotAction,
  removeDraftItemAction,
  clearDraftAction,
} from "@/app/retailer/draft-actions";
import { QtyStepper } from "@/components/qty-stepper";
import { ProductImage } from "@/components/product-image";
import {
  enqueueWrite,
  forgetQty,
  getCartOrderId,
  getLocalQty,
  isPending,
  publishCleared,
  publishQty,
  publishRemoved,
  reconcile,
  setCartOrderId,
  subscribeCartQty,
  type CartQtyEvent,
} from "@/components/cart/cart-store";
import { persistItemQty } from "@/components/cart/persist-qty";
import { useConfirm } from "@/components/ui/confirm";
import { money } from "@/lib/format";
import { fmt } from "@/i18n/utils";
import type { Dict } from "@/i18n";

/** 购物车变更广播事件：加购 / 抽屉内操作后派发，全局角标据此刷新 */
export const CART_EVENT = "latam-cart-sync";

/** 请求打开购物车抽屉（任意位置可触发，如加购 Toast 的「查看购物车」） */
export const CART_OPEN_EVENT = "latam-cart-open";

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

/** 纯函数：按目标数量重算快照（行小计 → 组小计 → 总额 → 件数） */
function applyQtyTo(prev: CartSnap | null, pid: string, q: number): CartSnap | null {
  if (!prev) return prev;
  const groups = prev.groups.map((g) => {
    const items = g.items.map((it) =>
      it.productId === pid ? { ...it, quantity: q, subtotal: round2(it.unitPrice * q) } : it,
    );
    return { ...g, items, subtotal: round2(items.reduce((s, it) => s + it.subtotal, 0)) };
  });
  return {
    ...prev,
    groups,
    total: round2(groups.reduce((s, g) => s + g.subtotal, 0)),
    count: groups.reduce((s, g) => s + g.items.reduce((x, it) => x + it.quantity, 0), 0),
  };
}

/**
 * 把「尚未落库的本地数量」叠加到服务端快照上。
 * 场景：用户刚点了 +（写入还在 300ms 防抖窗口内），立刻打开购物车 →
 * 服务端读数仍是旧值，直接渲染就会「打开购物车看到的是旧数量」。
 * 这里以本地未落库值为准做叠加，保证打开瞬间看到的就是用户刚点出来的数。
 */
function overlayPending(s: CartSnap | null): CartSnap | null {
  if (!s) return s;
  let next: CartSnap | null = s;
  for (const g of s.groups) {
    for (const it of g.items) {
      if (!isPending(it.productId)) continue;
      const local = getLocalQty(it.productId);
      if (local !== undefined && local !== it.quantity) {
        next = applyQtyTo(next, it.productId, local);
      }
    }
  }
  return next;
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
  const confirm = useConfirm();
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<CartSnap | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const orderIdRef = useRef<string | null>(null);
  const snapRef = useRef<CartSnap | null>(null);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);
  const syncTimers = useRef<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    try {
      const s = (await getCartSnapshotAction()) as CartSnap | null;
      if (s) {
        orderIdRef.current = s.orderId;
        setCartOrderId(s.orderId);
      } else {
        setCartOrderId(null);
      }
      // 把服务端真值写回本地事实源；有未落库写入的商品会被 reconcile 忽略（防回跳）
      reconcile(
        (s?.groups ?? []).flatMap((g) =>
          g.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        ),
      );
      // 叠加尚未落库的本地值后再渲染：避免「刚点完就打开抽屉，看到的是旧数量」
      const merged = overlayPending(s);
      setSnap(merged);
      setCount(merged ? merged.count : 0);
      return merged;
    } catch {
      return null;
    }
  }, []);

  const openDrawer = useCallback(() => {
    setOpen(true);
    setLoading(true);
    startTransition(async () => {
      await refresh();
      setLoading(false);
    });
  }, [refresh]);

  // 外部请求打开抽屉（加购 Toast 的「查看购物车」等）
  useEffect(() => {
    const h = () => openDrawer();
    window.addEventListener(CART_OPEN_EVENT, h);
    return () => window.removeEventListener(CART_OPEN_EVENT, h);
  }, [openDrawer]);

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

  const applyQty = (pid: string, q: number) => {
    setSnap((prev) => applyQtyTo(prev, pid, q));
  };

  /**
   * 订阅本地事实源（cart-store）：商品卡上改数量 → 抽屉**零往返**即时跟随。
   * 之前抽屉只有在打开时才回拉服务端，快速连点时明显落后；现在改为本地广播即时应用。
   * 若广播的商品还没进本地快照（首次加购），才回拉一次完整快照补齐分组信息。
   */
  useEffect(() => {
    const onStore = (e: CartQtyEvent) => {
      if (e.type === "clear") {
        setSnap(null);
        setCount(0);
        return;
      }
      const pid = e.productId;
      if (e.type === "remove") {
        setSnap((prev) => {
          if (!prev) return prev;
          const groups = prev.groups
            .map((g) => {
              const items = g.items.filter((it) => it.productId !== pid);
              return {
                ...g,
                items,
                subtotal: round2(items.reduce((s, it) => s + it.subtotal, 0)),
              };
            })
            .filter((g) => g.items.length > 0);
          return {
            ...prev,
            groups,
            total: round2(groups.reduce((s, g) => s + g.subtotal, 0)),
            count: groups.reduce(
              (s, g) => s + g.items.reduce((x, it) => x + it.quantity, 0),
              0,
            ),
          };
        });
        forgetQty(pid);
        return;
      }
      // qty：商品已在快照内 → 直接本地重算（零往返）；还没进车（首次加购）→ 回拉一次补齐分组信息
      const known =
        !!snapRef.current &&
        snapRef.current.groups.some((g) => g.items.some((it) => it.productId === pid));
      if (!known) {
        void refresh();
        return;
      }
      setSnap((prev) => applyQtyTo(prev, pid, e.quantity));
    };
    const unsub = subscribeCartQty(onStore);
    return unsub;
  }, [refresh]);

  // 顶栏角标与 Header 件数由快照派生（乐观更新即时一致，不依赖服务端回写）
  useEffect(() => {
    setCount(snap ? snap.count : 0);
  }, [snap]);

  /**
   * 静默落库（每商品 300ms 合并 + **串行执行**）。
   * UI 完全由本地乐观驱动，服务端永不回写覆盖 —— 保证零回跳、零闪烁。
   * 串行化是为了防乱序：若两次写入并发且后发的先落库，最终数量会错（误差来源之一）。
   */
  const queueSync = (pid: string, q: number) => {
    const t0 = syncTimers.current.get(pid);
    if (t0) window.clearTimeout(t0);
    syncTimers.current.set(
      pid,
      window.setTimeout(() => {
        syncTimers.current.delete(pid);
        void enqueueWrite(pid, async () => {
          // 自带 orderId 自愈 + 失败重试（见 cart/persist-qty.ts）；确实失败才回拉真值对账
          const ok = await persistItemQty(pid, q);
          if (!ok) await refresh();
        });
      }, 300),
    );
  };

  const setItemQty = (pid: string, q: number) => {
    applyQty(pid, q);
    publishQty(pid, q); // 广播给商品卡：零往返即时同步
    queueSync(pid, q);
  };

  /** 乐观删除：立即从本地移除该商品（空组随之消失），后台同步 */
  const removeItem = async (pid: string) => {
    const ok = await confirm({
      title: t.cart.removeConfirm,
      confirmText: t.common.remove,
      variant: "danger",
    });
    if (!ok) return;
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
    publishRemoved(pid); // 广播给商品卡：数量归零，回到「加入购物车」态
    startTransition(async () => {
      let oid = orderIdRef.current ?? getCartOrderId();
      if (!oid) {
        await refresh();
        oid = orderIdRef.current ?? getCartOrderId();
      }
      let ok = false;
      if (oid) {
        try {
          const res = await removeDraftItemAction(oid, pid);
          ok = res.ok;
        } catch {
          ok = false;
        }
      }
      // 没删成功（orderId 过期/网络失败）→ 拉回服务端真值，避免「刷新后商品又回来了」却没提示
      if (!ok) await refresh();
      window.dispatchEvent(new Event(CART_EVENT));
    });
  };

  const clear = async () => {
    if (!snap) return;
    const ok = await confirm({
      title: t.cart.clearConfirm,
      confirmText: t.cart.clearCart,
      variant: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      setBusy(true);
      try {
        await clearDraftAction(snap.orderId);
        orderIdRef.current = null;
        setCartOrderId(null); // 清空后旧 orderId 失效，置空避免后续写入打到已删的单子
        setSnap(null);
        setCount(0);
        publishCleared(); // 广播：所有商品卡立刻回到「加入购物车」态
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
                              <ProductImage
                                src={item.image}
                                alt={item.name}
                                sizes="44px"
                                iconClassName="size-4 text-[var(--color-ink-3)]"
                              />
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
                                {/* 数量步进器（− / 直接输入 / +，1..库存） */}
                                <div className="shrink-0">
                                  <QtyStepper
                                    value={item.quantity}
                                    min={1}
                                    max={stockCap}
                                    ariaLabel={item.name}
                                    t={t}
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
