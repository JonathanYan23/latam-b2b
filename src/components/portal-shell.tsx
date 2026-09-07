"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  LogOut,
  Home,
  Search,
  ShoppingBag,
  Store,
  UserCircle,
  ShoppingCart,
  Users,
  Compass,
  type LucideIcon,
  MessageCircle,
} from "lucide-react";
import { signOut } from "next-auth/react";
import type { Dict } from "@/i18n";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { AccountMenu } from "./account-menu";
import type { Locale } from "@/i18n/config";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string[];
}

export function PortalShell({
  role,
  brand,
  userName,
  userEmail,
  t,
  locale,
  children,
  unread,
}: {
  role: "retailer" | "wholesaler";
  brand: string;
  userName?: string | null;
  userEmail?: string | null;
  t: Dict;
  locale: Locale;
  children: React.ReactNode;
  unread?: Record<string, number>;
}) {
  const pathname = usePathname();
  const nav = buildNav(role, t);
  const isActive = (item: NavItem) =>
    (item.match ?? [item.href]).some((p) => pathname.startsWith(p) && p !== "/");

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* 桌面顶部导航 */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-line-2)] bg-white/85 backdrop-blur-md">
        <div className="container-x flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-[var(--color-ink)] text-white">
              <Package className="size-3.5" strokeWidth={2.2} />
            </span>
            <span className="text-sm font-semibold tracking-tight">{brand}</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive(item)
                    ? "font-medium text-[var(--color-ink)] after:absolute after:inset-x-2 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-[var(--color-ink)]"
                    : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
                {unread?.[item.href] ? (
                  <span className="ml-0.5 grid min-w-4 place-items-center rounded-full bg-[var(--color-danger)] px-1 py-px text-[10px] font-semibold leading-tight text-white">
                    {unread[item.href] > 99 ? "99+" : unread[item.href]}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher current={locale} />
            <AccountMenu
              role={role}
              name={userName ?? userEmail}
              email={userEmail}
              t={t}
            />
          </div>
        </div>
      </header>

      <main className="container-x pb-24 pt-8 md:pb-12">{children}</main>

      {/* 移动端底部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line-2)] bg-white/95 backdrop-blur-md md:hidden">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item) ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 py-2 text-[10px] leading-none transition-colors ${
                isActive(item)
                  ? "font-medium text-[var(--color-ink)]"
                  : "text-[var(--color-ink-3)]"
              }`}
            >
              <span className="relative">
                <item.icon
                  className="size-5 shrink-0"
                  strokeWidth={isActive(item) ? 2.2 : 1.8}
                />
                {unread?.[item.href] ? (
                  <span className="absolute -right-2 -top-1.5 grid min-w-3.5 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-semibold leading-tight text-white">
                    {unread[item.href] > 9 ? "9+" : unread[item.href]}
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function buildNav(role: "retailer" | "wholesaler", t: Dict): NavItem[] {
  const n = t.nav;
  if (role === "retailer") {
    return [
      { href: "/retailer", label: n.home, icon: Home },
      {
        href: "/retailer/browse",
        label: n.browse,
        icon: Search,
        match: ["/retailer/browse", "/retailer/products"],
      },
      { href: "/retailer/discover", label: n.discover, icon: Compass },
      { href: "/retailer/orders", label: n.orders, icon: ShoppingBag },
      { href: "/retailer/suppliers", label: n.suppliers, icon: Store },
      { href: "/retailer/messages", label: n.messages, icon: MessageCircle },
      { href: "/retailer/account", label: n.account, icon: UserCircle },
    ];
  }
  return [
    { href: "/wholesaler", label: n.home, icon: Home },
    {
      href: "/wholesaler/products",
      label: n.products,
      icon: Package,
      match: ["/wholesaler/products"],
    },
    { href: "/wholesaler/orders", label: n.orders, icon: ShoppingCart },
    { href: "/wholesaler/customers", label: n.customers, icon: Users },
    { href: "/wholesaler/messages", label: n.messages, icon: MessageCircle },
    { href: "/wholesaler/account", label: n.account, icon: UserCircle },
  ];
}
