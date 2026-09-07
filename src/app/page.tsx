import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";
import { getDictionary, getLocale } from "@/i18n";
import { LanguageSwitcher } from "@/i18n/language-switcher";

export default async function HomePage() {
  const session = await auth();
  const t = await getDictionary();
  const locale = await getLocale();

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      {/* 顶部导航 */}
      <header className="border-b border-[var(--color-line-2)]">
        <div className="container-x flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-ink)] text-white">
              <Package className="size-4" strokeWidth={2.2} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              {t.common.brand}
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <LanguageSwitcher current={locale} />
            {session?.user ? (
              <Link
                href={homeForRole(session.user.role)}
                className="btn btn-primary px-4 py-2 text-sm"
              >
                {t.common.goToPortal} <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="btn rounded-md border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                >
                  {t.common.signIn}
                </Link>
                <Link
                  href="/auth?mode=register"
                  className="btn btn-primary px-4 py-2 text-sm"
                >
                  {t.common.getStarted}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero + 双身份入口 */}
      <section className="container-x pb-14 pt-8 sm:pt-12">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <div className="mb-5 inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-bg-subtle)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-2)]">
            {t.landing.tagline}
          </div>
          <h1 className="text-hero mx-auto max-w-2xl">{t.landing.title}</h1>
          <p className="text-body mx-auto mt-4 max-w-md">
            {t.landing.subtitle}
          </p>
        </div>

        {/* 双入口卡片 */}
        <div className="mx-auto mt-9 grid max-w-4xl gap-5 sm:grid-cols-2">
          <Link
            href={
              session?.user?.role === "RETAILER"
                ? "/retailer"
                : "/auth?mode=register&role=retailer"
            }
            className="card card-hover group flex flex-col p-7 animate-fade-up"
            style={{ animationDelay: "0.06s" }}
          >
            <span className="text-3xl leading-none">🛒</span>
            <h2 className="text-h2 mt-4">{t.landing.retailerTitle}</h2>
            <p className="text-body mt-2 flex-1">
              {t.landing.retailerDesc}
            </p>
            <span className="btn btn-primary mt-6 w-full justify-center py-2.5 text-sm">
              {t.landing.retailerCta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href={
              session?.user?.role === "WHOLESALER"
                ? "/wholesaler"
                : "/auth?mode=register&role=wholesaler"
            }
            className="card card-hover group flex flex-col p-7 animate-fade-up"
            style={{ animationDelay: "0.12s" }}
          >
            <span className="text-3xl leading-none">📦</span>
            <h2 className="text-h2 mt-4">{t.landing.wholesalerTitle}</h2>
            <p className="text-body mt-2 flex-1">
              {t.landing.wholesalerDesc}
            </p>
            <span className="btn btn-primary mt-6 w-full justify-center py-2.5 text-sm">
              {t.landing.wholesalerCta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* 卖点条：主卖点 + 细则 */}
      <section className="border-t border-[var(--color-line-2)]">
        <div className="container-x py-10 text-center">
          <p className="mx-auto max-w-3xl text-[15px] font-semibold text-[var(--color-ink)]">
            {t.landing.valueRow}
          </p>
          <p className="text-meta mx-auto mt-2.5 max-w-3xl text-[13px] leading-relaxed">
            {t.landing.valueSub}
          </p>
        </div>
      </section>

      <footer className="border-t border-[var(--color-line-2)]">
        <div className="container-x flex h-14 items-center justify-between text-meta">
          <span>
            © {new Date().getFullYear()} {t.common.brand}
          </span>
          <span className="hidden sm:block">{t.landing.footerTag}</span>
        </div>
      </footer>
    </main>
  );
}
