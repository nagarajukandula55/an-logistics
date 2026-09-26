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
        // Customer self-service signup — logging in afterwards is handled
        // by the same shared /login page and /post-login role-based
        // redirect, so only signup itself needs to be public here.
        pathname.startsWith("/portal/signup") ||
        // Machine-to-machine surface — authenticated by its own API-key
        // (src/lib/api-auth.ts) / webhook-signature checks, not the
        // session cookie this callback gates.
        pathname.startsWith("/api/v1") ||
        pathname.startsWith("/api/webhooks") ||
        // Scheduled reconciliation, authenticated by its own CRON_SECRET
        // Bearer check (see api/cron/sync-tracking/route.ts) — Vercel's
        // cron invoker has no session cookie to present here.
        pathname.startsWith("/api/cron");

      if (isPublic) return true;
      if (!isLoggedIn) return false;

      const mustChangePassword = auth?.user?.mustChangePassword;
      if (mustChangePassword && pathname !== "/change-password") {
        return Response.redirect(new URL("/change-password", request.nextUrl));
      }
      if (!mustChangePassword && pathname === "/change-password") {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.mustChangePassword = user.mustChangePassword;
        token.tenantId = (user as { tenantId?: string | null }).tenantId ?? null;
        token.tenantType = (user as { tenantType?: string | null }).tenantType ?? null;
        token.customerId = (user as { customerId?: string | null }).customerId ?? null;
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
        session.user.tenantType = (token.tenantType as string | null) ?? null;
        session.user.customerId = (token.customerId as string | null) ?? null;
      }
      return session;
    },
  },
  providers: [], // populated in src/auth.ts
} satisfies NextAuthConfig;
