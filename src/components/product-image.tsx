"use client";

/**
 * ProductImage —— 商品图统一渲染（带加载失败兜底）
 *
 * 生产环境常见问题：上传文件被清理 / 迁移后 DB 仍引用旧路径 → 直接 <img> 会显示破图。
 * 这里在加载失败时优雅降级为中性占位（Package 图标），保证版式不塌、观感不脏。
 */
import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";

export function ProductImage({
  src,
  alt,
  sizes = "25vw",
  className = "object-cover",
  iconClassName = "size-6 text-[var(--color-ink-3)]",
  zoom = false,
}: {
  src?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  iconClassName?: string;
  /** 是否支持点击放大（配合 ImageLightbox 的 [data-zoom] 委托） */
  zoom?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-label={alt}
        role="img"
        className="grid h-full w-full place-items-center bg-[var(--color-bg-muted)]"
      >
        <Package className={iconClassName} strokeWidth={1.3} />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized
      data-zoom={zoom ? "" : undefined}
      onError={() => setFailed(true)}
    />
  );
}
