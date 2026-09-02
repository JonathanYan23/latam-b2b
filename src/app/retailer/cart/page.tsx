import { redirect } from "next/navigation";

// 购物车已升级为「草稿订单」（服务端 DRAFT Order），旧地址统一跳转
export default function CartRedirectPage() {
  redirect("/retailer/orders/draft");
}
