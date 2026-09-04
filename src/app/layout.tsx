import type { Metadata, Viewport } from "next";
import { GeistSans, GeistMono } from "geist/font";
import {getLocale} from "@/i18n";
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
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
