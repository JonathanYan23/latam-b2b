import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import {getDictionary} from "@/i18n";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/auth");
  if (session.user.role !== "ADMIN") redirect("/");

  const t = await getDictionary();

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line-2)] bg-white/85 backdrop-blur-md">
        <div className="container-x flex h-14 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-[var(--color-ink)] text-white">
              <ShieldCheck className="size-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              {t.admin.console}
            </span>
          </Link>
          <span className="text-sm text-[var(--color-ink-3)]">
            {session.user.name ?? session.user.email}
          </span>
        </div>
      </header>
      <main className="container-x py-8">{children}</main>
    </div>
  );
}
