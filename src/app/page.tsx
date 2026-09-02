import Link from "next/link";
import { ShoppingBag, Package, ArrowRight, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";
import {getDictionary, getLocale} from "@/i18n";
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
          <nav className="flex items-center gap-1">
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
                <Link href="/auth" className="btn btn-ghost px-4 py-2 text-sm">
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
      <section className="container-x pb-24 pt-16 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-ink-2)]">
            <Sparkles className="size-3.5 text-[var(--color-accent)]" />
            {t.landing.tagline}
          </div>
          <h1 className="text-hero">{t.landing.title}</h1>
          <p className="text-body mx-auto mt-4 max-w-md">
            {t.landing.subtitle}
          </p>
        </div>

        {/* 双入口卡片 */}
        <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2">
          <Link
            href={
              session?.user?.role === "RETAILER"
                ? "/retailer"
                : "/auth?mode=register&role=retailer"
            }
            className="card card-hover group flex flex-col p-8 animate-fade-up"
            style={{ animationDelay: "0.06s" }}
          >
            <span className="mb-6 grid size-12 place-items-center rounded-xl bg-[var(--color-bg-muted)] text-[var(--color-ink)] transition-colors group-hover:bg-[var(--color-ink)] group-hover:text-white">
              <ShoppingBag className="size-6" strokeWidth={1.8} />
            </span>
            <h2 className="text-h2">{t.landing.retailerTitle}</h2>
            <p className="text-body mt-2 flex-1">{t.landing.retailerDesc}</p>
            <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
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
            className="card card-hover group flex flex-col p-8 animate-fade-up"
            style={{ animationDelay: "0.12s" }}
          >
            <span className="mb-6 grid size-12 place-items-center rounded-xl bg-[var(--color-bg-muted)] text-[var(--color-ink)] transition-colors group-hover:bg-[var(--color-ink)] group-hover:text-white">
              <Package className="size-6" strokeWidth={1.8} />
            </span>
            <h2 className="text-h2">{t.landing.wholesalerTitle}</h2>
            <p className="text-body mt-2 flex-1">{t.landing.wholesalerDesc}</p>
            <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
              {t.landing.wholesalerCta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* 极简价值条 */}
      <section className="border-t border-[var(--color-line-2)]">
        <div className="container-x grid gap-6 py-14 sm:grid-cols-3">
          {[
            { title: t.landing.feat1Title, desc: t.landing.feat1Desc },
            { title: t.landing.feat2Title, desc: t.landing.feat2Desc },
            { title: t.landing.feat3Title, desc: t.landing.feat3Desc },
          ].map((f, i) => (
            <div
              key={f.title}
              className="animate-fade-up"
              style={{ animationDelay: `${0.16 + i * 0.06}s` }}
            >
              <h3 className="text-h3 text-[15px]">{f.title}</h3>
              <p className="text-meta mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--color-line-2)]">
        <div className="container-x flex h-16 items-center justify-between text-meta">
          <span>
            © {new Date().getFullYear()} {t.common.brand}
          </span>
          <span className="hidden sm:block">{t.landing.footerTag}</span>
        </div>
      </footer>
    </main>
  );
}
