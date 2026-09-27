import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";

// GET /api/v1/tenant — the calling tenant's own profile, currently just the
// pickup point it should use when booking shipments (see Tenant.pickup* /
// PickupDetailsPanel.tsx). Lets a caller (e.g. angroup) fetch this instead
// of duplicating it in its own env vars — edited once, here.
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { tenant } = auth;
  return NextResponse.json({
    success: true,
    data: {
      id: tenant.id,
      name: tenant.name,
      pickupAddress: tenant.pickupAddress,
      pickupPincode: tenant.pickupPincode,
      pickupContactName: tenant.pickupContactName,
      pickupContactPhone: tenant.pickupContactPhone,
    },
  });
}
