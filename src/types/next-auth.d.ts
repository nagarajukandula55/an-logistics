import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      mustChangePassword: boolean;
      tenantId: string | null;
      tenantType: string | null;
      customerId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    mustChangePassword?: boolean;
    tenantId?: string | null;
    tenantType?: string | null;
    customerId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    mustChangePassword?: boolean;
    tenantId?: string | null;
    tenantType?: string | null;
    customerId?: string | null;
  }
}
