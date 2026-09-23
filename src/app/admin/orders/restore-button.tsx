"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { restoreSupplierOrderAction } from "../../wholesaler/orders/actions";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import type { Dict } from "@/i18n";

/** 平台管理端：恢复被批发商软删除的订单 */
export function AdminRestoreButton({
  supplierOrderId,
  label,
  t,
}: {
  supplierOrderId: string;
  label: string;
  t: Dict;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: label,
          description: t.admin.restoreConfirmDesc,
          confirmText: label,
        });
        if (!ok) return;
        startTransition(async () => {
          await restoreSupplierOrderAction(supplierOrderId);
          router.refresh();
          toast.success(t.admin.restoredTip);
        });
      }}
      className="btn btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
    >
      {pending && <Loader2 className="size-3 animate-spin" />}
      {label}
    </button>
  );
}
