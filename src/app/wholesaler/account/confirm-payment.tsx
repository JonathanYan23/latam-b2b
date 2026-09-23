"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { confirmPaymentAction } from "./actions";
import { useToast } from "@/components/ui/toast";
import type { Dict } from "@/i18n";

/** 确认收款：填写经手人姓名后确认（防同名混淆/留痕） */
export function ConfirmPaymentButton({
  paymentId,
  defaultName,
  t,
}: {
  paymentId: string;
  defaultName: string;
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const toast = useToast();

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.wsAccount.confirmName}
        className="input w-36 px-2 py-1.5 text-xs"
      />
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await confirmPaymentAction(paymentId, name);
            if (!res.ok) toast.error(res.error ?? t.wsAccount.errNotFound);
            else toast.success(t.wsAccount.confirmReceived);
          })
        }
        className="btn btn-primary px-3 py-1.5 text-xs"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
        {t.wsAccount.confirmReceived}
      </button>
    </div>
  );
}
