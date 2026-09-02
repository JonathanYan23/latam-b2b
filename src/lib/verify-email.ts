// =============================================================
// 邮箱验证码：生成 / Resend 发送 / 校验消费
// 生产必须配置 RESEND_API_KEY（真实发信）；
// 未配置时（本地 dev）降级为「日志输出 + 返回 devCode 供页面提示」，
// 仅用于演示走通流程，生产环境绝不返回验证码。
// =============================================================

import { randomInt } from "crypto";
import { db } from "@/lib/db";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 分钟有效

export function generateCode(): string {
  return String(randomInt(100000, 1000000)); // 6 位
}

/** 本地开发降级（未配邮件服务）：仅非生产环境允许透出验证码便于演示 */
export function isDevMail(): boolean {
  return !process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production";
}

/**
 * 发送验证码邮件。
 * 返回 { sent: true, devCode?: string } —— devCode 仅本地开发无 key 时存在；
 * 生产未配置 RESEND_API_KEY 时拒绝发送（不泄露验证码）。
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
): Promise<{ sent: boolean; devCode?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ?? "Latam B2B <onboarding@resend.dev>";

  if (!apiKey) {
    if (isDevMail()) {
      // 本地开发降级：验证码打在服务端日志并透出（仅非生产）
      console.log(`[verify-email:dev] code for ${email} = ${code}`);
      return { sent: true, devCode: code };
    }
    console.error("[verify-email] RESEND_API_KEY is not configured (production)");
    return { sent: false, error: "mail_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Your Latam B2B verification code: ${code}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#111">Latam B2B verification</h2>
            <p>Use the code below to verify your email address. It expires in 10 minutes.</p>
            <div style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f4f4f5;border-radius:8px;padding:12px;text-align:center;margin:16px 0">
              ${code}
            </div>
            <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
          </div>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend send failed", res.status, body.slice(0, 300));
      return { sent: false, error: "mail_failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("Resend error", e);
    return { sent: false, error: "mail_failed" };
  }
}

/** 写入验证码（同邮箱旧码作废） */
export async function storeCode(email: string, code: string): Promise<void> {
  await db.verificationCode.deleteMany({ where: { email } });
  await db.verificationCode.create({
    data: { email, code, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
}

/**
 * 校验并消费验证码。
 * 通过条件：存在、匹配、未用过、未过期。消费后标记 usedAt，防止复用。
 */
export async function consumeCode(
  email: string,
  code: string,
): Promise<"ok" | "invalid" | "expired" | "used"> {
  const rec = await db.verificationCode.findFirst({
    where: { email, code },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return "invalid";
  if (rec.usedAt) return "used";
  if (rec.expiresAt.getTime() < Date.now()) return "expired";
  await db.verificationCode.update({
    where: { id: rec.id },
    data: { usedAt: new Date() },
  });
  return "ok";
}
