import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ pincode: string }> };
const CENTRAL_API_URL = process.env.CENTRAL_API_URL;
const CENTRAL_API_KEY = process.env.CENTRAL_API_KEY;
const INDIA_POST_API = "https://api.postalpincode.in/pincode";

async function centralLookup(pincode: string) {
  if (!CENTRAL_API_URL) return null;
  const response = await fetch(`${CENTRAL_API_URL}/api/v1/pincode?search=${encodeURIComponent(`pincode:${pincode}`)}&limit=1`, { headers: { "x-api-key": CENTRAL_API_KEY || "" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Central pincode lookup failed (${response.status})`);
  const body = await response.json();
  return body.items?.[0] ?? null;
}

async function indiaPostLookup(pincode: string) {
  const response = await fetch(`${INDIA_POST_API}/${pincode}`, { cache: "no-store" });
  if (!response.ok) return null;
  const body = await response.json();
  const postOffice = body?.[0]?.PostOffice?.[0];
  if (!postOffice) return null;
  return { pincode, state: postOffice.State || "", district: postOffice.District || "", city: postOffice.Block || postOffice.District || "", locality: postOffice.Name || undefined };
}

async function cacheCentral(entry: { pincode: string; state: string; district: string; city: string; locality?: string }) {
  if (!CENTRAL_API_URL) return;
  try { await fetch(`${CENTRAL_API_URL}/api/v1/pincode`, { method: "POST", headers: { "x-api-key": CENTRAL_API_KEY || "", "Content-Type": "application/json" }, body: JSON.stringify(entry) }); } catch { /* cache failure must not block lookup */ }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { pincode } = await context.params;
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return NextResponse.json({ success: false, message: "Invalid pincode format" }, { status: 400 });
  try {
    const entry = (await centralLookup(pincode)) || (await indiaPostLookup(pincode));
    if (!entry) return NextResponse.json({ success: true, found: false }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
    if (!entry._id) await cacheCentral(entry);
    return NextResponse.json({ success: true, found: true, state: entry.state, district: entry.district, city: entry.city, locality: entry.locality }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Pincode lookup failed" }, { status: 502 });
  }
}
