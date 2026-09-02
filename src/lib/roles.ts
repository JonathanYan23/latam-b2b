import type { UserRole } from "@prisma/client";

/** 角色可访问的 portal 首页 */
export const ROLE_HOME: Record<UserRole, string> = {
  RETAILER: "/retailer",
  WHOLESALER: "/wholesaler",
  ADMIN: "/admin",
};

/** 根据角色返回默认落地页 */
export function homeForRole(role: UserRole): string {
  return ROLE_HOME[role] ?? "/";
}

/** 该角色是否允许访问目标路径段 */
export function canAccess(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith("/admin")) return role === "ADMIN";
  if (pathname.startsWith("/wholesaler")) return role === "WHOLESALER";
  if (pathname.startsWith("/retailer")) return role === "RETAILER";
  return true;
}
