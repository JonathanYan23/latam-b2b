"use client";

/**
 * 购物车数量本地共享状态（模块级单例 + 订阅广播）
 *
 * 【为什么需要】
 * 商品卡（QuickAdd）和购物车抽屉（CartButton）是两棵互不相邻的组件树。
 * 之前两者靠「服务端 action 写库 → 再回读快照」互相察觉对方的改动，于是产生两个体感问题：
 *   1) **延迟** —— 对方要等「300ms 防抖 + action 往返 + 快照查询」才更新，快速点击时明显落后
 *   2) **误差** —— 回读是异步的；若期间用户又点了 +/−，后到的旧回执会把新值覆盖回去（数值回跳）
 *
 * 【做法】
 * 这里维护一个模块级 Map 作为「本地事实源」：任何一方改数量都立刻 broadcast，
 * 订阅方同步更新视图（零网络往返）；服务端写入只负责持久化，**永不回写覆盖**。
 * 另外：同一商品的写库请求串行化，保证「最后一次点击」一定是最终落库值（避免乱序覆盖）。
 */

export type CartQtyEvent =
  | { type: "qty"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" };

const qty = new Map<string, number>();
/** 有尚未落库的本地写入的商品（此时服务端读数已过期，不可采信） */
const pending = new Map<string, number>();
const listeners = new Set<(e: CartQtyEvent) => void>();

/** 当前草稿订单 id（全局共用，避免每个商品卡各自查询快照） */
let orderId: string | null = null;

export function getCartOrderId(): string | null {
  return orderId;
}
export function setCartOrderId(id: string | null) {
  orderId = id;
}

/** 本地已知数量（未记录返回 undefined） */
export function getLocalQty(productId: string): number | undefined {
  return qty.get(productId);
}

/** 该商品是否有未落库的本地写入 */
export function isPending(productId: string): boolean {
  return pending.has(productId);
}

function emit(e: CartQtyEvent) {
  listeners.forEach((fn) => fn(e));
}

/** 用户改了数量：立刻广播（视图即时同步）+ 标记待落库 */
export function publishQty(productId: string, quantity: number) {
  qty.set(productId, quantity);
  pending.set(productId, quantity);
  emit({ type: "qty", productId, quantity });
}

/** 服务端已确认落库：清 pending、记录真值，不广播（避免回环） */
export function confirmQty(productId: string, quantity: number) {
  pending.delete(productId);
  qty.set(productId, quantity);
}

/** 服务端读取失败 / 需要回滚时，按服务端真值修正并广播 */
export function forceQty(productId: string, quantity: number) {
  pending.delete(productId);
  qty.set(productId, quantity);
  emit({ type: "qty", productId, quantity });
}

/** 商品被移除（画整组） */
export function publishRemoved(productId: string) {
  qty.set(productId, 0);
  pending.delete(productId);
  emit({ type: "remove", productId });
}

/** 清掉某商品的本地记录（移除后不再保留 0 值记录） */
export function forgetQty(productId: string) {
  qty.delete(productId);
  pending.delete(productId);
}

/** 清空购物车 */
export function publishCleared() {
  qty.clear();
  pending.clear();
  emit({ type: "clear" });
}

/**
 * 服务端快照回读后的对账：只接受**没有待落库写入**的条目。
 * 这是防「数值回跳」的关键——用户刚点的值不会被过期读数冲掉。
 */
export function reconcile(entries: { productId: string; quantity: number }[]) {
  const seen = new Set<string>();
  for (const e of entries) {
    seen.add(e.productId);
    if (pending.has(e.productId)) continue;
    qty.set(e.productId, e.quantity);
  }
  // 服务端已经没有的商品：清掉本地记录（前提是本地没有待落库写入）
  for (const pid of [...qty.keys()]) {
    if (!seen.has(pid) && !pending.has(pid)) qty.delete(pid);
  }
}

/** 订阅任意数量变化；返回取消订阅函数 */
export function subscribeCartQty(fn: (e: CartQtyEvent) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * 同一商品的写库请求串行化，保证顺序。
 * 若并发发出（如 300ms 内两轮写入重叠），后发的可能先落库，最终值会错。
 */
const chains = new Map<string, Promise<unknown>>();
export function enqueueWrite(
  productId: string,
  write: () => Promise<unknown>,
): Promise<unknown> {
  const prev = chains.get(productId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(write);
  chains.set(
    productId,
    next.catch(() => {}),
  );
  return next;
}
