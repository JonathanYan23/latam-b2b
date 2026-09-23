import { PageSkeleton } from "@/components/ui/skeleton";

/** 订单列表骨架 */
export default function Loading() {
  return <PageSkeleton variant="list" count={4} />;
}
