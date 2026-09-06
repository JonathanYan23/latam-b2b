"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {dictForLocale, getActionLocale} from "@/i18n";

async function ownRelationship(relationshipId: string) {
  const session = await requireRole("WHOLESALER");
  const wholesalerId = session.wholesalerId!;
  const rel = await db.customerRelationship.findUnique({
    where: { id: relationshipId },
  });
  if (!rel || rel.wholesalerId !== wholesalerId) return null;
  return rel;
}

async function dict() {
  return dictForLocale(await getActionLocale());
}

/** 批准客户申请 */
export async function approveCustomerAction(relationshipId: string) {
  const rel = await ownRelationship(relationshipId);
  if (!rel) return { ok: false, error: "Not found" };

  await db.customerRelationship.update({
    where: { id: relationshipId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  revalidatePath("/wholesaler/customers");
  return { ok: true };
}

/** 拒绝客户申请 */
export async function rejectCustomerAction(relationshipId: string) {
  const rel = await ownRelationship(relationshipId);
  if (!rel) return { ok: false, error: "Not found" };

  await db.customerRelationship.update({
    where: { id: relationshipId },
    data: { status: "REJECTED" },
  });
  revalidatePath("/wholesaler/customers");
  return { ok: true };
}

/**
 * 移除客户关系（完整删除）：带业务守卫。
 * 已产生订单/发票的客户不可移除（保留财务记录）；无业务的可连专属价一并清除。
 */
export async function deleteCustomerAction(
  relationshipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const rel = await ownRelationship(relationshipId);
  const t = await dict();
  if (!rel) return { ok: false, error: t.wsCustomers.errNotFound };

  const [orderCount, invoiceCount] = await Promise.all([
    db.supplierOrder.count({ where: { relationshipId } }),
    db.invoice.count({ where: { wholesalerId: rel.wholesalerId, retailerId: rel.retailerId } }),
  ]);
  if (orderCount > 0 || invoiceCount > 0) {
    return { ok: false, error: t.wsCustomers.errHasHistory };
  }

  await db.$transaction([
    db.customerPrice.deleteMany({ where: { relationshipId } }),
    db.customerRelationship.delete({ where: { id: relationshipId } }),
  ]);

  revalidatePath("/wholesaler/customers");
  return { ok: true };
}

const relSettingsSchema = z.object({
  tier: z.enum(["STANDARD", "VIP", "GOLD", "VOLUME"]),
  paymentTerms: z.string().optional().default(""),
  creditLimit: z.coerce.number().min(0).optional(),
});

/** 更新客户条款（层级/账期/信用额度） */
export async function updateRelationshipAction(
  relationshipId: string,
  formData: FormData,
) {
  const rel = await ownRelationship(relationshipId);
  if (!rel) return { ok: false, error: "Not found" };

  const parsed = relSettingsSchema.safeParse({
    tier: formData.get("tier"),
    paymentTerms: formData.get("paymentTerms"),
    creditLimit: formData.get("creditLimit"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid data" };

  await db.customerRelationship.update({
    where: { id: relationshipId },
    data: {
      tier: parsed.data.tier,
      paymentTerms: parsed.data.paymentTerms || null,
      creditLimit: parsed.data.creditLimit ?? null,
    },
  });
  revalidatePath(`/wholesaler/customers/${relationshipId}`);
  return { ok: true };
}

const priceSchema = z.object({
  productId: z.string().min(1),
  price: z.coerce.number().min(0),
  moq: z.coerce.number().int().min(0).optional(),
});

/** 设置/更新客户专属价（PRD 22 节） */
export async function setCustomerPriceAction(
  relationshipId: string,
  formData: FormData,
) {
  const rel = await ownRelationship(relationshipId);
  if (!rel || rel.status !== "APPROVED")
    return { ok: false, error: (await dict()).wsCustomers.errNotApproved };

  const parsed = priceSchema.safeParse({
    productId: formData.get("productId"),
    price: formData.get("price"),
    moq: formData.get("moq"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid price data" };

  // 商品必须属于该批发商
  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
  });
  if (!product || product.wholesalerId !== rel.wholesalerId)
    return { ok: false, error: (await dict()).wsCustomers.errProduct };

  await db.customerPrice.upsert({
    where: {
      productId_relationshipId: {
        productId: parsed.data.productId,
        relationshipId,
      },
    },
    update: {
      price: parsed.data.price,
      moq: parsed.data.moq || null,
    },
    create: {
      productId: parsed.data.productId,
      relationshipId,
      price: parsed.data.price,
      moq: parsed.data.moq || null,
    },
  });

  revalidatePath(`/wholesaler/customers/${relationshipId}`);
  return { ok: true };
}

/** 移除客户专属价 */
export async function removeCustomerPriceAction(
  relationshipId: string,
  productId: string,
) {
  const rel = await ownRelationship(relationshipId);
  if (!rel) return { ok: false, error: "Not found" };

  await db.customerPrice.deleteMany({
    where: { relationshipId, productId },
  });
  revalidatePath(`/wholesaler/customers/${relationshipId}`);
  return { ok: true };
}
