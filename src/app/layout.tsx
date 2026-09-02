import type { Metadata } from "next";
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
