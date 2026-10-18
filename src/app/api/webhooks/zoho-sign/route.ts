import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getZohoAccessToken, markAgreementSigned } from "@/lib/agreements";

/**
 * Zoho Sign completion webhook. Configure the notify URL in Zoho Sign's
 * Settings -> Integrations -> Webhooks as:
 *   https://<your-deployment>/api/webhooks/zoho-sign?secret=<ZOHO_SIGN_WEBHOOK_SECRET>
 * Zoho Sign has no built-in secret-header scheme (unlike Telegram), so the
 * secret is carried in the query string instead and checked here.
 */
export async function POST(req: Request) {
  const expectedSecret = process.env.ZOHO_SIGN_WEBHOOK_SECRET;
  const receivedSecret = new URL(req.url).searchParams.get("secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const requestId: string | undefined = payload?.requests?.request_id;
  const status: string | undefined = payload?.requests?.request_status;
  if (!requestId || !status) {
    return NextResponse.json({ success: false, message: "Missing request_id or request_status" }, { status: 400 });
  }

  if (status !== "completed") {
    return NextResponse.json({ success: true, ignored: true });
  }

  const agreement = await prisma.agreement.findFirst({ where: { externalEnvelopeId: requestId } });
  if (!agreement) {
    return NextResponse.json({ success: true, ignored: true, message: "No matching agreement for this request" });
  }

  if (agreement.status === "SIGNED" || agreement.status === "VOID") return NextResponse.json({ success: true, ignored: true });
  const token = await getZohoAccessToken();
  if (!token) return NextResponse.json({error:"Signing verification unavailable"},{status:503});
  const domain = process.env.ZOHO_SIGN_API_DOMAIN || "sign.zoho.in";
  const verified = await fetch(`https://${domain}/api/v1/requests/${encodeURIComponent(requestId)}`, {headers:{Authorization:`Zoho-oauthtoken ${token}`},signal:AbortSignal.timeout(20000)});
  const remote = await verified.json().catch(()=>null);
  if(!verified.ok || remote?.requests?.request_status !== "completed") return NextResponse.json({error:"Completion not verified"},{status:409});
  await markAgreementSigned(agreement.id);
  return NextResponse.json({ success: true });
}
