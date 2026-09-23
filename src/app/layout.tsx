import type { Metadata, Viewport } from "next";
import { GeistSans, GeistMono } from "geist/font";
import { getDictionary, getLocale } from "@/i18n";
import { AppProviders } from "@/components/ui/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Latam B2B — Wholesale Commerce Platform",
    template: "%s · Latam B2B",
  },
  description:
    "The B2B wholesale commerce platform connecting wholesalers and retailers across Latin America.",
};

// 固定视口缩放：禁止页面自动/手动缩放，保证移动端稳定展示（UI 诉求）
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f5f5f7",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [locale, t] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <html lang={locale}>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        {/* 全局客户端能力：字典 / Toast / 确认弹窗 */}
        <AppProviders t={t} locale={locale}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
