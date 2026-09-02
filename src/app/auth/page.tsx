import { Suspense } from "react";
import {getDictionary, getLocale} from "@/i18n";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { AuthForm } from "./auth-form";

export default async function AuthPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] py-12">
      <div className="absolute right-5 top-5">
        <LanguageSwitcher current={locale} />
      </div>
      <Suspense fallback={null}>
        <AuthForm t={t} />
      </Suspense>
    </main>
  );
}
