"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { recordPaymentAction } from "./actions";
import type { Dict } from "@/i18n";

export function PaymentForm({
  wholesalers,
  t,
}: {
  wholesalers: { id: string; name: string; outstanding: number }[];
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          setDone(false);
          const res = await recordPaymentAction(fd);
          if (!res.ok) setError(res.error ?? "Failed");
          else {
            setDone(true);
            (document.getElementById("payment-form") as HTMLFormElement)?.reset();
          }
        })
      }
      id="payment-form"
      className="space-y-4"
    >
      {error && (
        <p className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
          {error}
        </p>
      )}
      {done && (
        <p className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm text-[#15803d]">
          {t.retailerAccount.recordedMsg}
        </p>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
          {t.retailerAccount.payTo}
        </label>
        <select name="wholesalerId" className="input" required>
          <option value="">{t.retailerAccount.selectWs}</option>
          {wholesalers.map((w) => (
            <option key={w.id} value={w.id}>
              {t.retailerAccount.wsOption
                .replace("{name}", w.name)
                .replace("{amount}", `$${w.outstanding.toFixed(2)}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {t.retailerAccount.amountUsd}
          </label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            className="input"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {t.retailerAccount.method}
          </label>
          <select name="method" className="input" defaultValue="BANK_TRANSFER">
            <option value="BANK_TRANSFER">{t.retailerAccount.bankTransfer}</option>
            <option value="CASH">{t.retailerAccount.cash}</option>
            <option value="CARD">{t.retailerAccount.card}</option>
            <option value="OTHER">{t.retailerAccount.other}</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
          {t.retailerAccount.notes}
        </label>
        <input
          name="notes"
          className="input"
          placeholder={t.retailerAccount.notesPlaceholder}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full py-2.5 text-sm"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {t.retailerAccount.recordBtn}
      </button>
      <p className="text-meta text-xs">{t.retailerAccount.pendingNote}</p>
    </form>
  );
}
