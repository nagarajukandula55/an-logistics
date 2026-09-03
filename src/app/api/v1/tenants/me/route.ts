import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";

// GET /api/v1/tenants/me — lets a caller (e.g. angroup) confirm its API key
// is valid and see its own tenant identity/scopes without needing to
// create a test shipment first.
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    success: true,
    data: { id: auth.tenant.id, slug: auth.tenant.slug, name: auth.tenant.name, type: auth.tenant.type, scopes: auth.scopes },
  });
}
