import { redirect } from "next/navigation";

export const metadata = { title: "My Suppliers" };

/** 消息已整合进「我的供应商」（会话搜索 + 每供应商聊天直达），独立入口移除 */
export default function RetailerMessagesPage() {
  redirect("/retailer/suppliers");
}
