"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { dictForLocale, getActionLocale } from "@/i18n";

/** 修改当前登录用户密码（需验证当前密码） */
export async function updatePasswordAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await auth();
  const t = dictForLocale(await getActionLocale());
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { ok: false, error: t.security.passwordTooShort };
  if (next !== confirm) return { ok: false, error: t.security.mismatch };

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "Not found" };
  if (!verifyPassword(current, user.passwordHash ?? '')) {
    return { ok: false, error: t.security.wrongPassword };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(next) },
  });
  return { ok: true };
}
