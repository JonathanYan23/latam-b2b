"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban } from "lucide-react";
import { cancelSupplierOrderAction } from "./actions";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
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
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: t.orders.cancel,
          description: t.orders.cancelConfirmDesc,
          confirmText: t.orders.cancel,
          variant: "danger",
        });
        if (!ok) return;
        startTransition(async () => {
          const res = await cancelSupplierOrderAction(supplierOrderId);
          if (!res.ok) toast.error(res.error ?? t.orders.errCancel);
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
