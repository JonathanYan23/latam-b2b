"use client";

import { useState, useActionState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, ShoppingBag, ArrowLeft, MailCheck } from "lucide-react";
import { loginAction, registerAction, requestVerificationAction } from "./actions";
import { currencySymbol } from "@/lib/currency";
import { fmt } from "@/i18n/utils";
import type { Dict } from "@/i18n";

interface CountryOption {
  code: string;
  label: string;
  currency: string;
}

type CodePhase = {
  status: "idle" | "sending" | "sent" | "error";
  msg?: string;
  devCode?: string;
};

function AuthForm({
  t,
  countries,
}: {
  t: Dict;
  countries: CountryOption[];
}) {
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

  // ---- 邮箱验证码状态 ----
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [codeState, setCodeState] = useState<CodePhase>({ status: "idle" });
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [countdown]);

  const selCountry = countries.find((c) => c.code === country);

  async function handleSendCode() {
    if (!email.trim() || codeState.status === "sending") return;
    setCodeState({ status: "sending" });
    const r = await requestVerificationAction(email);
    if (!r.ok) {
      setCodeState({ status: "error", msg: r.error });
      return;
    }
    setCodeState({
      status: "sent",
      devCode: r.devCode,
      msg: fmt(t.auth.codeSent, { email: email.trim() }),
    });
    setCountdown(60);
  }

  const registerMode = mode === "register";

  return (
    <div className="mx-auto w-full max-w-sm px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.auth.backToHome}
      </Link>

      <h1 className="text-h1">
        {registerMode ? t.auth.createAccount : t.auth.welcomeBack}
      </h1>
      <p className="text-body mt-2">
        {registerMode ? t.auth.registerDesc : t.auth.loginDesc}
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
        {registerMode && (
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

        {registerMode && (
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

        {registerMode && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
                {t.auth.country}
              </label>
              <select
                name="countryId"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={`input ${country ? "" : "text-[var(--color-ink-3)]"}`}
                required
              >
                <option value="">{t.auth.chooseCountry}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              {selCountry && (
                <p className="mt-1.5 text-xs text-[var(--color-ink-3)]">
                  {fmt(t.auth.currencyNote, {
                    symbol: currencySymbol(selCountry.currency),
                    code: selCountry.currency,
                  })}
                </p>
              )}
            </div>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {t.auth.email}
          </label>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
          {registerMode && (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleSendCode}
                disabled={
                  codeState.status === "sending" || countdown > 0 || !email.trim()
                }
                className="btn btn-secondary w-full py-2 text-sm disabled:opacity-50"
              >
                {codeState.status === "sending"
                  ? t.auth.pleaseWait
                  : countdown > 0
                    ? fmt(t.auth.resendIn, { s: String(countdown) })
                    : t.auth.sendCode}
              </button>
              {codeState.status === "sent" && codeState.msg && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-ok, #15803d)] animate-fade-in">
                  <MailCheck className="size-3.5" /> {codeState.msg}
                </p>
              )}
              {codeState.status === "sent" && codeState.devCode && (
                <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  {fmt(t.auth.devCodeNote, { code: codeState.devCode })}
                </p>
              )}
              {codeState.status === "error" && codeState.msg && (
                <p className="mt-1.5 text-xs text-[#b91c1c]">{codeState.msg}</p>
              )}
            </div>
          )}
        </div>

        {registerMode && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
              {t.auth.codePlaceholder}
            </label>
            <input
              name="verificationCode"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              className="input font-mono tracking-[0.5em]"
              placeholder="000000"
              autoComplete="one-time-code"
              required
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-2)]">
            {t.auth.password}
          </label>
          <input
            name="password"
            type="password"
            className="input"
            placeholder={
              registerMode ? t.auth.passwordHint : "••••••••"
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
            : registerMode
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
