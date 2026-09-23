"use client";

import { useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** 邀请新客户：复制带邀请标识的注册链接 */
export function InviteCustomerButton({
  wholesalerId,
  label,
  copiedLabel,
}: {
  wholesalerId: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${location.origin}/auth?invite=${wholesalerId}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // 剪贴板不可用时静默降级（仍给出提示）
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        toast.success(copiedLabel);
      }}
      className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
    >
      {copied ? <Check className="size-4 text-[var(--color-success)]" /> : <UserPlus className="size-4" />}
      {label}
    </button>
  );
}
