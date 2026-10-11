"use client";

/**
 * 数量落库（数量队列的「真正发请求」实现）
 *
 * 【为什么需要单独一层】
 * 客户端的 `orderId` 是本地缓存（来自上一次快照）。它可能过期或瞬时读不到：
 *  - 用户在别处清空了购物车、或草稿单被重建 → 旧 id 对应的单子里已没有该商品
 *  - 页面刚刷新 / 并发回读，快照会瞬时返回 null → 本地拿不到 id
 * 早期实现遇到这些情况会**静默丢写**：服务端找不到商品却仍返回 ok，客户端以为写成功，
 * 表现为「点了 +、卡片显示对了、一刷新又变回去，而且全程没有任何报错」。
 *
 * 这里统一处理：
 *  1. 写入前确保有可用 orderId（没有就拉快照，带重试）
 *  2. 首次失败 → 换最新 orderId **重试一次**
 *  3. 依然失败才返回 false（由 cart-store 的队列决定是否继续退避重试/回滚）
 *
 * 【注册时机】本模块在加载时把实现注册进 cart-store 的落库队列，
 * 因此 cart-shell / quick-add 只要 import 过它一次即可（两者都在 import 副作用里）。
 */
import {
  getCartSnapshotAction,
  setDraftItemQuantityAction,
} from "@/app/retailer/draft-actions";
import {
  confirmQty,
  getCartOrderId,
  registerQtyWriter,
  setCartOrderId,
} from "@/components/cart/cart-store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 拉一次快照并同步最新 orderId。
 * 空购物车（快照为 null）是合法结果，但「刚改过数量却读到空」通常是瞬时抖动，
 * 所以最多重试 3 次再放弃。
 */
async function resolveOrderId(): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const snap = (await getCartSnapshotAction()) as { orderId: string } | null;
      if (snap) {
        setCartOrderId(snap.orderId);
        return snap.orderId;
      }
      // 只有「本来就没有活跃草稿单」才是真的空；这里保守重试
      if (i < 2) await sleep(180 * (i + 1));
    } catch {
      if (i < 2) await sleep(180 * (i + 1));
    }
  }
  return null;
}

/** 未落库且没有已知 orderId 时，先补一个（不覆盖已确认落库的值） */
async function ensureOrderId(): Promise<string | null> {
  return getCartOrderId() ?? (await resolveOrderId());
}

/**
 * 把某商品的数量写到服务端。返回是否**确实**落库成功。
 * 注意：返回 false 不代表要立刻回滚，cart-store 的队列会按退避继续重试。
 */
export async function persistItemQty(
  productId: string,
  target: number,
): Promise<boolean> {
  const oid = await ensureOrderId();
  if (!oid) return false;
  try {
    const res = await setDraftItemQuantityAction(oid, productId, target);
    if (res.ok) {
      confirmQty(productId, target);
      return true;
    }
    // 首次失败：多半是本地 orderId 过期 → 换最新 id 重试一次
    const fresh = await resolveOrderId();
    if (fresh && fresh !== oid) {
      const retry = await setDraftItemQuantityAction(fresh, productId, target);
      if (retry.ok) {
        confirmQty(productId, target);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// 注册到队列：此后任何 publishQty 都会经由这里落库，且与组件生命周期无关
registerQtyWriter((productId, quantity) => persistItemQty(productId, quantity));
