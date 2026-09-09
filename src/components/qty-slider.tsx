"use client";

/**
 * Apple 风数量调节：横向滑杆 + 数字同步 + 可手动输入（需求：移除 +/- 点按、避免误清空）。
 * - 滑块/输入共享同一 value；拖动或输入即回调
 * - min ≥ 1（默认），因此"点一下变 0 / 整行消失"的问题从交互上杜绝；
 *   移除商品统一由调用方提供独立的「删除」操作（带确认）
 */
import { useEffect, useState, type CSSProperties } from "react";

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

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const clamp = (n: number) =>
    Math.min(safeMax, Math.max(safeMin, Number.isFinite(n) ? Math.floor(n) : safeMin));
  const fillPct = Math.round(((value - safeMin) / Math.max(1, safeMax - safeMin)) * 100);

  const commit = (raw: string | number) => {
    const next = clamp(typeof raw === "number" ? raw : parseFloat(raw));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "w-full"}`}>
      <input
        type="range"
        min={safeMin}
        max={safeMax}
        step={1}
        value={value}
        disabled={disabled}
        aria-label="Quantity"
        onChange={(e) => commit(Number(e.target.value))}
        style={{ "--qty-fill": `${fillPct}%` } as CSSProperties}
        className="qty-range min-w-0 flex-1"
      />
      <input
        type="number"
        inputMode="numeric"
        min={safeMin}
        max={safeMax}
        value={draft}
        disabled={disabled}
        aria-label="Quantity input"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`input shrink-0 rounded-lg px-1 py-0.5 text-center text-[13px] font-semibold tabular-nums ${
          compact ? "w-11" : "w-14"
        }`}
      />
    </div>
  );
}
