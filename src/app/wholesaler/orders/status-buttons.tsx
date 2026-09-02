"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { updateSupplierOrderStatusAction } from "./actions";
import type { Dict } from "@/i18n";

export function StatusFlowButtons({
  supplierOrderId,
  current,
  t,
}: {
  supplierOrderId: string;
  current: OrderStatus;
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();
  const o = t.wsOrders;

  const actions: { to: OrderStatus; label: string }[] = [];
  if (current === "SUBMITTED") actions.push({ to: "CONFIRMED", label: o.confirm });
  if (current === "CONFIRMED") actions.push({ to: "PREPARING", label: o.preparing });
  if (current === "PREPARING") actions.push({ to: "READY", label: o.ready });
  if (current === "READY") actions.push({ to: "COMPLETED", label: o.complete });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a.to}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updateSupplierOrderStatusAction(supplierOrderId, a.to);
              if (!res.ok) alert(res.error ?? "Failed");
            })
          }
          className="btn btn-primary px-4 py-1.5 text-xs"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {a.label}
        </button>
      ))}
      {(current === "SUBMITTED" ||
        current === "CONFIRMED" ||
        current === "PREPARING" ||
        current === "READY") && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updateSupplierOrderStatusAction(
                supplierOrderId,
                "CANCELLED",
              );
              if (!res.ok) alert(res.error ?? "Failed");
            })
          }
          className="btn btn-secondary px-3 py-1.5 text-xs text-[var(--color-danger)]"
        >
          {o.cancel}
        </button>
      )}
    </div>
  );
}
