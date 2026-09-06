"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updatePolicyAction } from "./actions";
import { currencySymbol } from "@/lib/currency";
import type { Dict } from "@/i18n";

export function PolicyForm({
  current,
  cur,
  t,
}: {
  current: number | null;
  cur?: string;
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await updatePolicyAction(fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        })
      }
      className="mt-4 flex flex-wrap items-end gap-3"
    >
      <div className="w-52">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-2)]">
          {t.wsAccount.minOrderAmount}
          <span className="rounded border border-[var(--color-line-2)] bg-[var(--color-bg-subtle)] px-1 py-px text-[10px] text-[var(--color-ink-3)]">
            {currencySymbol(cur)}
          </span>
        </label>
        <input
          name="minOrderAmount"
          type="number"
          step="0.01"
          min="0"
          placeholder={t.wsAccount.minOrderHint}
          defaultValue={current ?? ""}
          className="input py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary px-4 py-2 text-xs"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : t.common.save}
      </button>
      {saved && (
        <span className="text-xs text-[var(--color-success)]">
          {t.wsAccount.policySaved}
        </span>
      )}
    </form>
  );
}
