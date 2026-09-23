import type { MetadataRoute } from "next";

/** robots.txt：开放公开页，屏蔽需登录的门户与接口 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/retailer/", "/wholesaler/"],
      },
    ],
  };
}
