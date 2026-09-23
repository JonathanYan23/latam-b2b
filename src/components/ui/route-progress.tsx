"use client";

/**
 * RouteProgress —— 顶部路由切换进度条（出厂级动效）
 *
 * - 点击站内链接即启动，路径变化后收尾
 * - 导航期间临时关闭 html 的平滑滚动，避免"先滑到顶部再渲染新页"的错位感
 * - 纯视觉反馈，不拦截导航；portal 到 body 保证层级最高
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useClientMounted } from "./use-mounted";

/** 长时间未收到路径变化时的兜底隐藏（毫秒） */
const SAFETY_MS = 9000;

export function RouteProgress() {
  const pathname = usePathname();
  const mounted = useClientMounted();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timers = useRef<number[]>([]);
  const active = useRef(false);
  const firstRender = useRef(true);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const restoreScroll = useCallback(() => {
    document.documentElement.style.scrollBehavior = "";
  }, []);

  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    setProgress(100);
    timers.current.push(
      window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
        restoreScroll();
      }, 260),
    );
  }, [clearTimers, restoreScroll]);

  // start 内部需要调用最新的 finish，用 ref 打破循环依赖
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const start = useCallback(() => {
    if (active.current) return;
    active.current = true;
    clearTimers();
    // 导航期间禁用平滑滚动，保证新页面即时归位
    document.documentElement.style.scrollBehavior = "auto";
    setVisible(true);
    setProgress(8);
    [
      [110, 34],
      [360, 58],
      [820, 76],
      [1600, 88],
    ].forEach(([delay, value]) => {
      timers.current.push(
        window.setTimeout(() => setProgress(value as number), delay as number),
      );
    });
    // 兜底：导航未完成时也要收回进度条
    timers.current.push(window.setTimeout(() => finishRef.current(), SAFETY_MS));
  }, [clearTimers]);

  // 站内链接点击 → 启动
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith(location.origin)) {
        return; // 外链 / mailto / tel
      }
      try {
        const url = new URL(href, location.href);
        if (url.pathname === location.pathname && url.search === location.search) {
          return; // 同页无变化
        }
      } catch {
        /* ignore */
      }
      start();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  // 路径变化 → 收尾
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    finish();
  }, [pathname, finish]);

  useEffect(
    () => () => {
      clearTimers();
      restoreScroll();
    },
    [clearTimers, restoreScroll],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden
      data-ui="route-progress"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2.5px] transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full rounded-r-full bg-[var(--color-primary)] shadow-[0_0_8px_rgba(0,113,227,.55)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>,
    document.body,
  );
}
