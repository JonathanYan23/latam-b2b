"use client";

/**
 * Skeleton —— 加载骨架屏基元
 *
 * 页面切换时用内容形状的占位替代白屏，降低等待焦虑（出厂级体感）。
 */
export function Skeleton({
  className = "",
  rounded = "rounded-lg",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-[var(--color-line-2)] ${rounded} ${className}`}
    />
  );
}

/** 页面标题 + 副标题占位 */
export function SkeletonTitle() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

/** 卡片网格占位（商品卡 / 概览卡） */
export function SkeletonCards({
  count = 6,
  className = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
  height = "h-44",
}: {
  count?: number;
  className?: string;
  height?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden p-3">
          <Skeleton className={`${height} w-full`} rounded="rounded-xl" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 列表行占位（订单 / 客户 / 消息） */
export function SkeletonList({
  count = 5,
  height = "h-[72px]",
}: {
  count?: number;
  height?: string;
}) {
  return (
    <div className="card divide-y divide-[var(--color-line-2)] overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3.5 px-4 ${height}`}>
          <Skeleton className="size-11 shrink-0" rounded="rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" rounded="rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** 通用页面骨架：标题 + 内容区 */
export function PageSkeleton({
  variant = "cards",
  count = 6,
}: {
  variant?: "cards" | "list";
  count?: number;
}) {
  return (
    <div className="animate-fade-in pt-2">
      <SkeletonTitle />
      <div className="mt-7">
        {variant === "cards" ? (
          <SkeletonCards count={count} />
        ) : (
          <SkeletonList count={count} />
        )}
      </div>
    </div>
  );
}

/**
 * 门户内容区骨架：标题 + 统计卡行 + 列表/卡片
 * 用于各门户根级 loading.tsx，切页时 shell（顶栏/底部导航）保留，仅内容区占位。
 */
export function PortalSkeleton({
  variant = "list",
  rows = 5,
}: {
  variant?: "cards" | "list";
  rows?: number;
}) {
  return (
    <div className="animate-fade-in pt-2">
      <SkeletonTitle />

      {/* 统计卡行 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card px-4 py-3.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2.5 h-5 w-24" />
          </div>
        ))}
      </div>

      <div className="mt-6">
        {variant === "cards" ? (
          <SkeletonCards count={8} />
        ) : (
          <SkeletonList count={rows} />
        )}
      </div>
    </div>
  );
}
