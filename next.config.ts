import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Windows 文件沙箱下将构建产物输出到独立目录，规避对旧产物的删除限制
  // Vercel 云端（VERCEL env）使用默认 .next，避免自定产物目录
  ...(process.env.VERCEL ? {} : { distDir: "prod-build" }),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  /**
   * 旧的「消息」入口已并入「我的供应商」。
   * 这里用**路由级重定向**，而不是在页面里调用 redirect()：
   * 页面级 redirect 在客户端导航时会改变 Router 内部的 hook 数量，
   * 触发 React #310（Rendered more hooks than during the previous render）。
   * 路由级重定向不会渲染该页面，因此不会出现该错误。
   */
  async redirects() {
    return [
      {
        source: "/retailer/messages",
        destination: "/retailer/suppliers",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
