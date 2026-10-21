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
import { CartButton } from "./cart/cart-shell";
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
  cartCount,
  currency,
}: {
  role: "retailer" | "wholesaler";
  brand: string;
  userName?: string | null;
  userEmail?: string | null;
  t: Dict;
  locale: Locale;
  children: React.ReactNode;
  unread?: Record<string, number>;
  cartCount?: number;
  currency?: string;
}) {
  const pathname = usePathname();
  const nav = buildNav(role, t);
  const isActive = (item: NavItem) =>
    (item.match ?? [item.href]).some((p) => (p === `/${role}` ? pathname === p : pathname === p || pathname.startsWith(`${p}/`)));

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      {/* 桌面顶部导航 */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-line-2)] bg-white/85 backdrop-blur-md">
        <div className="container-x flex min-h-16 items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-[var(--color-ink)] text-white">
              <Package className="size-3.5" strokeWidth={2.2} />
            </span>
            <span className="max-w-28 truncate text-sm font-semibold tracking-tight xl:max-w-none">{brand}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item) ? "page" : undefined}
                className={`relative flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                  isActive(item)
                    ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-primary)]"
                    : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-ink)]"
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

          <div className="flex items-center gap-1.5">
            {role === "retailer" && (
              <CartButton
                initialCount={cartCount ?? 0}
                t={t}
                currency={currency}
              />
            )}
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

      <main className="portal-content container-x pt-7 sm:pt-10">{children}</main>

      {/* 移动端底部导航 */}
      <nav className="portal-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line-2)] bg-white/95 backdrop-blur-md lg:hidden">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item) ? "page" : undefined}
              className={`flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] leading-tight transition-colors ${
                isActive(item)
                  ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-primary)]"
                  : "text-[var(--color-ink-3)]"
              }`}
            >
              <span className="relative">
                <item.icon
                  className="size-5 shrink-0"
                  strokeWidth={1.8}
                />
                {unread?.[item.href] ? (
                  <span className="absolute -right-2 -top-1.5 grid min-w-3.5 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-semibold leading-tight text-white">
                    {unread[item.href] > 9 ? "9+" : unread[item.href]}
                  </span>
                ) : null}
              </span>
              <span className="w-full break-words text-center">{item.label}</span>
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
    // 主导航固定 5 项：首页(含账户) / 逛市场 / 找批发商 / 订单 / 我的供应商
    // 聊天/消息已整合进「我的供应商」（会话搜索 + 店内聊天）；账户并入首页
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
      {
        href: "/retailer/suppliers",
        label: n.suppliers,
        icon: Store,
        match: ["/retailer/suppliers"],
      },
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
