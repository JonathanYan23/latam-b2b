"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { updatePasswordAction } from "@/lib/password-actions";
import type { Dict } from "@/i18n";

/** 账户与安全（两门户共用）：资料 + 改密 + 安全项占位 */
export function AccountSecurity({
  t,
  name,
  email,
  role,
  currency,
  businessName,
}: {
  t: Dict;
  name?: string | null;
  email?: string | null;
  role: string;
  currency?: string | null;
  businessName?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <h1 className="text-h1">{t.security.title}</h1>
      <p className="text-body mt-1">{t.security.desc}</p>

      {/* 个人资料 */}
      <div className="card mt-8 p-6">
        <h2 className="text-h3 text-[15px]">{t.security.profile}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-meta text-xs">{t.admin.name}</dt>
            <dd className="mt-0.5 font-medium">{name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-meta text-xs">{t.admin.email}</dt>
            <dd className="mt-0.5 font-medium">{email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-meta text-xs">{t.admin.role}</dt>
            <dd className="mt-0.5">
              <span className="badge badge-neutral">{role}</span>
            </dd>
          </div>
          <div>
            <dt className="text-meta text-xs">{t.security.business}</dt>
            <dd className="mt-0.5 font-medium">{businessName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-meta text-xs">{t.security.accountCurrency}</dt>
            <dd className="mt-0.5 font-medium">{currency ?? "—"}</dd>
          </div>
        </dl>
      </div>

      {/* 修改密码 */}
      <div className="card mt-6 p-6">
        <h2 className="text-h3 text-[15px]">{t.security.changePassword}</h2>
        <form
          action={(fd) =>
            startTransition(async () => {
              setError(null);
              setOk(false);
              const res = await updatePasswordAction(fd);
              if (!res.ok) setError(res.error ?? "error");
              else {
                setOk(true);
                setTimeout(() => setOk(false), 2500);
              }
            })
          }
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <input
            name="current"
            type="password"
            required
            placeholder={t.security.currentPassword}
            className="input sm:col-span-2"
            autoComplete="current-password"
          />
          <input
            name="next"
            type="password"
            required
            minLength={6}
            placeholder={t.security.newPassword}
            className="input"
            autoComplete="new-password"
          />
          <input
            name="confirm"
            type="password"
            required
            minLength={6}
            placeholder={t.security.confirmPassword}
            className="input"
            autoComplete="new-password"
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary px-4 py-2 text-sm"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : t.common.save}
            </button>
            {ok && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)]">
                <CheckCircle2 className="size-4" /> {t.security.passwordChanged}
              </span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-danger)]">
                <AlertCircle className="size-4" /> {error}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 更多安全设置（占位） */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="card flex items-start gap-3 p-5 opacity-80">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <ShieldCheck className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {t.security.twoFactor}
              <span className="badge badge-neutral ml-2 text-[10px]">
                {t.security.comingSoon}
              </span>
            </p>
            <p className="text-meta mt-1 text-xs">{t.security.twoFactorDesc}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3 p-5 opacity-80">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-bg-muted)]">
            <Phone className="size-4 text-[var(--color-ink-2)]" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {t.security.phoneBinding}
              <span className="badge badge-neutral ml-2 text-[10px]">
                {t.security.comingSoon}
              </span>
            </p>
            <p className="text-meta mt-1 text-xs">{t.security.phoneDesc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
