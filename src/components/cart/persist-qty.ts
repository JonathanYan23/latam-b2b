"use client";

/**
 * 数量落库（带去重与自愈重试）
 *
 * 【为什么需要单独一层】
 * 客户端的 `orderId` 是本地缓存（来自上一次快照）。它随时可能过期：
 *  - 用户在别处清空了购物车、或草稿单被重建 → 旧 id 对应的单子里已没有该商品
 *  - 页面刚刷新，快照还没回来 → 本地根本没有 id
 * 早期实现遇到这两种情况会**静默丢写**：
 *   - 传了过期 id：服务端找不到该商品，却仍然返回 ok → 客户端以为写成功，刷新后数字回退
 *   - 没有 id：直接 return，什么都不发 → 同上
 * 结果就是「点了 +，卡片显示对了，一刷新又变回去，而且全程没有任何报错」。
 *
 * 这里统一处理：发写入前确保拿到可用的 orderId；失败则**刷新快照换新 id 再重试一次**。
 * 只有确实写不进去（商品已不在车内）才返回 false，交给调用方回滚 + 提示。
 */
import {
  getCartSnapshotAction,
  setDraftItemQuantityAction,
} from "@/app/retailer/draft-actions";
import {
  confirmQty,
  getCartOrderId,
  setCartOrderId,
} from "@/components/cart/cart-store";

/** 拉一次快照并同步最新 orderId；购物车为空（快照 null）时返回 null */
async function resolveOrderId(): Promise<string | null> {
  try {
    const snap = (await getCartSnapshotAction()) as { orderId: string } | null;
    if (snap) {
      setCartOrderId(snap.orderId);
      return snap.orderId;
    }
    setCartOrderId(null);
    return null;
  } catch {
    return null;
  }
}

/**
 * 把某商品的数量写到服务端。返回是否确实落库成功。
 * @param productId 商品 id
 * @param target    目标数量（>0；<=0 的移除走 removeDraftItemAction）
 */
export async function persistItemQty(
  productId: string,
  target: number,
): Promise<boolean> {
  let oid = getCartOrderId();
  if (!oid) oid = await resolveOrderId();
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
