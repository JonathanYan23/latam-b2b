import type { UserRole } from "@prisma/client";

// 扩展 NextAuth 的 Session/User 类型
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: UserRole;
      retailerId?: string | null;
      wholesalerId?: string | null;
    };
  }

  interface User {
    role?: UserRole;
    retailerId?: string | null;
    wholesalerId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    retailerId?: string | null;
    wholesalerId?: string | null;
  }
}
