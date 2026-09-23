import type { MetadataRoute } from "next";

/** Web App Manifest：支持添加到主屏 / 独立窗口运行 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Latam B2B — Wholesale Commerce Platform",
    short_name: "Latam B2B",
    description:
      "The B2B wholesale commerce platform connecting wholesalers and retailers across Latin America.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
