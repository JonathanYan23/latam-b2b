import Link from "next/link";
import { Store, MapPin, Package, Search, MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { getDictionary } from "@/i18n";
import { fmt } from "@/i18n/utils";
import {
  relationshipStatusLabel,
  relationshipStatusTone,
  date,
} from "@/lib/format";
import { termsLabel } from "@/lib/terms";
import type { RelationshipStatus } from "@prisma/client";
import { SupplierChatButton } from "./chat-button";

export const metadata = { title: "My Suppliers" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireRole("RETAILER");
  const t = await getDictionary();
  const retailerId = session.retailerId!;
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const [wholesalers, relationships, recentMsgs] = await Promise.all([
    db.wholesaler.findMany({
      include: {
        business: { include: { city: true, country: true } },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.customerRelationship.findMany({
      where: { retailerId },
      select: {
        wholesalerId: true,
        status: true,
        approvedAt: true,
        paymentTerms: true,
      },
    }),
    // 每个供应商最近一条消息（会话预览，用于会话搜索与「最近聊天」一眼定位）
    db.message.findMany({
      where: { retailerId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        wholesalerId: true,
        senderId: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  const relMap = new Map(
    relationships.map((r) => [
      r.wholesalerId,
      {
        status: r.status,
        approvedAt: r.approvedAt,
        paymentTerms: r.paymentTerms,
      },
    ]),
  );

  // 未读 + 最近消息（按供应商取最新一条）
  const lastMsg = new Map<
    string,
    { body: string; createdAt: Date; fromMe: boolean; unread: boolean }
  >();
  const unreadByWs = new Map<string, number>();
  for (const m of recentMsgs) {
    if (!m.wholesalerId) continue;
    unreadByWs.set(
      m.wholesalerId,
      (unreadByWs.get(m.wholesalerId) ?? 0) + (m.readAt ? 0 : m.senderId !== session.userId ? 1 : 0),
    );
    if (!lastMsg.has(m.wholesalerId)) {
      lastMsg.set(m.wholesalerId, {
        body: m.body,
        createdAt: m.createdAt,
        fromMe: m.senderId === session.userId,
        unread: !m.readAt && m.senderId !== session.userId,
      });
    }
  }

  // 会话搜索：供应商名 / 店名 / 最近聊天内容（列表规模小，内存过滤保证大小写不敏感）
  const visible = query
    ? wholesalers.filter((w) => {
        const name = `${w.business.tradeName ?? ""} ${w.business.legalName ?? ""}`.toLowerCase();
        if (name.includes(query)) return true;
        const lm = lastMsg.get(w.id);
        return !!lm && lm.body.toLowerCase().includes(query);
      })
    : wholesalers;

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">{t.suppliers.title}</h1>
          <p className="text-body mt-1">
            {t.suppliers.desc}{" "}
            {wholesalers.length > 0 && (
              <span className="badge badge-neutral ml-1 align-middle">
                {fmt(t.suppliers.count, { n: wholesalers.length })}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/retailer/discover"
          className="btn btn-secondary px-3.5 py-2 text-sm"
        >
          {t.nav.discover}
        </Link>
      </div>

      {/* 会话搜索：搜供应商 / 店名 / 聊天内容，快速定位对应聊天 */}
      <form method="get" action="/retailer/suppliers" className="relative mt-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]" />
        <input
          name="q"
          defaultValue={q}
          placeholder={t.suppliers.searchPlaceholder}
          className="input h-11 pl-10 pr-24"
          aria-label={t.suppliers.searchPlaceholder}
        />
        <button
          type="submit"
          className="btn btn-primary absolute right-1.5 top-1/2 h-8 -translate-y-1/2 px-3.5 text-sm"
        >
          {t.common.search}
        </button>
      </form>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {wholesalers.length === 0 ? (
          <div className="card col-span-full flex flex-col items-center px-6 py-14 text-center">
            <Store className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
            <p className="text-h3 text-base">{t.suppliers.emptyTitle}</p>
            <p className="text-meta mt-1.5 max-w-sm">{t.suppliers.emptyDesc}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="card col-span-full flex flex-col items-center px-6 py-14 text-center">
            <MessageSquare className="mb-4 size-8 text-[var(--color-ink-3)]" strokeWidth={1.5} />
            <p className="text-h3 text-base">{t.suppliers.emptySearch}</p>
          </div>
        ) : (
          visible.map((w) => {
            const meta = relMap.get(w.id) ?? {
              status: undefined,
              approvedAt: null,
              paymentTerms: null,
            };
            const status = meta.status as unknown as RelationshipStatus | undefined;
            const location = [w.business.city?.name, w.business.country?.name]
              .filter(Boolean)
              .join(", ");
            const lm = lastMsg.get(w.id);
            const unread = unreadByWs.get(w.id) ?? 0;
            return (
              <div
                key={w.id}
                className={`card flex items-center justify-between gap-3 p-5 transition-shadow hover:shadow-md ${
                  lm?.unread ? "border-l-4 border-l-[var(--color-accent)]" : ""
                }`}
              >
                <Link
                  href={`/retailer/suppliers/${w.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3.5"
                >
                  <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-bg-muted)]">
                    <Store className="size-5 text-[var(--color-ink-2)]" />
                    {unread > 0 && (
                      <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold leading-tight text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {w.business.tradeName ?? w.business.legalName}
                    </span>
                    <span className="text-meta mt-0.5 flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1">
                        <Package className="size-3" />{" "}
                        {fmt(t.suppliers.productsCount, { n: w._count.products })}
                      </span>
                      {location && (
                        <span className="hidden items-center gap-1 sm:inline-flex">
                          <MapPin className="size-3" /> {location}
                        </span>
                      )}
                    </span>
                    {status === "APPROVED" && meta.paymentTerms && (
                      <span className="text-meta mt-0.5 block text-[11px]">
                        {termsLabel(meta.paymentTerms, t)}
                      </span>
                    )}
                    {/* 会话预览：一眼定位最近的聊天 */}
                    {lm && (
                      <span
                        className={`mt-1 flex items-center gap-1.5 text-xs ${
                          lm.unread
                            ? "font-medium text-[var(--color-ink)]"
                            : "text-[var(--color-ink-3)]"
                        }`}
                      >
                        <MessageSquare className="size-3 shrink-0" />
                        <span className="truncate">
                          {lm.fromMe ? "" : ""}
                          {lm.body}
                        </span>
                        <span className="shrink-0 text-[10px] opacity-70">
                          {date(lm.createdAt)}
                        </span>
                      </span>
                    )}
                  </span>
                </Link>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  {status === "APPROVED" && (
                    <SupplierChatButton
                      wholesalerId={w.id}
                      supplierName={w.business.tradeName ?? w.business.legalName}
                      unread={unread}
                    />
                  )}
                  {status && (
                    <span className={`badge ${relationshipStatusTone(status)}`}>
                      {relationshipStatusLabel(status, t)}
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
