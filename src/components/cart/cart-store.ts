"use client";

/**
 * 购物车数量本地共享状态（模块级单例 + 订阅广播）
 *
 * 【为什么需要】
 * 商品卡（QuickAdd）和购物车抽屉（CartButton）是两棵互不相邻的组件树。
 * 之前两者靠「服务端 action 写库 → 再回读快照」互相察觉对方的改动，于是产生两个体感问题：
 *   1) **延迟** —— 对方要等「防抖 + action 往返 + 快照查询」才更新，快速点击时明显落后
 *   2) **误差** —— 回读是异步的；若期间用户又点了 +/−，后到的旧回执会把新值覆盖回去（数值回跳）
 *
 * 【做法】
 * 这里维护一个模块级 Map 作为「本地事实源」：任何一方改数量都立刻 broadcast，
 * 订阅方同步更新视图（零网络往返）；服务端写入只负责持久化，**永不回写覆盖**。
 *
 * 【为什么落库队列也必须放在这里】
 * 曾经把「300ms 防抖 + 落库」放在组件里（useRef + setTimeout）。那是错的：
 * 组件一旦卸载或重挂（页面刷新、列表重渲染、抽屉开关），cleanup 会 clearTimeout，
 * 待落库的意图随之蒸发 —— 表现就是「卡片显示新值、刷新后回退、且一个请求都没发」。
 * 现在把 dirty 队列与定时器都放在模块级：**只要用户在界面上改了，就一定会被写进去**，
 * 失败还会按退避自动重试，直到成功。
 */

export type CartQtyEvent =
  | { type: "qty"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" }
  | { type: "write-error"; productId: string };

const qty = new Map<string, number>();
/** 有尚未落库的本地写入的商品（此时服务端读数已过期，不可采信） */
const pending = new Map<string, number>();
/** 服务端已确认落库的值 */
const lastOk = new Map<string, number>();
const listeners = new Set<(e: CartQtyEvent) => void>();

/** 当前草稿订单 id（全局共用，避免每个商品卡各自查询快照） */
let orderId: string | null = null;

export function getCartOrderId(): string | null {
  return orderId;
}
/** 只在「明确知道草稿单已不存在」时置空；不要因为一次瞬时 null 快照就作废 */
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

/** 是否存在任何未落库的本地写入（用于「瞬时空快照不要清空视图」的判断） */
export function hasPendingWrites(): boolean {
  return pending.size > 0;
}

function emit(e: CartQtyEvent) {
  listeners.forEach((fn) => fn(e));
}

/** 用户改了数量：立刻广播（视图即时同步）+ 标记待落库 + 安排写入 */
export function publishQty(productId: string, quantity: number) {
  qty.set(productId, quantity);
  pending.set(productId, quantity);
  attempts.delete(productId);
  emit({ type: "qty", productId, quantity });
  scheduleFlush();
}

/** 服务端已确认落库：清 pending、记录真值，不广播（避免回环） */
export function confirmQty(productId: string, quantity: number) {
  pending.delete(productId);
  qty.set(productId, quantity);
  lastOk.set(productId, quantity);
}

/** 服务端读取失败 / 需要回滚时，按服务端真值修正并广播 */
export function forceQty(productId: string, quantity: number) {
  pending.delete(productId);
  qty.set(productId, quantity);
  lastOk.set(productId, quantity);
  emit({ type: "qty", productId, quantity });
}

/** 商品被移除（删整组） */
export function publishRemoved(productId: string) {
  qty.set(productId, 0);
  pending.delete(productId);
  lastOk.delete(productId);
  emit({ type: "remove", productId });
}

/** 清掉某商品的本地记录（移除后不再保留 0 值记录） */
export function forgetQty(productId: string) {
  qty.delete(productId);
  pending.delete(productId);
  lastOk.delete(productId);
  attempts.delete(productId);
}

/** 清空购物车 */
export function publishCleared() {
  qty.clear();
  pending.clear();
  lastOk.clear();
  attempts.clear();
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
    lastOk.set(e.productId, e.quantity); // 服务端读数即「已落库值」
    if (pending.has(e.productId)) continue;
    qty.set(e.productId, e.quantity);
  }
  // 服务端已经没有的商品：清掉本地记录（前提是本地没有待落库写入）
  for (const pid of [...qty.keys()]) {
    if (!seen.has(pid) && !pending.has(pid)) {
      qty.delete(pid);
      lastOk.delete(pid);
    }
  }
}

/** 订阅任意数量变化；返回取消订阅函数 */
export function subscribeCartQty(fn: (e: CartQtyEvent) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/* ------------------------------------------------------------------ *
 * 落库队列（模块级，与组件生命周期无关）
 * ------------------------------------------------------------------ */

type QtyWriter = (productId: string, quantity: number) => Promise<boolean>;

let writer: QtyWriter | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
const attempts = new Map<string, number>();
/** 同一目标值的最大重试次数，超过则放弃并通知组件回滚 */
const MAX_ATTEMPTS = 4;

/** 由 persist-qty.ts 在模块加载时注册「真正发请求」的实现 */
export function registerQtyWriter(fn: QtyWriter) {
  writer = fn;
}

/** 还差哪些商品没写进服务端 */
function dirtyJobs(): [string, number][] {
  const jobs: [string, number][] = [];
  pending.forEach((q, pid) => {
    if (lastOk.get(pid) !== q) jobs.push([pid, q]);
  });
  return jobs;
}

/** 合并写入窗口：连续点击只在停下来后写一次 */
export function scheduleFlush(delay = 300) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPending();
  }, delay);
}

/** 立刻把待落库的改动写进去（串行、单飞） */
export async function flushPending(): Promise<void> {
  if (flushing || !writer) return;
  flushing = true;
  try {
    for (const [pid, q] of dirtyJobs()) {
      const ok = await writer(pid, q);
      if (ok) {
        // 记下落库成功的值；若写入期间用户又改了数量（pending 已变新值），
        // 保留新的 pending，交给下一轮 flush 补写 —— 绝不用旧值覆盖新值
        lastOk.set(pid, q);
        attempts.delete(pid);
        if (pending.get(pid) === q) {
          pending.delete(pid);
          qty.set(pid, q);
        }
      } else {
        const n = (attempts.get(pid) ?? 0) + 1;
        if (n >= MAX_ATTEMPTS) {
          // 确实写不进去：放弃这一笔，交还服务端真值（组件收到 write-error 会重新同步）
          attempts.delete(pid);
          pending.delete(pid);
          emit({ type: "write-error", productId: pid });
        } else {
          attempts.set(pid, n);
        }
      }
    }
  } finally {
    flushing = false;
  }
  // 写成功之前绝不停：还有脏数据就按退避再试
  if (dirtyJobs().length) scheduleFlush(1200);
}

/**
 * 离开页面/切到后台前尽量把待落库的改动送出去。
 * （浏览器可能来不及等响应，所以这里只是「尽力」；正常停留时上面的重试才是主力）
 */
if (typeof window !== "undefined") {
  const kick = () => {
    if (dirtyJobs().length) void flushPending();
  };
  window.addEventListener("visibilitychange", kick);
  window.addEventListener("pagehide", kick);
}
