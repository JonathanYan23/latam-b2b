import { redirect } from "next/navigation";

export const metadata = { title: "Home" };

/** 首页与账户已合并为单页（简洁总览 + 账务中心）。账户/发票深链统一收口到首页 #finance */
export default function RetailerAccountPage() {
  redirect("/retailer#finance");
}
