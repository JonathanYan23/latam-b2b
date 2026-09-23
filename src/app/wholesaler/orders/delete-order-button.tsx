"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteSupplierOrderAction } from "./actions";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { fmt } from "@/i18n/utils";
import type { Dict } from "@/i18n";

/** 批发商订单列表删除按钮：先展示「删除后果」确认，再执行 */
export function DeleteOrderButton({
  supplierOrderId,
  orderNumber,
  deletable,
  t,
}: {
  supplierOrderId: string;
  orderNumber: string;
  deletable: boolean;
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  // 非可删状态（已确认/备货/就绪/完成/有发票/有收款）不给入口
  if (!deletable) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        // 软删除确认：明确「前台隐藏、后台保留可恢复」
        const ok = await confirm({
          title: t.wsOrders.deleteTitle,
          description: fmt(t.wsOrders.deleteDesc, { n: orderNumber }),
          confirmText: t.wsOrders.deleteOrder,
          variant: "danger",
        });
        if (!ok) return;
        startTransition(async () => {
          const res = await deleteSupplierOrderAction(supplierOrderId);
          if (!res.ok) toast.error(res.error || t.ui.networkError);
          else toast.success(fmt(t.wsOrders.removedTip, { n: 1 }));
        });
      }}
      className="btn btn-ghost inline-flex items-center gap-1.5 border border-[var(--color-line-2)] px-2.5 py-1.5 text-xs text-[var(--color-danger)] hover:border-[var(--color-danger)]/40 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      {t.wsOrders.deleteOrder}
    </button>
  );
}
