"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require";

/** 后台直接连接批发商 ↔ 零售商（建立客户关系，直接批准） */
export async function adminConnectAction(
  wholesalerId: string,
  retailerId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("ADMIN");

  const [ws, rt] = await Promise.all([
    db.wholesaler.findUnique({ where: { id: wholesalerId } }),
    db.retailer.findUnique({ where: { id: retailerId } }),
  ]);
  if (!ws || !rt) return { ok: false, error: "not_found" };

  await db.customerRelationship.upsert({
    where: { wholesalerId_retailerId: { wholesalerId, retailerId } },
    create: {
      wholesalerId,
      retailerId,
      status: "APPROVED",
      tier: "STANDARD",
      requestedAt: new Date(),
      approvedAt: new Date(),
    },
    update: { status: "APPROVED", approvedAt: new Date() },
  });

  revalidatePath("/admin/wholesalers/[id]", "page");
  revalidatePath("/admin/retailers/[id]", "page");
  revalidatePath(`/admin/wholesalers/${wholesalerId}`);
  revalidatePath(`/admin/retailers/${retailerId}`);
  return { ok: true };
}
