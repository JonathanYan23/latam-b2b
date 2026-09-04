"use client";

import { useState, useTransition } from "react";
import { Check, X, Loader2, BadgeCheck } from "lucide-react";
import { fmt } from "@/i18n/utils";
import { currencySymbol } from "@/lib/currency";
import {
  approveCustomerAction,
  rejectCustomerAction,
  setCustomerPriceAction,
  removeCustomerPriceAction,
  updateRelationshipAction,
} from "./actions";
import type { Dict } from "@/i18n";

export function ApproveRejectButtons({
  relationshipId,
  t,
}: {
  relationshipId: string;
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await approveCustomerAction(relationshipId);
          })
        }
        className="btn btn-primary px-3 py-1.5 text-xs"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
        {t.wsCustomers.approve}
      </button>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await rejectCustomerAction(relationshipId);
          })
        }
        className="btn btn-secondary px-3 py-1.5 text-xs text-[var(--color-danger)]"
      >
        <X className="size-3.5" /> {t.wsCustomers.reject}
      </button>
    </div>
  );
}

/** 客户详情页：专属价表单 */
export function CustomerPriceForm({
  relationshipId,
  productId,
  existing,
  t,
  cur = "USD",
}: {
  relationshipId: string;
  productId: string;
  existing?: { price: number | null; moq: number | null };
  t: Dict;
  cur?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await setCustomerPriceAction(relationshipId, fd);
        })
      }
      className="flex flex-wrap items-center justify-end gap-x-2 gap-y-2"
    >
      <input name="productId" type="hidden" value={productId} />
      {/* 客户价 */}
      <div className="flex items-center gap-1.5">
        <span className="rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-subtle)] px-1.5 py-1.5 text-xs font-medium text-[var(--color-ink-3)]">
          {currencySymbol(cur)}
        </span>
        <input
          name="price"
          type="text"
          inputMode="decimal"
          required
          aria-label={t.common.price}
          defaultValue={existing?.price ?? ""}
          placeholder="0.00"
          className="input w-24 min-w-0 px-2 py-1.5 text-sm"
        />
      </div>
      {/* 起订量 */}
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-subtle)] px-1.5 py-1.5 text-xs font-medium text-[var(--color-ink-3)]">
          {t.common.moq}
        </span>
        <input
          name="moq"
          type="text"
          inputMode="numeric"
          aria-label={t.common.moq}
          defaultValue={existing?.moq ?? ""}
          placeholder="0"
          className="input w-16 min-w-0 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary px-3 py-1.5 text-xs"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {t.common.save}
      </button>
      <button
        type="button"
        disabled={pending || existing?.price == null}
        onClick={() =>
          startTransition(async () => {
            await removeCustomerPriceAction(relationshipId, productId);
          })
        }
        className="btn btn-ghost px-2 py-1.5 text-xs text-[var(--color-danger)] disabled:pointer-events-none disabled:opacity-40"
      >
        {t.common.remove}
      </button>
    </form>
  );
}

/** 客户详情页：条款设置表单 */
export function RelationshipSettingsForm({
  relationshipId,
  defaultValues,
  t,
}: {
  relationshipId: string;
  defaultValues: {
    tier: string;
    paymentTerms: string | null;
    creditLimit: string | null;
  };
  t: Dict;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await updateRelationshipAction(relationshipId, fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        })
      }
      className="mt-4 grid gap-4 sm:grid-cols-3"
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {t.wsCustomers.customerTier}
        </label>
        <select
          name="tier"
          defaultValue={defaultValues.tier}
          className="input py-2 text-sm"
        >
          <option value="STANDARD">{t.statusTier.STANDARD}</option>
          <option value="VIP">{t.statusTier.VIP}</option>
          <option value="GOLD">{t.statusTier.GOLD}</option>
          <option value="VOLUME">{t.statusTier.VOLUME}</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {t.wsCustomers.paymentTerms}
        </label>
        <select
          name="paymentTerms"
          defaultValue={defaultValues.paymentTerms ?? ""}
          className="input py-2 text-sm"
        >
          <option value="">{t.wsCustomers.termsFull}</option>
          <option value="NET7">NET7 · {fmt(t.wsCustomers.termsNet, { n: 7 })}</option>
          <option value="NET15">NET15 · {fmt(t.wsCustomers.termsNet, { n: 15 })}</option>
          <option value="NET30">NET30 · {fmt(t.wsCustomers.termsNet, { n: 30 })}</option>
          <option value="NET60">NET60 · {fmt(t.wsCustomers.termsNet, { n: 60 })}</option>
        </select>
        <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">
          {defaultValues.paymentTerms
            ? ""
            : t.wsCustomers.termsHintNone}
        </p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-2)]">
          {t.wsCustomers.creditUsd}
        </label>
        <input
          name="creditLimit"
          type="number"
          min="0"
          placeholder={t.wsCustomers.creditExample}
          defaultValue={defaultValues.creditLimit ?? ""}
          className="input py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary px-4 py-1.5 text-xs"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <BadgeCheck className="size-3.5" />
          )}
          {t.wsCustomers.saveTerms}
        </button>
        {saved && (
          <span className="text-xs text-[var(--color-success)]">
            {t.wsCustomers.saved}
          </span>
        )}
      </div>
    </form>
  );
}
