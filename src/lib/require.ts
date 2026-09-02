import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { UserRole } from "@prisma/client";

export interface PortalSession {
  userId: string;
  name?: string | null;
  email?: string | null;
  retailerId?: string | null;
  wholesalerId?: string | null;
}

/** 要求已登录且为指定角色，否则重定向；返回安全会话 */
export async function requireRole(role: UserRole): Promise<PortalSession> {
  const session = await auth();
  if (!session?.user || session.user.role !== role) {
    redirect(session?.user ? "/" : "/auth");
  }
  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    retailerId: session.user.retailerId ?? null,
    wholesalerId: session.user.wholesalerId ?? null,
  };
}
