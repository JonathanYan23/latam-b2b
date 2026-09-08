"use client";

// 批发订单：多选 checkbox + 批量操作栏（导出选中 / 软删除选中）
// 跨组件共享选中集合（模块级 store + 订阅）

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileDown, Trash2, CheckSquare, Square } from "lucide-react";
import { deleteSupplierOrdersAction } from "./actions";
import { fmt } from "@/i18n/utils";
import type { Dict } from "@/i18n";

const selected = new Set<string>();
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function snapshot(): string {
  return Array.from(selected).join(",");
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function OrderCheckbox({ id }: { id: string }) {
  const sel = useSyncExternalStore(subscribe, snapshot, () => "");
  const checked = sel.split(",").includes(id);
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label="select order"
      onClick={(e) => e.stopPropagation()}
      onChange={() => {
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        emit();
      }}
      className="size-4 accent-[var(--color-ink)]"
    />
  );
}

export function OrdersBulkBar({
  visibleIds,
  activeIds,
  t,
}: {
  visibleIds: string[];
  activeIds: string[]; // 已完成/待处理等敏感状态订单（删除需额外强调）
  t: Dict;
}) {
  const router = useRouter();
  const sel = useSyncExternalStore(subscribe, snapshot, () => "");
  const ids = sel ? sel.split(",") : [];
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const lastTip = useRef<{ text: string; kind: "ok" | "err" } | null>(null);
  const [, bump] = useState(0);

  if (ids.length === 0) return null;
  const ws = t.wsOrders;

  const clear = () => {
    selected.clear();
    emit();
  };

  return (
    <div className="sticky bottom-4 z-30 mt-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 border-[var(--color-line-2)] bg-[var(--color-bg-card)]/95 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {fmt(ws.selectedCount, { n: ids.length })}
          </span>
          <button
            type="button"
            onClick={() => {
              const all = new Set(ids);
              visibleIds.forEach((v) => all.add(v));
              selected.clear();
              visibleIds.forEach((v) => selected.add(v));
              emit();
            }}
            className="btn btn-ghost inline-flex items-center gap-1 px-2.5 py-1.5 text-xs"
          >
            <CheckSquare className="size-3.5" /> {ws.selAll}
          </button>
          <button
            type="button"
            onClick={clear}
            className="btn btn-ghost inline-flex items-center gap-1 px-2.5 py-1.5 text-xs"
          >
            <Square className="size-3.5" /> {ws.clearSel}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {lastTip.current && (
            <span
              className={`text-xs ${
                lastTip.current.kind === "ok"
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]"
              }`}
            >
              {lastTip.current.text}
            </span>
          )}
          <a
            href={`/wholesaler/orders/export?ids=${ids.join(",")}`}
            target="_blank"
            className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
          >
            <FileDown className="size-3.5" /> {ws.exportSelected}
          </a>
          <button
            type="button"
            onClick={() => {
              lastTip.current = null;
              bump((x) => x + 1);
              setConfirming(true);
            }}
            className="btn inline-flex items-center gap-1.5 border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 px-3 py-2 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white"
          >
            <Trash2 className="size-3.5" /> {ws.delSelected}
          </button>
        </div>
      </div>

      {/* 二次确认弹窗：红色确认按钮 */}
      {confirming && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setConfirming(false)}
        >
          <div
            className="card w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--color-danger)]">
              <span aria-hidden>⚠</span> {ws.batchDelTitle}
            </h3>
            <p className="text-meta mt-3 text-sm leading-relaxed">
              {fmt(ws.batchDelWarn, { n: ids.length })}
            </p>
            {ids.some((i) => activeIds.includes(i)) && (
              <p className="mt-2 rounded-md bg-[#fef3c7] px-3 py-2 text-xs text-[#92400e]">
                {ws.batchDelActiveWarn}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className="btn btn-secondary px-4 py-2 text-sm"
              >
                {ws.cancelBtn}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  lastTip.current = null;
                  startTransition(async () => {
                    const res = await deleteSupplierOrdersAction(ids);
                    if (!res.ok) {
                      lastTip.current = { text: res.error ?? "failed", kind: "err" };
                    } else {
                      lastTip.current = {
                        text: fmt(ws.removedTip, { n: res.deleted ?? ids.length }),
                        kind: "ok",
                      };
                      ids.forEach((i) => selected.delete(i));
                      emit();
                    }
                    setConfirming(false);
                    bump((x) => x + 1);
                    router.refresh();
                  });
                }}
                className="btn bg-[var(--color-danger)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {ws.confirmDelBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
