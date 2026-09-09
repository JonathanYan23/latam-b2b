"use client";

/**
 * 商品卡「加入购物车 / 数量调节」直达控件（需求 2.1 购物车操作直达）。
 * - 未加购：显示主按钮「加入购物车」（按 MOQ 起购）
 * - 已加购：显示 [-] n [+] 步进（按 MOQ 步进，减到 0 自动移除该行）
 * - 全局同步：操作后拉最新快照并派发 CART_EVENT，其它卡片/顶栏角标/抽屉实时一致
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { ShoppingBag, Check, Loader2 } from "lucide-react";
import {
  addToDraftAction,
  setDraftItemQuantityAction,
  getCartSnapshotAction,
} from "@/app/retailer/draft-actions";
import { QtySlider } from "@/components/qty-slider";
import { CART_EVENT } from "@/components/cart/cart-shell";
import type { Dict } from "@/i18n";

interface CartSnapLike {
  orderId: string;
  groups: {
    items: { productId: string; quantity: number }[];
  }[];
}

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
  const [qty, setQty] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moqSafe = Math.max(1, Math.floor(moq) || 1);

  const refresh = async () => {
    try {
      const snap = (await getCartSnapshotAction()) as CartSnapLike | null;
      let found = 0;
      if (snap) {
        for (const g of snap.groups) {
          for (const it of g.items) {
            if (it.productId === productId) {
              found = it.quantity;
              break;
            }
          }
          if (found) break;
        }
        setOrderId(found > 0 ? snap.orderId : null);
      }
      setQty(found);
    } catch {
      /* 忽略瞬时错误 */
    }
  };

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener(CART_EVENT, h);
    return () => {
      window.removeEventListener(CART_EVENT, h);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

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

  const flash = () => {
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1200);
  };

  const add = () =>
    act(async () => {
      const res = await addToDraftAction(productId, moqSafe);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      flash();
    });

  const setTo = (target: number) =>
    act(async () => {
      if (orderId) {
        await setDraftItemQuantityAction(orderId, productId, target);
        return;
      }
      const snap = (await getCartSnapshotAction()) as CartSnapLike | null;
      if (snap) await setDraftItemQuantityAction(snap.orderId, productId, target);
    });

  // 不可购（无价格/未授权/售罄）：保持原卡片其它信息，仅不渲染控件
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
          compact
            ? "px-3 py-1.5 text-xs"
            : "px-3.5 py-2 text-xs"
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
    <div className="w-full min-w-0">
      <QtySlider
        value={qty}
        min={1}
        max={Math.max(moqSafe, stock > 0 ? stock : 999)}
        disabled={busyNow}
        onChange={setTo}
        compact={compact}
      />
    </div>
  );
}
