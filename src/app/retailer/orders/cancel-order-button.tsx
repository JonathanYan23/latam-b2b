"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban } from "lucide-react";
import { cancelSupplierOrderAction } from "./actions";
import type { Dict } from "@/i18n";

/** 零售商在订单详情中撤回（仅 SUBMITTED） */
export function CancelOrderButton({
  supplierOrderId,
  t,
}: {
  supplierOrderId: string;
  t: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t.orders.cancel + "?")) return;
        startTransition(async () => {
          const res = await cancelSupplierOrderAction(supplierOrderId);
          if (!res.ok) alert(res.error ?? t.orders.errCancel);
          router.refresh();
        });
      }}
      className="btn btn-secondary px-3 py-1.5 text-xs text-[var(--color-danger)]"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Ban className="size-3.5" />
      )}
      {t.orders.cancel}
    </button>
  );
}
