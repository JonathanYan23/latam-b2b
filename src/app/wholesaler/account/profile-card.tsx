"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Store, Sparkles } from "lucide-react";
import { UploadButton } from "@/components/upload-button";
import { updateBusinessLogoAction } from "./actions";
import type { Dict } from "@/i18n";

/** 批发商账户页顶部：店铺资料（Logo 上传）+ 订阅套餐 */
export function ProfileCard({
  initialLogo,
  plan,
  tradeName,
  t,
}: {
  initialLogo: string | null;
  plan: string | null;
  tradeName: string;
  t: Dict;
}) {
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const isPlus = plan === "PLUS";

  function save() {
    if (!logo) return;
    startTransition(async () => {
      const res = await updateBusinessLogoAction(logo);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="card mt-8 p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Logo */}
        <div className="flex shrink-0 items-start gap-4">
          <div className="relative grid size-16 place-items-center overflow-hidden rounded-2xl bg-[var(--color-bg-muted)]">
            {logo ? (
              <Image src={logo} alt="logo" fill sizes="64px" className="object-cover" unoptimized />
            ) : (
              <Store className="size-8 text-[var(--color-ink-3)]" strokeWidth={1.6} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.wsAccount.logo}</p>
            <p className="text-meta mt-0.5 max-w-xs text-xs">{t.wsAccount.logoHint}</p>
            <div className="mt-2 flex items-center gap-2">
              <UploadButton
                compact
                onUploaded={(url) => {
                  setLogo(url);
                  setSaved(false);
                }}
                label={t.wsAccount.uploadLogo}
              />
              {logo && logo !== initialLogo && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={save}
                  className="btn btn-primary px-3 py-1.5 text-xs"
                >
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : t.common.save}
                </button>
              )}
              {saved && <span className="text-xs text-[var(--color-success)]">✓</span>}
            </div>
          </div>
        </div>

        {/* 订阅 */}
        <div className="flex-1 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-sm font-semibold">{t.wsAccount.planTitle}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`badge ${isPlus ? "badge-success" : "badge-neutral"}`}>
              {isPlus ? t.wsAccount.planPlus : t.wsAccount.planFree}
            </span>
            {!isPlus && (
              <button
                type="button"
                onClick={() => window.alert(t.wsAccount.upgradeComingSoon)}
                className="btn btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
              >
                <Sparkles className="size-3.5" /> {t.wsAccount.upgrade}
              </button>
            )}
          </div>
          {!isPlus && (
            <p className="text-meta mt-1.5 text-xs">{t.wsAccount.planUpgradeHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
