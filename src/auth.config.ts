import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared between the full auth setup (src/auth.ts) and the
// middleware. Must not import anything that touches Node-only APIs
// (bcrypt, Prisma) — middleware runs on the edge runtime.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/track") ||
        pathname.startsWith("/book") ||
        // Machine-to-machine surface — authenticated by its own API-key
        // (src/lib/api-auth.ts) / webhook-signature checks, not the
        // session cookie this callback gates.
        pathname.startsWith("/api/v1") ||
        pathname.startsWith("/api/webhooks");

      if (isPublic) return true;
      if (!isLoggedIn) return false;

      const mustChangePassword = auth?.user?.mustChangePassword;
      if (mustChangePassword && pathname !== "/change-password") {
        return Response.redirect(new URL("/change-password", request.nextUrl));
      }
      if (!mustChangePassword && pathname === "/change-password") {
        return Response.redirect(new URL("/orders", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.mustChangePassword = user.mustChangePassword;
        token.tenantId = (user as { tenantId?: string | null }).tenantId ?? null;
      }
      if (trigger === "update" && session?.user?.mustChangePassword === false) {
        token.mustChangePassword = false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.tenantId = (token.tenantId as string | null) ?? null;
      }
      return session;
    },
  },
  providers: [], // populated in src/auth.ts
} satisfies NextAuthConfig;
