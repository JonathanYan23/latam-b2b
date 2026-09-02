import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "./db";
import { verifyPassword } from "./password";

const credentialSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          include: {
            retailer: true,
            wholesaler: true,
          },
        });
        if (!user || !user.passwordHash) return null;
        if (!user.active) return null;

        const ok = verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          retailerId: user.retailerId,
          wholesalerId: user.wholesalerId,
          currency: user.currency, // 注册国家决定的账户货币
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/auth" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        // 自定义字段随 JWT 走
        token.role = (user as any).role;
        token.retailerId = (user as any).retailerId;
        token.wholesalerId = (user as any).wholesalerId;
        token.currency = (user as any).currency;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as any;
        session.user.retailerId = token.retailerId as string | undefined;
        session.user.wholesalerId = token.wholesalerId as string | undefined;
        (session.user as any).currency = token.currency as string | undefined;
      }
      return session;
    },
  },
});
