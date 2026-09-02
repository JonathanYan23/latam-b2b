"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/lib/auth";
import { getActionLocale, dictForLocale } from "@/i18n";
import { homeForRole } from "@/lib/roles";
import { UserRole } from "@prisma/client";
import {
  generateCode,
  storeCode,
  sendVerificationEmail,
  consumeCode,
} from "@/lib/verify-email";

const registerSchema = z.object({
  fullName: z.string().min(2, "name"),
  businessName: z.string().min(2, "business"),
  email: z.string().email("email"),
  password: z.string().min(6, "password"),
  role: z.enum(["retailer", "wholesaler"]),
  countryId: z.string().min(1, "country"),
  verificationCode: z.string().regex(/^\d{6}$/, "code"),
});

export type RegisterState = { error?: string } | undefined;

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const [locale, parsed] = await Promise.all([
    getActionLocale(),
    Promise.resolve(
      registerSchema.safeParse({
        fullName: formData.get("fullName"),
        businessName: formData.get("businessName"),
        email: formData.get("email"),
        password: formData.get("password"),
        role: formData.get("role"),
        countryId: formData.get("countryId"),
        verificationCode: formData.get("verificationCode"),
      }),
    ),
  ]);

  // 语言相关错误消息
  const a = dictForLocale(locale).auth;

  if (!parsed.success) {
    const code = parsed.error.errors[0]?.message;
    const map: Record<string, string> = {
      name: a.errName,
      business: a.errBusiness,
      email: a.errEmail,
      password: a.errPassword,
      country: a.errCountry,
      code: a.errCode,
    };
    return { error: map[code] ?? a.errInvalidForm };
  }

  const { fullName, businessName, email, password, role, countryId, verificationCode } =
    parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) return { error: a.errExists };

  // 国家必须存在且启用 → 决定账户货币
  const country = await db.country.findFirst({
    where: { code: countryId, active: true },
  });
  if (!country) return { error: a.errCountry };

  // 邮箱验证码校验（通过即消费）
  const codeResult = await consumeCode(normalizedEmail, verificationCode);
  if (codeResult !== "ok") return { error: a.errCodeInvalid };

  const userRole: UserRole = role === "wholesaler" ? "WHOLESALER" : "RETAILER";

  try {
    const business = await db.business.create({
      data: {
        legalName: businessName.trim(),
        tradeName: businessName.trim(),
        countryId: country.id,
      },
    });

    const [retailer, wholesaler] =
      userRole === "RETAILER"
        ? [
            await db.retailer.create({
              data: { businessId: business.id },
            }),
            null,
          ]
        : [
            null,
            await db.wholesaler.create({
              data: { businessId: business.id },
            }),
          ];

    await db.user.create({
      data: {
        email: normalizedEmail,
        name: fullName,
        passwordHash: hashPassword(password),
        role: userRole,
        currency: country.currency, // 注册国家决定账户货币（显示符号）
        retailerId: retailer?.id ?? null,
        wholesalerId: wholesaler?.id ?? null,
      },
    });

    await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirectTo: userRole === "WHOLESALER" ? "/wholesaler" : "/retailer",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("register error", error);
    return { error: a.errRegister };
  }

  redirect("/");
}

export async function loginAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = await getActionLocale();
  const dict = dictForLocale(locale);

  // 预查角色，登录成功后直达对应工作台（避免再回首页手动选择身份）
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { role: true },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: user ? homeForRole(user.role) : "/",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    return { error: dict.auth.errInvalid };
  }
  redirect("/");
}

/**
 * 发送邮箱验证码（注册前校验邮箱归属）。
 * 由客户端按钮事件调用（非 useActionState 表单）。
 */
export async function requestVerificationAction(
  emailRaw: string,
): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const locale = await getActionLocale();
  const a = dictForLocale(locale).auth;
  const email = String(emailRaw ?? "").trim().toLowerCase();

  if (!z.string().email().safeParse(email).success) {
    return { ok: false, error: a.errEmail };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: a.errEmailTaken };

  const code = generateCode();
  await storeCode(email, code);
  const r = await sendVerificationEmail(email, code);
  if (!r.sent) return { ok: false, error: r.error ?? a.errMailFailed };

  return { ok: true, devCode: r.devCode };
}
