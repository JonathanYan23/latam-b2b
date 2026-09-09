import { db } from "@/lib/db";

export interface UnreadCounts {
  [navHref: string]: number;
}

/**
 * 顶部导航未读徽标数据。
 * 会话消息按 readAt 判读：收件方打开过会话即标记已读；readAt 为空 = 对方发来的未读。
 * RETAILER 的会话挂在「我的供应商」，WHOLESALER 的挂在「客户」。
 */
export async function navUnread(opts: {
  role?: string | null;
  userId?: string | null;
  retailerId?: string | null;
  wholesalerId?: string | null;
}): Promise<UnreadCounts> {
  const { role, userId, retailerId, wholesalerId } = opts;
  if (!userId) return {};

  if (role === "RETAILER" && retailerId) {
    const n = await db.message.count({
      where: { retailerId, senderId: { not: userId }, readAt: null },
    });
    return n > 0 ? { "/retailer/suppliers": n } : {}; // 消息已整合进「我的供应商」
  }
  if (role === "WHOLESALER" && wholesalerId) {
    const n = await db.message.count({
      where: { wholesalerId, senderId: { not: userId }, readAt: null },
    });
    return n > 0 ? { "/wholesaler/customers": n, "/wholesaler/messages": n } : {};
  }
  return {};
}

/** 打开会话即标记该会话中「对方发来的消息」为已读（幂等） */
export async function markConversationRead(
  wholesalerId: string,
  retailerId: string,
  readerId: string,
): Promise<void> {
  await db.message.updateMany({
    where: {
      wholesalerId,
      retailerId,
      senderId: { not: readerId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}
