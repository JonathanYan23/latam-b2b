"use client";

/**
 * OfflineBanner —— 断网提示条
 *
 * 生产环境必备的韧性反馈：离线时常驻顶部细条，恢复后自动消失。
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WifiOff } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { useClientMounted } from "./use-mounted";

export function OfflineBanner() {
  const { t } = useI18n();
  const mounted = useClientMounted();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!mounted || !offline) return null;

  return createPortal(
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[195] flex items-center justify-center gap-2 bg-[#1d1d1f] px-4 py-2 text-[12px] font-medium text-white shadow-[0_2px_12px_rgba(0,0,0,.25)] animate-[toastIn_.25s_ease]"
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span className="truncate">{t.ui.networkError}</span>
    </div>,
    document.body,
  );
}
