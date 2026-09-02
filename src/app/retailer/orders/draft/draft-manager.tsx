"use client";

import { useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  adjustDraftItemAction,
  removeDraftItemAction,
  submitDraftAction,
} from "../../draft-actions";
import { fmt } from "@/i18n/utils";
import type { Dict } from "@/i18n";
import { money } from "@/lib/format";

export interface DraftGroup {
  id: string;
  wholesalerName: string;
  contact?: string | null;
  items: {
    id: string;
    productId: string;
    name: string;
    image?: string | null;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    minOrderAmount?: number | null;
    moq: number;
    stock: number;
  }[];
  subtotal: number;
}

/** 草稿订单管理：上下调量/删除/提交（紧凑单框控件） */
export function DraftManager({
  orderId,
  groups,
  total,
  t,
  currency = "USD",
}: {
  orderId: string;
  groups: DraftGroup[];
  total: number;
  t: Dict;
  currency?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const adjust = (productId: string, delta: number) =>
    startTransition(async () => {
      await adjustDraftItemAction(orderId, productId, delta);
      router.refresh();
    });
  const remove = (productId: string) =>
    startTransition(async () => {
      await removeDraftItemAction(orderId, productId);
      router.refresh();
    });
  const submit = () =>
    startTransition(async () => {
      const res = await submitDraftAction(orderId);
      if (!res.ok) {
        alert(res.error ?? t.orders.errCancel);
        return;
      }
      router.push(`/retailer/orders/${res.orderId}`);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line-2)] px-5 py-3">
            <div>
              <p className="text-sm font-medium">{g.wholesalerName}</p>
              {g.contact && (
                <p className="text-meta text-[11px]">
                  {t.common.contactPerson}: {g.contact}
                </p>
              )}
            </div>
            <p className="text-sm font-semibold">{money(g.subtotal, currency)}</p>
          </div>

          <div className="divide-y divide-[var(--color-line-2)]">
            {g.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-[var(--color-bg-muted)]">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-meta text-[11px]">
                    {money(item.unitPrice, currency)} × {item.quantity} · {t.common.moq}{" "}
                    {item.moq}
                  </p>
                </div>

                {/* 上下调量（单框） */}
                <div className="flex w-9 shrink-0 flex-col items-center overflow-hidden rounded-md border border-[var(--color-line)]">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => adjust(item.productId, 1)}
                    className="flex w-full items-center justify-center py-0.5 text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                  >
                    <Plus className="size-3" />
                  </button>
                  <span className="w-full border-y border-[var(--color-line-2)] py-0.5 text-center text-xs font-medium tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => adjust(item.productId, -1)}
                    className="flex w-full items-center justify-center py-0.5 text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                  >
                    <Minus className="size-3" />
                  </button>
                </div>

                <p className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {money(item.subtotal, currency)}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(item.productId)}
                  className="shrink-0 rounded p-1 text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-danger)]"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 提交栏 */}
      <div className="card sticky bottom-20 flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center md:bottom-4">
        <div>
          <p className="text-lg font-semibold tabular-nums">{money(total, currency)}</p>
          <p className="text-meta text-xs">
            {fmt(t.orders.masterDesc, { n: groups.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/retailer/browse" className="btn btn-secondary px-4 py-2 text-sm">
            {t.retailerHome.browseCta}
          </Link>
          <button
            onClick={submit}
            disabled={pending || groups.length === 0}
            className="btn btn-primary px-6 py-2.5 text-sm"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {t.cart.placeOrder}
          </button>
        </div>
      </div>
    </div>
  );
}
