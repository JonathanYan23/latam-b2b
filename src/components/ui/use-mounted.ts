"use client";

import { useEffect, useState } from "react";

/**
 * 挂载标记：仅在浏览器端首次渲染后返回 true。
 * 用于规避 portal / 依赖 window 的组件在 SSR 期间渲染导致的水合不一致。
 */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
