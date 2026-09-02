"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updatePolicyAction } from "./actions";
import type { Dict } from "@/i18n";

export function PolicyForm({
  current,
  t,
}: {
  current: number | null;
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
      <div className="w-48">
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {t.wsAccount.minOrderAmount}
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
