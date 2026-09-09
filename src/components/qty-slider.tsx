"use client";

/**
 * 数量选择器 · 纵向拖拽版（无 +/- 小箭头）
 * - 按住竖直滑轨/把手：向上拖 → 增加，向下拖 → 减少；拖动中实时显示数量，松手即提交
 * - 保留数字输入框直接敲值（回车 / 失焦生效）
 * - min = 1，max = 当前商品库存；拖到边界自动停住，不会乱跳 / 误清空
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

export function QtySlider({
  value,
  min = 1,
  max = 999,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const safeMin = Math.max(1, Math.floor(min) || 1);
  const safeMax = Math.max(safeMin, Math.floor(max) || safeMin + 1);
  const [draft, setDraft] = useState<string>(String(value));
  const [active, setActive] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startVal: number } | null>(null);
  const curRef = useRef(value); // 拖动中的最新值（避免快速拖动时松手读到旧闭包）

  const clamp = (n: number) =>
    Math.min(safeMax, Math.max(safeMin, Number.isFinite(n) ? Math.floor(n) : safeMin));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  // 拖动中的“实时显示值”（松手后才提交 onChange）
  const liveVal = active ? clamp(Number(draft) || safeMin) : value;
  const span = safeMax - safeMin;
  const pct = span > 0 ? ((liveVal - safeMin) / span) * 100 : 0;
  const heightPx = compact ? 72 : 104;

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startVal: liveVal };
    setActive(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !railRef.current) return;
    const pxPerUnit = Math.max(1, heightPx / Math.max(1, span));
    const dy = d.startY - e.clientY; // 上拖为正 → 增
    const next = clamp(d.startVal + Math.round(dy / pxPerUnit));
    curRef.current = next;
    setDraft(String(next));
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    const final = curRef.current;
    setDraft(String(final));
    setActive(false);
    if (final !== value) onChange(final);
  };

  const commitTyped = () => {
    const next = clamp(parseFloat(draft) || safeMin);
    curRef.current = next;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-3">
      {/* 纵向滑轨 + 把手 */}
      <div
        ref={railRef}
        role="slider"
        aria-label="Quantity"
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
        aria-valuenow={liveVal}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`vqty relative shrink-0 rounded-full transition-opacity ${
          disabled ? "opacity-40" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{ height: heightPx, width: 30 }}
      >
        {/* 轨道（浅底） */}
        <div className="absolute inset-y-1 left-1/2 w-1 -translate-x-1/2 rounded-full bg-[#e3e3e8]" />
        {/* 进度填充（从下往上，随值升高） */}
        <div
          className="absolute w-1 rounded-full bg-[var(--color-accent)]"
          style={{
            bottom: "0.25rem",
            height: `calc((100% - 0.5rem) * ${pct / 100})`,
          }}
        />
        {/* 把手 */}
        <div
          className={`absolute left-1/2 grid size-6 -translate-x-1/2 place-items-center rounded-full border border-[#d2d2d7] bg-white shadow-sm transition-transform ${
            active
              ? "scale-110 ring-4 ring-[var(--color-accent)]/25"
              : "hover:scale-105"
          }`}
          style={{
            bottom: `calc(${pct / 100} * (100% - 1.75rem) + 0.35rem)`,
          }}
        >
          <div className={`size-2 rounded-full ${active ? "bg-[var(--color-accent)]" : "bg-[#c7c7cc]"}`} />
        </div>
        {/* 拖动中的实时数值标签 */}
        {active && (
          <span
            className="absolute left-9 top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white"
            style={{ pointerEvents: "none" }}
          >
            {liveVal}
          </span>
        )}
      </div>

      {/* 数字输入（保留敲值） */}
      <input
        type="number"
        inputMode="numeric"
        min={safeMin}
        max={safeMax}
        value={draft}
        disabled={disabled}
        aria-label="Quantity input"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`input shrink-0 rounded-lg px-1 py-1 text-center font-semibold tabular-nums ${
          compact ? "w-11 text-[13px]" : "w-14 text-sm"
        }`}
      />
    </div>
  );
}
