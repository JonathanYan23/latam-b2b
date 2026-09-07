"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Save } from "lucide-react";
import { saveBusinessProfileAction } from "./actions";
import type { Dict } from "@/i18n";

export interface BusinessDraft {
  tradeName: string | null;
  legalName: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  taxId: string | null;
}

export function BusinessProfileForm({
  business,
  t,
}: {
  business?: BusinessDraft;
  t: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const k = t.wsAccount;

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const res = await saveBusinessProfileAction(fd);
          if (!res.ok) {
            setError(res.error ?? "error");
            return;
          }
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          router.refresh();
        })
      }
      className="mt-5 grid gap-4 sm:grid-cols-2"
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {k.tradeName} *
        </label>
        <input
          name="tradeName"
          required
          defaultValue={business?.tradeName ?? ""}
          placeholder={k.tradeNameHint}
          className="input py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {k.legalName}
        </label>
        <input
          name="legalName"
          defaultValue={business?.legalName ?? ""}
          className="input py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {k.phone}
        </label>
        <input
          name="phone"
          defaultValue={business?.phone ?? ""}
          className="input py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {k.website}
        </label>
        <input
          name="website"
          type="url"
          defaultValue={business?.website ?? ""}
          placeholder="https://"
          className="input py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {k.taxId}
        </label>
        <input
          name="taxId"
          defaultValue={business?.taxId ?? ""}
          className="input py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {k.address}
        </label>
        <input
          name="address"
          defaultValue={business?.address ?? ""}
          className="input py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary px-4 py-2 text-sm"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {t.common.update}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-[var(--color-success)]">
            <Check className="size-4" /> {k.profileSaved}
          </span>
        )}
        {error && (
          <span className="text-sm text-[var(--color-danger)]">{error}</span>
        )}
      </div>
    </form>
  );
}
