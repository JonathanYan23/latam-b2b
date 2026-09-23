import { Skeleton, SkeletonTitle } from "@/components/ui/skeleton";

/** 逛市场：商品网格骨架 */
export default function Loading() {
  return (
    <div className="animate-fade-in pt-2">
      <SkeletonTitle />
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" rounded="rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card overflow-hidden p-3">
            <Skeleton className="h-40 w-full" rounded="rounded-xl" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="mt-1 h-8 w-full" rounded="rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
