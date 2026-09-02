"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Languages, Loader2 } from "lucide-react";
import { setLocaleAction } from "./set-lang";
import { localeNames, type Locale } from "./config";

/** 语言切换器（下拉式，桌面+移动端通用） */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const switchTo = (locale: Locale) => {
    if (locale === current) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  };

  return (
    <div className="relative flex items-center gap-1">
      <Languages className="size-4 text-[var(--color-ink-3)]" />
      <select
        value={current}
        onChange={(e) => switchTo(e.target.value as Locale)}
        disabled={pending}
        className="cursor-pointer rounded-md border-0 bg-transparent py-1 pr-6 text-sm font-medium text-[var(--color-ink-2)] outline-none transition-colors hover:text-[var(--color-ink)] disabled:opacity-50 [&>option]:text-[var(--color-ink)]"
      >
        {(Object.keys(localeNames) as Locale[]).map((l) => (
          <option key={l} value={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-3.5 animate-spin text-[var(--color-ink-3)]" />}
    </div>
  );
}
