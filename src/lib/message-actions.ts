"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {dictForLocale, getActionLocale} from "@/i18n";

const messageSchema = z.object({
  body: z.string().min(1, "Message cannot be empty").max(2000),
});

/**
 * 发送消息（Wholesaler ↔ Retailer）。
 * sender 由服务端会话决定；wholesalerId/retailerId 标识会话双方。
 */
export async function sendMessageAction(
  wholesalerId: string,
  retailerId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const t = dictForLocale(await getActionLocale());
  if (!session?.user) return { ok: false, error: t.messages.errSignedOut };

  const parsed = messageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: t.messages.errEmpty };

  const { body } = parsed.data;

  // 附件：formData 传入 JSON 数组字符串（URLs）
  const attachmentsRaw = formData.get("attachments");
  let attachments: string | null = null;
  if (typeof attachmentsRaw === "string" && attachmentsRaw.trim()) {
    try {
      const arr = JSON.parse(attachmentsRaw);
      if (Array.isArray(arr)) {
        const urls = arr.filter((x) => typeof x === "string" && x).slice(0, 10);
        if (urls.length) attachments = JSON.stringify(urls);
      }
    } catch {
      /* 忽略非法附件 */
    }
  }

  const senderRole = session.user.role;

  // 权限：零售商标记自己是 retailerId；批发商标记自己是 wholesalerId
  const finalWholesalerId =
    senderRole === "WHOLESALER" ? session.user.wholesalerId! : wholesalerId;
  const finalRetailerId =
    senderRole === "RETAILER" ? session.user.retailerId! : retailerId;

  // 校验批发商存在
  const ws = await db.wholesaler.findUnique({ where: { id: finalWholesalerId } });
  if (!ws) return { ok: false, error: t.messages.errWsNotFound };

  if (senderRole === "WHOLESALER" && finalWholesalerId !== session.user.wholesalerId) {
    return { ok: false, error: t.messages.errForbidden };
  }
  if (senderRole === "RETAILER" && finalRetailerId !== session.user.retailerId) {
    return { ok: false, error: t.messages.errForbidden };
  }

  await db.message.create({
    data: {
      senderId: session.user.id,
      wholesalerId: finalWholesalerId,
      retailerId: finalRetailerId,
      body,
      attachments,
    },
  });

  revalidatePath(`/retailer/suppliers/${finalWholesalerId}`);
  revalidatePath(`/retailer/suppliers`);
  revalidatePath(`/wholesaler/customers/${session.user.wholesalerId ?? ""}`);
  return { ok: true };
}

/** 会话消息历史（序列化后给弹窗用），最近 50 条升序 */
export async function getConversationMessagesAction(
  wholesalerId: string,
  retailerId: string,
): Promise<{ ok: boolean; messages?: MessageItemDto[]; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  const role = session.user.role;
  if (role === "RETAILER" && retailerId !== session.user.retailerId) {
    return { ok: false, error: "Forbidden" };
  }
  if (role === "WHOLESALER" && wholesalerId !== session.user.wholesalerId) {
    return { ok: false, error: "Forbidden" };
  }

  const rows = await db.message.findMany({
    where: { wholesalerId, retailerId },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { sender: { select: { name: true } } },
  });

  return {
    ok: true,
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      attachments: m.attachments ? safeParseUrls(m.attachments) : undefined,
      createdAt: m.createdAt.toISOString(),
      mine: m.senderId === session.user.id,
      senderName: m.sender.name,
    })),
  };
}

function safeParseUrls(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export interface MessageItemDto {
  id: string;
  body: string;
  attachments?: string[];
  createdAt: string;
  mine: boolean;
  senderName: string | null;
}
