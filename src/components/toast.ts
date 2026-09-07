"use client";

/** 轻量全局 toast：直接向 body 追加浮动提示，3 秒自动消失 */
export function toast(message: string, type: "success" | "warning" | "error" = "success") {
  if (typeof document === "undefined") return;
  const color =
    type === "error"
      ? "var(--color-danger)"
      : type === "warning"
        ? "var(--color-warning)"
        : "var(--color-success)";
  const el = document.createElement("div");
  el.innerText = message;
  el.style.cssText = [
    "position:fixed",
    "top:1rem",
    "right:1rem",
    "z-index:9999",
    "max-width:320px",
    "background:#111827",
    "color:#fff",
    "padding:0.625rem 0.875rem",
    "border-radius:10px",
    "font-size:0.8125rem",
    "line-height:1.35",
    "box-shadow:0 8px 24px rgba(0,0,0,.16)",
    "opacity:0",
    "transform:translateY(-6px)",
    "transition:opacity .2s ease,transform .2s ease",
  ].join(";");
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
  // 左侧色条提示类型
  const bar = document.createElement("div");
  bar.style.cssText = `position:absolute;left:0;top:0;bottom:0;width:3px;background:${color};border-radius:10px 0 0 10px;`;
  el.style.position = "fixed";
  el.appendChild(bar);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
    setTimeout(() => el.remove(), 220);
  }, 3000);
}
