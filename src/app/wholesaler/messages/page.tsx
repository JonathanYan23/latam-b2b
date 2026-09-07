import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary, getLocale } from "@/i18n";
import { date } from "@/lib/format";

export const metadata = { title: "Messages" };

export default async function WholesalerMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const wholesalerId = session.wholesalerId!;
  const me = session.userId;

  const messages = await db.message.findMany({
    where: { wholesalerId },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { retailerId: true, body: true, createdAt: true, senderId: true, readAt: true },
  });

  const conv = new Map<string, { unread: number; last: string; at: Date }>();
  for (const m of messages) {
    const key = m.retailerId;
    if (!key) continue;
    const c = conv.get(key) ?? { unread: 0, last: "", at: m.createdAt };
    if (!c.last) {
      if (m.body.startsWith("[CARD]")) {
        c.last = m.body.includes('"k":"p"')
          ? t.messages.sendProduct
          : m.body.includes('"k":"o"')
            ? t.messages.sendOrder
            : m.body;
      } else {
        c.last = m.body;
      }
    }
    if (m.senderId !== me && !m.readAt) c.unread++;
    c.at = m.createdAt;
    conv.set(key, c);
  }
  const rtIds = [...conv.keys()];
  const [retailers, rels] = await Promise.all([
    rtIds.length
      ? db.retailer.findMany({
          where: { id: { in: rtIds } },
          select: { id: true, business: { select: { tradeName: true } } },
        })
      : [],
    db.customerRelationship.findMany({
      where: { wholesalerId, retailerId: { in: rtIds } },
      select: { retailerId: true, id: true },
    }),
  ]);
  const rtName = new Map(retailers.map((r) => [r.id, r.business.tradeName ?? ""]));
  const relOf = new Map(rels.map((r) => [r.retailerId, r.id]));

  let rows = [...conv.entries()].sort((a, b) => b[1].at.getTime() - a[1].at.getTime());
  if (query) {
    rows = rows.filter(([rtId]) =>
      (rtName.get(rtId) ?? "").toLowerCase().includes(query),
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <h1 className="text-h1">{t.nav.messages}</h1>
      <p className="text-body mt-1">{t.nav.messagesHint}</p>

      <form action="/wholesaler/messages" method="get" className="mt-5 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input
            name="q"
            defaultValue={query}
            placeholder={t.nav.searchMessages}
            className="input pl-9"
          />
        </div>
        <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
          {t.common.search}
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <MessageCircle className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
          <p className="text-meta">{t.nav.noMessages}</p>
        </div>
      ) : (
        <div className="card mt-6 divide-y divide-[var(--color-line-2)]">
          {rows.map(([rtId, c]) => {
            const relId = relOf.get(rtId);
            const href = relId ? `/wholesaler/customers/${relId}/chat` : "#";
            return (
              <Link
                key={rtId}
                href={href}
                aria-disabled={href === "#"}
                className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-bg-subtle)] ${
                  href === "#" ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--color-bg-muted)]">
                  <MessageCircle className="size-5 text-[var(--color-ink-2)]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">
                      {rtName.get(rtId) ?? "—"}
                    </span>
                    <span className="text-meta shrink-0 text-xs">{date(c.at, locale)}</span>
                  </span>
                  <span className="text-meta mt-0.5 block truncate text-sm">{c.last}</span>
                </span>
                {c.unread > 0 && (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-[10px] font-semibold text-white">
                    {c.unread > 99 ? "99+" : c.unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
