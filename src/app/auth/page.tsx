import { Suspense } from "react";
import { db } from "@/lib/db";
import { getDictionary, getLocale } from "@/i18n";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { AuthForm } from "./auth-form";

export default async function AuthPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  // 注册时可选国家（启用中的，按代码排序；名称按当前语言展示）
  const dbCountries = await db.country.findMany({
    where: { active: true },
    select: { code: true, name: true, nameEs: true, currency: true },
    orderBy: { code: "asc" },
  });
  const countries = dbCountries.map((c) => ({
    code: c.code,
    currency: c.currency,
    label: (locale === "es" ? c.nameEs : c.name) ?? c.code,
  }));

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] py-12">
      <div className="absolute right-5 top-5">
        <LanguageSwitcher current={locale} />
      </div>
      <Suspense fallback={null}>
        <AuthForm t={t} countries={countries} />
      </Suspense>
    </main>
  );
}
