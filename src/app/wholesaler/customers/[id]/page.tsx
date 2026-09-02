import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, FileDown, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {getDictionary, getLocale} from "@/i18n";
import { fmt } from "@/i18n/utils";
import { money, date } from "@/lib/format";
import { parseImages } from "@/lib/pricing";
import {
  CustomerPriceForm,
  RelationshipSettingsForm,
} from "../customer-actions";
import { MessageBox } from "@/components/message-box";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("WHOLESALER");
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const wholesalerId = session.wholesalerId!;
  const { id } = await params;

  const rel = await db.customerRelationship.findUnique({
    where: { id },
    include: {
      retailer: {
        include: {
          business: { include: { city: true, country: true } },
          user: { select: { name: true } },
        },
      },
      customerPrices: true,
    },
  });
  if (!rel || rel.wholesalerId !== wholesalerId) notFound();

  const products = await db.product.findMany({
    where: { wholesalerId, active: true },
    orderBy: { createdAt: "desc" },
    include: { inventories: true },
  });
  const cpMap = new Map(rel.customerPrices.map((cp) => [cp.productId, cp]));

  const messages = await db.message.findMany({
    where: { wholesalerId, retailerId: rel.retailerId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { sender: { select: { name: true, id: true } } },
  });

  const loc = [
    rel.retailer.business.city?.name,
    rel.retailer.business.country?.name,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <Link
        href="/wholesaler/customers"
        className="text-meta mb-5 inline-flex items-center gap-1.5 hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="size-4" /> {t.wsCustomers.backToCustomers}
      </Link>

      {/* 客户信息 */}
      <div className="card flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-h2">{rel.retailer.business.tradeName}</h1>
          <p className="text-meta mt-0.5 text-sm">
            {rel.retailer.business.legalName}
            {rel.retailer.business.taxId && ` · ${rel.retailer.business.taxId}`}
            {loc && (
              <span className="ml-2 inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {loc}
              </span>
            )}
          </p>
          <p className="text-meta mt-0.5 text-xs">
            {fmt(t.wsCustomers.customerSince, {
              date: date(rel.approvedAt ?? rel.createdAt),
            })}
          </p>
          {rel.retailer.user?.name && (
            <p className="text-meta mt-0.5 text-xs">
              {t.common.contactPerson}: {rel.retailer.user.name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {rel.status === "APPROVED" && (
            <a
              href="#chat"
              className="btn btn-primary px-3 py-1.5 text-xs"
            >
              <MessageCircle className="size-3.5" />
              {fmt(t.wsCustomers.chatWith, { name: rel.retailer.business.tradeName ?? rel.retailer.business.legalName })}
            </a>
          )}
          {rel.paymentTerms && (
            <span className="badge badge-neutral">{rel.paymentTerms}</span>
          )}
          {rel.creditLimit && (
            <span className="badge badge-neutral">
              {fmt(t.wsCustomers.credit, {
                amount: `$${Number(rel.creditLimit).toLocaleString()}`,
              })}
            </span>
          )}
          {rel.status === "APPROVED" && (
            <a
              href={`/wholesaler/customers/${rel.id}/statement`}
              className="btn btn-secondary px-3 py-1.5 text-xs"
            >
              <FileDown className="size-3.5" /> {t.wsCustomers.statementPdf}
            </a>
          )}
        </div>
      </div>

      {/* 左列：条款 + 专属定价；右列：消息（吸顶） */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
      {/* 客户条款 */}
      <div className="card p-6">
        <h2 className="text-h3 text-[15px]">{t.wsCustomers.customerTerms}</h2>
        <p className="text-meta mt-1 text-xs">{t.wsCustomers.termsHint}</p>
        <RelationshipSettingsForm
          relationshipId={rel.id}
          t={t}
          defaultValues={{
            tier: rel.tier,
            paymentTerms: rel.paymentTerms,
            creditLimit: rel.creditLimit?.toString() ?? null,
          }}
        />
      </div>

      {/* 专属价设置（紧跟客户信息，价格/起订量可见） */}
      <div className="mt-8">
        <h2 className="text-h3 text-[15px]">{t.wsCustomers.customPricing}</h2>
        <p className="text-meta mt-1 text-xs">{t.wsCustomers.pricingHint}</p>

        <div className="mt-4 space-y-3">
          {products.map((p) => {
            const cp = cpMap.get(p.id);
            const [img] = parseImages(p.images);
            return (
              <div key={p.id} className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                <div className="flex min-w-[220px] flex-1 items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-muted)]">
                    {img && (
                      <Image src={img} alt={p.name} fill sizes="48px" className="object-cover" unoptimized />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold leading-snug">
                      {p.name}
                    </p>
                    <p className="text-meta mt-0.5 text-xs">
                      {p.sku}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="badge badge-neutral">
                        {t.wsCustomers.publicPrice}: {money(p.publicPrice)}
                      </span>
                      {cp ? (
                        <span className="badge badge-success">
                          {t.wsCustomers.customerPrice}: {money(cp.price)}
                          {cp.moq ? ` · ${t.common.moq} ${cp.moq}` : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-ink-3)]">
                          {t.wsCustomers.customerPrice}: —
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <CustomerPriceForm
                    relationshipId={rel.id}
                    productId={p.id}
                    t={t}
                    existing={{
                      price: cp ? Number(cp.price) : null,
                      moq: cp?.moq ?? null,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      </div>

      {/* 消息（右侧，客户名旁即聊） */}
      <div id="chat" className="scroll-mt-24 lg:sticky lg:top-20">
        <div className="card flex max-h-[min(60vh,560px)] flex-col p-4">
          <p className="mb-3 flex shrink-0 items-center gap-2 border-b border-[var(--color-line-2)] pb-3 text-sm font-medium">
            <MessageCircle className="size-4 text-[var(--color-ink-2)]" />
            {t.suppliers.messagesTitle}
            <span className="badge badge-neutral ml-auto">
              {rel.retailer.business.tradeName}
            </span>
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MessageBox
              wholesalerId={wholesalerId}
              retailerId={rel.retailerId}
              locale={locale}
              t={t}
              messages={messages.map((m) => ({
                id: m.id,
                body: m.body,
                createdAt: m.createdAt.toISOString(),
                mine: m.senderId === session.userId,
                senderName: m.sender.name,
              }))}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
