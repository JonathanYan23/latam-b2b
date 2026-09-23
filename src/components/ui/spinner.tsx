"use client";

import { Loader2 } from "lucide-react";

/** 统一的加载指示器（品牌灰，尺寸可选） */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}
