"use client";

import { useState, useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, ShoppingBag, ArrowLeft } from "lucide-react";
import { loginAction, registerAction } from "./actions";
import type { Dict } from "@/i18n";

function AuthForm({ t }: { t: Dict }) {
  const params = useSearchParams();
  const initialMode =
    params.get("mode") === "register" ? "register" : "login";
  const initialRole =
    params.get("role") === "wholesaler" ? "wholesaler" : "retailer";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [role, setRole] = useState<"retailer" | "wholesaler">(initialRole);

  const [state, formAction, pending] = useActionState(
    mode === "register" ? registerAction : loginAction,
    undefined,
  );

  return (
    <div className="mx-auto w-full max-w-sm px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.auth.backToHome}
      </Link>

      <h1 className="text-h1">
        {mode === "register" ? t.auth.createAccount : t.auth.welcomeBack}
      </h1>
      <p className="text-body mt-2">
        {mode === "register" ? t.auth.registerDesc : t.auth.loginDesc}
      </p>

      {/* 登录 / 注册切换 */}
      <div className="mt-8 grid grid-cols-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-muted)] p-1 text-sm">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md py-2 font-medium transition-all ${
              mode === m
                ? "bg-white text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]"
            }`}
          >
            {m === "login" ? t.common.signIn : t.common.register}
          </button>
        ))}
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
                {t.auth.yourName}
              </label>
              <input
                name="fullName"
                className="input"
                placeholder="Maria Rodriguez"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
                {t.auth.businessName}
              </label>
              <input
                name="businessName"
                className="input"
                placeholder="Mi Tienda SRL"
                required
              />
            </div>
          </>
        )}

        {mode === "register" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
              {t.auth.iAmA}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    key: "retailer",
                    icon: ShoppingBag,
                    label: t.auth.retailerRole,
                    desc: t.auth.retailerRoleDesc,
                  },
                  {
                    key: "wholesaler",
                    icon: Package,
                    label: t.auth.wholesalerRole,
                    desc: t.auth.wholesalerRoleDesc,
                  },
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setRole(o.key)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-all ${
                    role === o.key
                      ? "border-[var(--color-ink)] bg-[var(--color-bg-subtle)]"
                      : "border-[var(--color-line)] hover:border-[var(--color-ink-3)]"
                  }`}
                >
                  <o.icon className="size-4 text-[var(--color-ink-2)]" />
                  <span className="mt-1 text-sm font-medium">{o.label}</span>
                  <span className="text-xs text-[var(--color-ink-3)]">
                    {o.desc}
                  </span>
                </button>
              ))}
            </div>
            <input type="hidden" name="role" value={role} />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {t.auth.email}
          </label>
          <input
            name="email"
            type="email"
            className="input"
            placeholder="you@company.com"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {t.auth.password}
          </label>
          <input
            name="password"
            type="password"
            className="input"
            placeholder={
              mode === "register" ? t.auth.passwordHint : "••••••••"
            }
            minLength={6}
            required
          />
        </div>

        {state?.error && (
          <p className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c] animate-fade-in">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-full py-2.5 text-sm"
        >
          {pending
            ? t.auth.pleaseWait
            : mode === "register"
              ? t.auth.createBtn
              : t.auth.signInBtn}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--color-ink-3)]">
        {t.auth.termsNote}
      </p>
    </div>
  );
}

export { AuthForm };
