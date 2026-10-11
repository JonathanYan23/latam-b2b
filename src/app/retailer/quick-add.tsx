"use client";

/**
 * 商品卡「加入购物车 / 数量调节」直达控件（需求 2.1 购物车操作直达）。
 * - 未加购：显示主按钮「加入购物车」（按 MOQ 起购）
 * - 已加购：显示 [− 数量 +] 步进器
 * - 全局同步：经 cart-store 与购物车抽屉**零往返即时互同步**（不再靠服务端回读）
 *
 * 【为什么不再用服务端回读】
 * 早期实现是「写库后 refresh() 拉一次快照覆盖本地」，快速连点时会暴露两个问题：
 *   1) 延迟：对方组件要等「防抖 + action 往返 + 快照查询」才能看到变化
 *   2) 误差：回读是异步的，期间用户又点了 +/− → 后到的旧读数把新值冲掉（数值回跳）
 * 现在：用户一改就 publishQty 广播，所有视图即时一致；写库只负责持久化，
 * 成功仅 confirmQty 清 pending，**任何情况下都不拿服务端读数覆盖更新的本地值**。
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ShoppingBag, Check, Loader2 } from "lucide-react";
import {
  addToDraftAction,
  setDraftItemQuantityAction,
  getCartSnapshotAction,
} from "@/app/retailer/draft-actions";
import { QtyStepper } from "@/components/qty-stepper";
import { CART_EVENT, CART_OPEN_EVENT } from "@/components/cart/cart-shell";
import {
  confirmQty,
  enqueueWrite,
  getCartOrderId,
  getLocalQty,
  isPending,
  publishQty,
  reconcile,
  setCartOrderId,
  subscribeCartQty,
} from "@/components/cart/cart-store";
import { useToast } from "@/components/ui/toast";
import type { Dict } from "@/i18n";

interface CartSnapLike {
  orderId: string;
  groups: {
    items: { productId: string; quantity: number }[];
  }[];
}

/** 落库合并窗口：连续点击只写最后一个值 */
const WRITE_DEBOUNCE = 300;

export function QuickAdd({
  productId,
  moq,
  stock,
  enabled,
  t,
  compact = false,
}: {
  productId: string;
  moq: number;
  stock: number;
  /** 可购 = 已授权客户可见价 且 有库存；false 时渲染占位空块保持布局稳定 */
  enabled: boolean;
  t: Dict;
  compact?: boolean;
}) {
  const [qty, setQty] = useState(() => getLocalQty(productId) ?? 0);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);
  const moqSafe = Math.max(1, Math.floor(moq) || 1);

  /** 与服务端对齐：只采纳「本地没有待落库写入」的服务端数量 */
  const syncFromServer = useCallback(async () => {
    try {
      const snap = (await getCartSnapshotAction()) as CartSnapLike | null;
      if (!aliveRef.current) return;
      setCartOrderId(snap ? snap.orderId : null);
      const rows = (snap?.groups ?? []).flatMap((g) =>
        g.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      );
      reconcile(rows);
      if (!isPending(productId)) {
        setQty(rows.find((r) => r.productId === productId)?.quantity ?? 0);
      }
    } catch {
      /* 忽略瞬时错误：本地乐观态继续有效 */
    }
  }, [productId]);

  useEffect(() => {
    aliveRef.current = true;
    const local = getLocalQty(productId);
    if (local !== undefined) setQty(local); // 跨页返回时先按本地状态即时渲染
    void syncFromServer();

    // 订阅全局本地状态：抽屉里改数量 → 这里立刻同步，无需服务器往返
    const unsub = subscribeCartQty((e) => {
      if (e.type === "clear") {
        setQty(0);
        return;
      }
      if (e.productId !== productId) return;
      setQty(e.type === "remove" ? 0 : e.quantity);
    });

    return () => {
      aliveRef.current = false;
      unsub();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const flash = () => {
    setAdded(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setAdded(false), 1200);
  };

  /** 首次加入购物车 */
  const add = () =>
    startTransition(async () => {
      setBusy(true);
      try {
        const res = await addToDraftAction(productId, moqSafe);
        if (!res.ok) {
          toast.error(res.error || t.ui.networkError);
          return;
        }
        if (res.draftId) setCartOrderId(res.draftId);
        setQty(moqSafe);
        publishQty(productId, moqSafe);
        confirmQty(productId, moqSafe); // 服务端已落库
        flash();
        window.dispatchEvent(new Event(CART_EVENT)); // 顶栏角标刷新
        // 就地反馈：Toast 带「查看购物车」，点击直接打开抽屉（不跳页）
        toast.success(t.cart.addedToast, {
          action: {
            label: t.cart.viewCart,
            onClick: () => window.dispatchEvent(new Event(CART_OPEN_EVENT)),
          },
        });
      } finally {
        if (aliveRef.current) setBusy(false);
      }
    });

  /** 串行写库（300ms 合并）：保证「最后一次点击」是最终落库值，杜绝乱序覆盖 */
  const persist = (target: number) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      void enqueueWrite(productId, async () => {
        const oid = getCartOrderId();
        if (!oid) return;
        try {
          const res = await setDraftItemQuantityAction(oid, productId, target);
          if (res.ok) {
            confirmQty(productId, target);
          } else if (aliveRef.current) {
            toast.error(res.error || t.ui.networkError);
            await syncFromServer();
          }
        } catch {
          if (aliveRef.current) {
            toast.error(t.ui.networkError);
            await syncFromServer();
          }
        }
      }).then(() => window.dispatchEvent(new Event(CART_EVENT)));
    }, WRITE_DEBOUNCE);
  };

  /** 用户改数量：本地即时生效 + 广播给购物车，再延时落库 */
  const setTo = (target: number) => {
    setQty(target);
    publishQty(productId, target);
    persist(target);
  };

  // 不可购（无价格/未授权/售罄）：保持卡片其它信息，仅不渲染控件
  if (!enabled) return <div className="h-8" aria-hidden="true" />;

  const busyNow = busy || pending;

  if (qty === 0) {
    return (
      <button
        type="button"
        disabled={busyNow || stock <= 0}
        onClick={add}
        aria-label={`${t.product.addToOrder} · MOQ ${moqSafe}`}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium text-white transition-all ${
          compact ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-xs"
        } ${
          stock <= 0
            ? "cursor-not-allowed bg-[var(--color-ink-2)]/40"
            : "bg-[var(--color-ink)] hover:bg-[var(--color-ink-2)] active:scale-[0.97]"
        }`}
      >
        {busyNow ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : added ? (
          <>
            <Check className="size-3.5" /> {t.product.added}
          </>
        ) : (
          <>
            <ShoppingBag className="size-3.5" /> {t.product.addToOrder}
          </>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <QtyStepper
        value={qty}
        min={1}
        max={Math.max(1, stock > 0 ? stock : 999)}
        ariaLabel={t.product.addToOrder}
        t={t}
        size={compact ? "sm" : "md"}
        onChange={setTo}
      />
      {stock > 0 && stock <= 99 && (
        <p className="mt-1 text-center text-[10px] leading-none text-[var(--color-ink-3)]">
          {t.cart.inStockCount.replace("{n}", String(stock))}
        </p>
      )}
    </div>
  );
}
