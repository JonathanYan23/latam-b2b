"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Wallet, ShieldCheck } from "lucide-react";
import type { Dict } from "@/i18n";

/** 顶栏账户菜单（头像下拉：账户与账款 / 账户安全 / 退出） */
export function AccountMenu({
  role,
  name,
  email,
  t,
}: {
  role: "retailer" | "wholesaler";
  name?: string | null;
  email?: string | null;
  t: Dict;
}) {
  const [open, setOpen] = useState(false);
  const initial = (name ?? email ?? "U").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="grid size-8 place-items-center rounded-full bg-[var(--color-ink)] text-xs font-semibold text-white transition-transform hover:scale-105"
      >
        {initial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="card absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden p-0">
            <div className="border-b border-[var(--color-line-2)] px-4 py-3">
              <p className="truncate text-sm font-semibold">{name ?? "—"}</p>
              <p className="text-meta truncate text-xs">{email ?? ""}</p>
            </div>
            <div className="p-1.5">
              <Link
                href={role === "retailer" ? "/retailer#finance" : `/${role}/account`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
              >
                <Wallet className="size-4" /> {t.security.menuAccount}
              </Link>
              <Link
                href={`/${role}/security`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
              >
                <ShieldCheck className="size-4" /> {t.security.menuSecurity}
              </Link>
            </div>
            <div className="border-t border-[var(--color-line-2)] p-1.5">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-danger)]"
              >
                <LogOut className="size-4" /> {t.common.signOut}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
