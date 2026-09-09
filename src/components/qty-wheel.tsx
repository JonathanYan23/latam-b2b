"use client";

/**
 * QtyWheel — 滚轮式数量选择器（全新交互，参考 iOS 时间选择器 / 手表数字滚轮）
 *
 * 数字垂直排列：            上方数字逐渐变小变淡
 *                     ───────────────
 *                         5   ← 当前选中：居中、放大加粗、最清晰
 *                     ───────────────
 *                        下方数字逐渐变小变淡
 *
 * 交互：
 *  - 鼠标滚轮：向上滚 +1 / 向下滚 -1（平滑逐格经过中心）
 *  - 按住上下拖动：数字跟随手指像机械滚轮一样经过，松手自动吸附到最近整数
 *  - 触摸滑动：同上（touch-action:none）
 *  - 键盘 ↑ ↓ 逐格调整
 *  - min = 1，max = 当前库存；拖到边界自动停住；不允许 0 / 超过库存
 *
 * 数量一旦定格（滚轮一格 / 键盘一格 / 拖动松手吸附）立即调用 onChange，
 * 调用方无需刷新页面即可同步商品小计与购物车总额。
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as RKeyboardEvent,
} from "react";

const ROW_H = 20; // 每格高度 px
const HEIGHT = 60; // 可视高度 = 3 格（当前行上下各 1 格可见，继续淡出）
const PAD = 4; // 可视区外每侧预渲染行数（滑动过程中不缺行、不断层）
const STEP_PX = 40; // 滚轮累积多少像素滚动一格

export function QtyWheel({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  ariaLabel = "Quantity",
}: {
  value: number;
  min?: number;
  /** 库存上限（必传，决定可选项 1..max） */
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const safeMin = Math.max(1, Math.floor(min) || 1);
  const safeMax = Math.max(safeMin, Math.floor(max) || safeMin + 1);

  // pos 可为小数：拖动时表示“行当前位移量”，渲染跟随它实现真实滚动
  const [pos, setPos] = useState(value);
  const posRef = useRef(value);
  const dragRef = useRef<{ id: number; startY: number; startPos: number } | null>(null);
  const lastSent = useRef(value);
  const acc = useRef(0); // 滚轮像素累积
  const railRef = useRef<HTMLDivElement>(null);

  const clampF = (n: number) => Math.min(safeMax, Math.max(safeMin, n));
  const commit = (next: number) => {
    const v = Math.round(clampF(next));
    if (v !== lastSent.current) {
      lastSent.current = v;
      onChange(v);
    }
    return v;
  };

  // 外部值变化（其它入口改数量 / action 回执）→ 同步内部位置
  useEffect(() => {
    const v = clampF(value);
    posRef.current = v;
    lastSent.current = v;
    setPos(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, safeMin, safeMax]);

  // 滚轮（以非被动监听注册，避免拖动页面滚动）
  useEffect(() => {
    const el = railRef.current;
    if (!el || disabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc.current += e.deltaY;
      let step = 0;
      while (acc.current >= STEP_PX) {
        acc.current -= STEP_PX;
        step -= 1; // 向下滚 → 减
      }
      while (acc.current <= -STEP_PX) {
        acc.current += STEP_PX;
        step += 1; // 向上滚 → 增
      }
      if (!step) return;
      const nv = clampF(posRef.current + step);
      if (nv !== posRef.current) {
        posRef.current = nv;
        setPos(nv);
        commit(nv);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, safeMin, safeMax]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    // 数量轮为单指场景：新按下立即接管，避免上轮 up 未匹配 pointerId 导致残留
    dragRef.current = { id: e.pointerId, startY: e.clientY, startPos: posRef.current };
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 个别环境不允许 capture 时退化为普通拖动 */
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nv = clampF(d.startPos - (e.clientY - d.startY) / ROW_H); // 上拖为正 → 增
    posRef.current = nv;
    setPos(nv);
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const snapped = commit(posRef.current);
    posRef.current = snapped;
    setPos(snapped);
  };

  const onKey = (e: RKeyboardEvent) => {
    if (disabled) return;
    let nv: number | null = null;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      nv = clampF(posRef.current + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nv = clampF(posRef.current - 1);
    }
    if (nv === null) return;
    posRef.current = nv;
    setPos(nv);
    commit(nv);
  };

  // 渲染当前可见范围内的数字行
  const lo = Math.max(safeMin, Math.ceil(pos) - PAD);
  const hi = Math.min(safeMax, Math.floor(pos) + PAD);
  const rows: number[] = [];
  for (let i = lo; i <= hi; i++) rows.push(i);
  const cur = Math.round(pos);

  return (
    <div
      ref={railRef}
      role="slider"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuemin={safeMin}
      aria-valuemax={safeMax}
      aria-valuenow={cur}
      aria-valuetext={String(cur)}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKey}
      className={`relative select-none outline-none ${
        disabled
          ? "cursor-not-allowed opacity-35"
          : "cursor-ns-resize active:cursor-grabbing"
      }`}
      style={{
        height: HEIGHT,
        width: "100%",
        touchAction: "none",
        WebkitUserSelect: "none",
        // 上下边缘柔和淡出，露出“正在经过”的邻近数字
        WebkitMaskImage:
          "linear-gradient(180deg, transparent 0, #000 11px, #000 calc(100% - 11px), transparent 100%)",
        maskImage:
          "linear-gradient(180deg, transparent 0, #000 11px, #000 calc(100% - 11px), transparent 100%)",
      }}
    >
      {/* 细微的选中指示线（中间一格上下沿，Apple 风格 hairline） */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -mt-5 h-px bg-[rgba(29,29,31,0.09)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[rgba(29,29,31,0.09)]"
      />

      {rows.map((i) => {
        const d = i - pos; // 0 = 正对中心
        const absD = Math.abs(d);
        // 越靠近中心越大越清晰；远离中心逐渐缩小、变淡
        const s = Math.max(0.8, 1.12 - absD * 0.17);
        const o = Math.max(0.22, 1 - absD * 0.36);
        const strong = Math.round(pos) === i;
        return (
          <div
            key={i}
            className="absolute inset-x-0 flex items-center justify-center leading-none tabular-nums"
            style={{
              top: `calc(50% + ${d * ROW_H}px - ${ROW_H / 2}px)`,
              height: ROW_H,
              opacity: o,
              transform: `scale(${s})`,
              color: strong ? "var(--color-ink)" : "var(--color-ink-2)",
              fontWeight: strong ? 700 : 450,
              fontSize: 15,
              willChange: "transform, opacity",
            }}
          >
            {i}
          </div>
        );
      })}
    </div>
  );
}
