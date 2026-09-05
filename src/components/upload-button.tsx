"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

/** 通用上传按钮：选择文件 → POST /api/upload → 回调 url */
export function UploadButton({
  onUploaded,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  label,
  compact = false,
}: {
  onUploaded: (url: string) => void;
  accept?: string;
  label?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(null);
          startTransition(async () => {
            try {
              const fd = new FormData();
              fd.append("file", file);
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "upload_failed");
              onUploaded(data.url);
            } catch (err) {
              setError(err instanceof Error ? err.message : "upload_failed");
            }
          });
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink-3)] disabled:opacity-50"
            : "btn btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
        }
      >
        {pending ? (
          <Loader2 className={compact ? "size-3.5 animate-spin" : "size-4 animate-spin"} />
        ) : (
          <ImagePlus className={compact ? "size-3.5" : "size-4"} />
        )}
        {label ?? (pending ? "Uploading…" : "Upload")}
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
