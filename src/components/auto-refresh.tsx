"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 轻量自动刷新：周期调用 router.refresh() 重取当前路由 RSC 数据，
 * 让另一端的状态/金额/未读变化无需手动刷新即可同步（近似实时）。
 */
export function AutoRefresh({ intervalMs = 8000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
