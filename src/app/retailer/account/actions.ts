"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";
import {dictForLocale, getActionLocale} from "@/i18n";

const paymentSchema = z.object({
  wholesalerId: z.string().min(1),
  amount: z.coerce.number().min(0.01, "Amount must be greater than zero"),
  method: z.enum(["BANK_TRANSFER", "CASH", "CARD", "OTHER"]),
  notes: z.string().optional().default(""),
});

/** 零售商记录一笔付款（PRD 14 节：先记录，批发商确认后更新余额） */
export async function recordPaymentAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("RETAILER");
  const t = dictForLocale(await getActionLocale());
  const retailerId = session.retailerId!;

  const parsed = paymentSchema.safeParse({
    wholesalerId: formData.get("wholesalerId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { ok: false, error: t.retailerAccount.pendingNote };

  const { wholesalerId, amount, method, notes } = parsed.data;

  const wholesaler = await db.wholesaler.findUnique({ where: { id: wholesalerId } });
  if (!wholesaler) return { ok: false, error: t.messages.errWsNotFound };

  await db.payment.create({
    data: {
      wholesalerId,
      retailerId,
      amount,
      method: method as PaymentMethod,
      status: "PENDING",
      notes: notes || null,
    },
  });

  revalidatePath("/retailer/account");
  return { ok: true };
}
