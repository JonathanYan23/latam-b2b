"use client";

// 全站图片放大预览（Lightbox）
// 使用方式：
//   1) <Image data-zoom … /> —— 点击该图 → 打开本组件预览；
//      同容器内多个 img[data-zoom] 自动成组（可左右切换）
//   2) window.dispatchEvent(new CustomEvent("latam:zoom", { detail:{ urls, index } }))
//      任意 JS 打开多图预览（如批量上传列表的「预览」按钮）
// 支持：Esc/背景/×关闭、滚轮与双指缩放、左右箭头/滑动切换、PDF 内嵌预览。

import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface State {
  urls: string[];
  index: number;
}

export function ImageLightbox() {
  const [state, setState] = useState<State | null>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const pinchRef = useRef<{ d: number; s: number } | null>(null);
  const touchXRef = useRef<number | null>(null);

  useEffect(() => {
    // 1) img[data-zoom] 点击委托（capture 拦截，避免误触外层 Link 导航）
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const img = t.closest?.("img[data-zoom]") as HTMLImageElement | null;
      if (!img) return;
      e.preventDefault();
      e.stopPropagation();
      const holder = (img.closest("[data-zoom-group]") as HTMLElement | null) ?? img.parentElement;
      const urls = holder
        ? Array.from(holder.querySelectorAll("img[data-zoom]"))
            .map((i) => (i as HTMLImageElement).src)
            .filter(Boolean)
        : [img.src];
      const idx = Math.max(0, urls.indexOf(img.src));
      scaleRef.current = 1;
      setScale(1);
      setState({ urls, index: idx });
    };
    document.addEventListener("click", onDocClick, true);

    // 2) 编程事件 latam:zoom
    const onZoom = (e: Event) => {
      const d = (e as CustomEvent).detail as { urls?: string[]; index?: number } | undefined;
      if (!d?.urls?.length) return;
      scaleRef.current = 1;
      setScale(1);
      setState({ urls: d.urls, index: Math.min(Math.max(0, d.index ?? 0), d.urls.length - 1) });
    };
    window.addEventListener("latam:zoom", onZoom);

    // 3) Esc 关闭
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState(null);
      else if (e.key === "ArrowRight") setState((s) => s && s.urls.length > 1 ? { ...s, index: (s.index + 1) % s.urls.length } : s);
      else if (e.key === "ArrowLeft") setState((s) => s && s.urls.length > 1 ? { ...s, index: (s.index - 1 + s.urls.length) % s.urls.length } : s);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick, true);
      window.removeEventListener("latam:zoom", onZoom);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = state ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [state]);

  if (!state) return null;
  const url = state.urls[state.index];
  const isPdf = /\.pdf($|\?)/i.test(url);
  const multiple = state.urls.length > 1;

  const zoomBy = (f: number) => {
    const n = Math.min(6, Math.max(0.5, scaleRef.current * f));
    scaleRef.current = n;
    setScale(n);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
      onTouchStart={(e) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchRef.current = { d: Math.hypot(dx, dy), s: scaleRef.current };
        } else if (e.touches.length === 1) {
          touchXRef.current = e.touches[0].clientX;
        }
      }}
      onTouchMove={(e) => {
        if (pinchRef.current && e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const d = Math.hypot(dx, dy);
          const n = Math.min(6, Math.max(0.5, pinchRef.current.s * (d / pinchRef.current.d)));
          scaleRef.current = n;
          setScale(n);
        }
      }}
      onTouchEnd={(e) => {
        if (pinchRef.current) {
          pinchRef.current = null;
          touchXRef.current = null;
          return;
        }
        if (multiple && touchXRef.current !== null && e.changedTouches[0]) {
          const dx = e.changedTouches[0].clientX - touchXRef.current;
          if (Math.abs(dx) > 50) {
            setState((s) =>
              s
                ? dx < 0
                  ? { ...s, index: (s.index + 1) % s.urls.length }
                  : { ...s, index: (s.index - 1 + s.urls.length) % s.urls.length }
                : s,
            );
          }
        }
        touchXRef.current = null;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setState(null); // 点背景关闭
      }}
    >
      {/* 顶部工具条 */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
        <span className="text-xs text-white/70">
          {multiple ? `${state.index + 1} / ${state.urls.length}` : ""}
          {isPdf ? " · PDF" : ""}
        </span>
        <div className="flex items-center gap-1">
          {!isPdf && (
            <>
              <button
                type="button"
                onClick={() => zoomBy(1 / 1.25)}
                className="grid size-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10"
                aria-label="zoom out"
              >
                <ZoomOut className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(1.25)}
                className="grid size-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10"
                aria-label="zoom in"
              >
                <ZoomIn className="size-5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setState(null)}
            className="grid size-9 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            aria-label="close"
          >
            <X className="size-6" />
          </button>
        </div>
      </div>

      {/* 左右切换 */}
      {multiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setState((s) => s && { ...s, index: (s.index - 1 + s.urls.length) % s.urls.length });
              setScale(1);
              scaleRef.current = 1;
            }}
            className="absolute left-2 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white/90 transition-colors hover:bg-black/60"
            aria-label="previous"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setState((s) => s && { ...s, index: (s.index + 1) % s.urls.length });
              setScale(1);
              scaleRef.current = 1;
            }}
            className="absolute right-2 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white/90 transition-colors hover:bg-black/60"
            aria-label="next"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      {/* 内容 */}
      <div
        className="flex max-h-[88vh] max-w-[92vw] items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isPdf ? (
          <iframe
            src={url}
            title="pdf-preview"
            className="h-[85vh] w-[80vw] rounded-lg bg-white"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="preview"
            draggable={false}
            className="max-h-[88vh] max-w-[92vw] select-none object-contain transition-transform duration-150 ease-out"
            style={{ transform: `scale(${scale})`, cursor: scale > 1 ? "grab" : "zoom-in" }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              zoomBy(scaleRef.current > 1.2 ? 1 / 1.6 : 1.6);
            }}
          />
        )}
      </div>
    </div>
  );
}
