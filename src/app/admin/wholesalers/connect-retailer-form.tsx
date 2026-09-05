"use client";

import { useState, useTransition } from "react";
import { Loader2, Link2 } from "lucide-react";
import { adminConnectAction } from "@/app/admin/actions";
import type { Dict } from "@/i18n";

/** 后台直接连接批发商 ↔ 零售商 */
export function ConnectRetailerForm({
  wholesalerId,
  retailers,
  t,
}: {
  wholesalerId: string;
  retailers: { id: string; name: string }[];
  t: Dict;
}) {
  const [retailerId, setRetailerId] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      action={() => {
        if (!retailerId) return;
        setMsg(null);
        startTransition(async () => {
          const res = await adminConnectAction(wholesalerId, retailerId);
          setMsg(res.ok ? t.admin.connectSuccess : t.admin.selectRetailer);
          if (res.ok) setRetailerId("");
        });
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <select
        value={retailerId}
        onChange={(e) => setRetailerId(e.target.value)}
        className="input w-64 py-2 text-sm"
      >
        <option value="">{t.admin.selectRetailer}</option>
        {retailers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || !retailerId}
        className="btn btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
        {t.admin.connectRetailer}
      </button>
      {msg && <span className="text-xs text-[var(--color-success)]">{msg}</span>}
    </form>
  );
}
