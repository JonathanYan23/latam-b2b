"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { restoreSupplierOrderAction } from "../../wholesaler/orders/actions";

/** 平台管理端：恢复被批发商软删除的订单 */
export function AdminRestoreButton({
  supplierOrderId,
  label,
}: {
  supplierOrderId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(label)) return;
        startTransition(async () => {
          await restoreSupplierOrderAction(supplierOrderId);
          router.refresh();
        });
      }}
      className="btn btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
    >
      {pending && <Loader2 className="size-3 animate-spin" />}
      {label}
    </button>
  );
}
