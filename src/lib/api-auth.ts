import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Tenant } from "@prisma/client";

export type ApiAuthResult = { tenant: Tenant; scopes: string[] };

// Machine-to-machine auth for the /api/v1/* surface, separate from the
// human Credentials/session login in src/auth.ts. A caller (e.g. angroup)
// sends `Authorization: Bearer anl_<secret>`; we hash it and match against
// TenantApiKey.keyHash — the plaintext key is shown once at creation time
// (see src/lib/actions/tenants.ts) and never stored.
export async function authenticateApiKey(req: Request): Promise<ApiAuthResult | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const plaintextKey = header.slice("Bearer ".length).trim();
  if (!plaintextKey.startsWith("anl_")) return null;

  const keyHash = crypto.createHash("sha256").update(plaintextKey).digest("hex");

  const apiKey = await prisma.tenantApiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: { tenant: true },
  });
  if (!apiKey) return null;

  // Best-effort — not on the hot path's success/failure, so don't block the
  // response on it.
  prisma.tenantApiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { tenant: apiKey.tenant, scopes: apiKey.scopes };
}

export function requireScope(auth: ApiAuthResult, scope: string): boolean {
  return auth.scopes.includes(scope);
}
