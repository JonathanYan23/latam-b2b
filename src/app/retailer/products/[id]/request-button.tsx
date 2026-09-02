"use client";

import { useTransition } from "react";
import { Loader2, Clock } from "lucide-react";
import { requestCustomerPricing } from "../../actions";
import type { Dict } from "@/i18n";

export function RequestPricingButton({
  wholesalerId,
  status,
  t,
}: {
  wholesalerId: string;
  status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();

  if (status === "APPROVED") {
    return (
      <span className="badge badge-success px-4 py-2 text-sm">
        {t.product.approvedBadge}
      </span>
    );
  }

  if (status === "PENDING") {
    return (
      <span className="badge badge-warning px-4 py-2 text-sm">
        <Clock className="size-3.5" />
        {t.product.pendingBadge}
      </span>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await requestCustomerPricing(wholesalerId);
        })
      }
      className="btn btn-secondary w-full py-2.5 text-sm"
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {status === "REJECTED" ? t.product.reapply : t.product.requestPricing}
    </button>
  );
}
