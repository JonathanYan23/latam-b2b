"use client";

/**
 * QtyStepper — 数量步进器：`[ − ] [ 12 ] [ + ]`
 *
 * 设计目标（用户反馈：不要滑轮，要能直接输数字，左右各一个加减）：
 *  - **直接输入**：点中间数字即可键盘输入，聚焦自动全选，输入过程即时生效
 *  - **左右加减**：左 − 右 +；到边界自动禁用；**长按可连续加减**（480ms 后每 70ms 一格）
 *  - 键盘：↑ ↓ 加减、Enter 提交、Esc 还原
 *  - 失焦归一：空 / 非数字 / 越界 → 自动吸附到 [min, max] 内的整数
 *
 * 数量一定格就调 onChange，调用方负责乐观更新小计与角标。
 */
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Dict } from "@/i18n";

const HOLD_DELAY = 480; // 长按多久开始连发
const HOLD_INTERVAL = 70; // 连发间隔

export function QtyStepper({
  value,
  min = 1,
  max,
  step = 1,
  onChange,
  disabled = false,
  ariaLabel,
  t,
  size = "md",
}: {
  value: number;
  min?: number;
  /** 上限（通常是库存；不传则按 min + 9999 处理） */
  max?: number;
  /** 单次加减步长（默认 1） */
  step?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  /** 无障碍名称：通常传商品名 */
  ariaLabel?: string;
  t: Dict;
  size?: "sm" | "md";
}) {
  const safeMin = Math.max(1, Math.floor(min) || 1);
  const safeMax = Math.max(safeMin, Math.floor(max ?? safeMin + 9999) || safeMin);
  const safeStep = Math.max(1, Math.floor(step) || 1);
  const clamp = (n: number) => Math.min(safeMax, Math.max(safeMin, n));

  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const lastSent = useRef(value);
  const holdDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRepeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cur = clamp(value);

  /** 对外提交（去重） */
  const commit = (n: number) => {
    const v = clamp(Math.round(n));
    if (v !== lastSent.current) {
      lastSent.current = v;
      onChange(v);
    }
    return v;
  };

  // 外部值变化（其它入口改数量 / 服务端回执）→ 同步显示
  useEffect(() => {
    const v = clamp(value);
    lastSent.current = v;
    if (!editing) setText(String(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, safeMin, safeMax, editing]);

  // 卸载时清掉长按定时器
  useEffect(
    () => () => {
      if (holdDelay.current) clearTimeout(holdDelay.current);
      if (holdRepeat.current) clearInterval(holdRepeat.current);
    },
    [],
  );

  const stopHold = () => {
    if (holdDelay.current) {
      clearTimeout(holdDelay.current);
      holdDelay.current = null;
    }
    if (holdRepeat.current) {
      clearInterval(holdRepeat.current);
      holdRepeat.current = null;
    }
  };

  /** 长按连续加减 */
  const startHold = (dir: 1 | -1) => {
    if (disabled) return;
    stopHold();
    let n = lastSent.current;
    holdDelay.current = setTimeout(() => {
      holdRepeat.current = setInterval(() => {
        const next = clamp(n + dir * safeStep);
        if (next === n) {
          stopHold(); // 到边界停住
          return;
        }
        n = next;
        commit(n);
        setText(String(n));
      }, HOLD_INTERVAL);
    }, HOLD_DELAY);
  };

  const bump = (dir: 1 | -1) => {
    if (disabled) return;
    const next = commit(lastSent.current + dir * safeStep);
    setText(String(next));
  };

  /** 输入框：只留数字，合法即生效 */
  const onInput = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "").slice(0, 6);
    setText(digits);
    const n = parseInt(digits, 10);
    if (!Number.isNaN(n)) {
      // 未越界才即时提交；越界留到失焦时吸附，避免打字过程被截断
      if (n >= safeMin && n <= safeMax) commit(n);
    }
  };

  /** 失焦 / Enter 归一 */
  const settle = () => {
    const n = parseInt(text, 10);
    const final = Number.isNaN(n) ? lastSent.current : clamp(n);
    setEditing(false);
    commit(final);
    setText(String(final));
  };

  const canDec = !disabled && cur > safeMin;
  const canInc = !disabled && cur < safeMax;

  const btn =
    size === "sm"
      ? "grid h-8 w-8 shrink-0 place-items-center"
      : "grid h-9 w-9 shrink-0 place-items-center";
  const box = size === "sm" ? "h-8" : "h-9";
  const input =
    size === "sm"
      ? "w-9 text-[13px] font-semibold"
      : "w-11 text-sm font-semibold";

  return (
    <div
      data-ui="qty-stepper"
      className={`inline-flex items-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-bg)] transition-colors focus-within:border-[var(--color-ink-3)] ${box} ${
        disabled ? "opacity-50" : ""
      }`}
      style={{ touchAction: "manipulation" }}
    >
      <button
        type="button"
        data-ui="qty-dec"
        disabled={!canDec}
        aria-label={ariaLabel ? `${t.common.removeOne} · ${ariaLabel}` : t.common.removeOne}
        title={t.common.removeOne}
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={() => bump(-1)}
        className={`${btn} rounded-l-full text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)] active:bg-[var(--color-bg-muted)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent`}
      >
        <Minus className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.4} />
      </button>

      <input
        ref={inputRef}
        data-ui="qty-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        disabled={disabled}
        value={text}
        aria-label={ariaLabel ? `${t.common.quantity} · ${ariaLabel}` : t.common.quantity}
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => onInput(e.target.value)}
        onBlur={settle}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
            setText(String(cur));
            e.currentTarget.blur();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const next = commit(lastSent.current + safeStep);
            setText(String(next));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = commit(lastSent.current - safeStep);
            setText(String(next));
          }
        }}
        className={`${input} shrink-0 border-0 bg-transparent p-0 text-center tabular-nums text-[var(--color-ink)] outline-none disabled:cursor-not-allowed`}
      />

      <button
        type="button"
        data-ui="qty-inc"
        disabled={!canInc}
        aria-label={ariaLabel ? `${t.common.addOne} · ${ariaLabel}` : t.common.addOne}
        title={t.common.addOne}
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={() => bump(1)}
        className={`${btn} rounded-r-full text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)] active:bg-[var(--color-bg-muted)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent`}
      >
        <Plus className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.4} />
      </button>
    </div>
  );
}
