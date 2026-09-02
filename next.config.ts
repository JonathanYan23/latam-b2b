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
};

export default nextConfig;
