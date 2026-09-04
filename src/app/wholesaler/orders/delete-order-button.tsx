"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteSupplierOrderAction } from "./actions";
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

  // 非可删状态（已确认/备货/就绪/完成/有发票/有收款）不给入口
  if (!deletable) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `${t.wsOrders.deleteTitle}\n\n${t.wsOrders.deleteConfirm}\n\n#${orderNumber}`,
          )
        )
          return;
        startTransition(async () => {
          const res = await deleteSupplierOrderAction(supplierOrderId);
          if (!res.ok) window.alert(res.error);
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
