import { Skeleton, SkeletonTitle } from "@/components/ui/skeleton";

/** 商品管理：表格骨架 */
export default function Loading() {
  return (
    <div className="animate-fade-in pt-2">
      <SkeletonTitle />
      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--color-line-2)] px-4 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-[var(--color-line-2)] px-4 py-3.5 last:border-0"
          >
            <Skeleton className="size-10 shrink-0" rounded="rounded-lg" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-6 w-14" rounded="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
