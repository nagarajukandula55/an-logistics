import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe middleware auth instance — no Credentials provider (which
// needs bcrypt/Prisma) so this can run on the edge runtime. The
// `authorized` callback in authConfig decides which routes are public.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
