"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import { dictForLocale, getActionLocale } from "@/i18n";
import { applyPayments } from "@/lib/payments";

/** 批发商更新「订单与付款政策」：最低订单金额（留空 = 不限） */
export async function updatePolicyAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("WHOLESALER");
  const wholesalerId = session.wholesalerId!;

  const raw = String(formData.get("minOrderAmount") ?? "").trim();
  const minOrderAmount =
    raw === "" || Number(raw) <= 0 ? null : Number(raw);

  await db.wholesaler.update({
    where: { id: wholesalerId },
    data: { minOrderAmount },
  });

  revalidatePath("/wholesaler/account");
  return { ok: true };
}

/** 批发商确认收款（PRD 14/24 节：Payment Received → 自动更新余额） */
export async function confirmPaymentAction(
  paymentId: string,
  confirmedByName: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("WHOLESALER");
  const wholesalerId = session.wholesalerId!;

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  const t = dictForLocale(await getActionLocale());
  if (!payment || payment.wholesalerId !== wholesalerId)
    return { ok: false, error: t.wsAccount.errNotFound };
  if (payment.status !== "PENDING")
    return { ok: false, error: t.wsAccount.errProcessed };

  const name = confirmedByName.trim() || session.name || "—";

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "RECEIVED", paidAt: new Date(), confirmedByName: name },
    });

    // 按先进先出抵扣该客户未付发票
    await applyPayments(tx, wholesalerId, payment.retailerId);
  });

  revalidatePath("/wholesaler/account");
  return { ok: true };
}

/** 批发商上传/更新店铺 Logo */
export async function updateBusinessLogoAction(
  logoUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("WHOLESALER");
  const wholesalerId = session.wholesalerId!;

  const ws = await db.wholesaler.findUnique({
    where: { id: wholesalerId },
    select: { businessId: true },
  });
  if (!ws?.businessId) return { ok: false, error: "no_business" };

  await db.business.update({
    where: { id: ws.businessId },
    data: { logo: logoUrl },
  });

  revalidatePath("/wholesaler/account");
  revalidatePath("/retailer/suppliers");
  return { ok: true };
}
