import { prisma } from "@/lib/prisma";
import { AgreementStatus, TelegramNotificationEvent } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { notifyOpsTelegram } from "@/lib/telegram";

/**
 * Zoho Sign access tokens last 60 minutes; cache in-memory per server
 * instance and refresh a little early rather than on every call.
 */
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export async function getZohoAccessToken(): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }
  const accountsDomain = process.env.ZOHO_SIGN_ACCOUNTS_DOMAIN || "accounts.zoho.in";
  const clientId = process.env.ZOHO_SIGN_CLIENT_ID;
  const clientSecret = process.env.ZOHO_SIGN_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_SIGN_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const response = await fetch(`https://${accountsDomain}/oauth/v2/token?${params}`, { method: "POST" });
  if (!response.ok) {
    console.error(`[agreements] Zoho token refresh failed: ${response.status} ${await response.text().catch(() => "")}`);
    return null;
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
  };
  return cachedAccessToken.token;
}

// Create, persist the remote ID, then submit. A timed-out upload is never
// automatically repeated: operations must reconcile it in Zoho first.
export async function sendAgreementForSignature(agreementId: string): Promise<void> {
  const apiDomain = process.env.ZOHO_SIGN_API_DOMAIN || "sign.zoho.in";
  const token = await getZohoAccessToken();
  if (!token) throw new Error("Configure Zoho Sign credentials before sending.");
  const headers = { Authorization: `Zoho-oauthtoken ${token}` };
  const agreement = await prisma.agreement.findUnique({ where: { id: agreementId }, include: { customer: true } });
  if (!agreement || !["DRAFT", "SENDING"].includes(agreement.status)) throw new Error("This agreement cannot be sent again.");
  const signerEmail = agreement.signerEmail || agreement.customer.email;
  if (!signerEmail) throw new Error("A signer email is required.");
  let requestId = agreement.externalEnvelopeId;
  if (!requestId) {
    if (agreement.status === "SENDING") throw new Error("Upload outcome is uncertain. Reconcile this agreement in Zoho before creating another request.");
    if (!agreement.documentUrl) throw new Error("Add the reviewed PDF URL, including a Zoho signature text tag, before sending.");
    const url = new URL(agreement.documentUrl);
    const hosts = (process.env.AGREEMENT_DOCUMENT_HOSTS || "").split(",").map(s => s.trim());
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password) throw new Error("Use an HTTPS PDF URL on an approved AGREEMENT_DOCUMENT_HOSTS host.");
    const fileResponse = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
    if (!fileResponse.ok) throw new Error("Unable to retrieve the agreement PDF.");
    const file = await fileResponse.blob();
    if (file.size > 10 * 1024 * 1024 || !(await file.slice(0, 5).text()).startsWith("%PDF-")) throw new Error("Document must be a PDF smaller than 10 MB.");
    const locked = await prisma.agreement.updateMany({ where: { id: agreementId, status: "DRAFT", updatedAt: agreement.updatedAt }, data: { status: "SENDING" } });
    if (!locked.count) throw new Error("Agreement changed or sending is already in progress. Reload the page.");
    const form = new FormData();
    form.append("file", file, "agreement.pdf");
    form.append("data", JSON.stringify({ requests: { request_name: agreement.title || `AN Logistics — ${agreement.customer.name}`, is_sequential: true, expiration_days: 15 } }));
    const response = await fetch(`https://${apiDomain}/api/v1/requests`, { method: "POST", headers, body: form, signal: AbortSignal.timeout(30000) });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.status !== "success" || !data?.requests?.request_id) throw new Error("Zoho upload could not be confirmed. Check the envelope in Zoho before retrying.");
    requestId = String(data.requests.request_id);
    await prisma.agreement.update({ where: { id: agreementId, status: "SENDING" }, data: { externalEnvelopeId: requestId } });
  }
  const currentResponse = await fetch(`https://${apiDomain}/api/v1/requests/${encodeURIComponent(requestId)}`, { headers, signal: AbortSignal.timeout(20000) });
  const current = await currentResponse.json().catch(() => null);
  if (!currentResponse.ok || !current?.requests) throw new Error("Could not check the Zoho envelope. Retry to resume the same request.");
  let remoteStatus = current.requests.request_status;
  if (remoteStatus === "draft") {
    const form = new FormData();
    form.append("data", JSON.stringify({ requests: { actions: [{ action_type: "SIGN", recipient_name: agreement.signerName || agreement.customer.name, recipient_email: signerEmail, verify_recipient: true, verification_type: "EMAIL", signing_order: 0 }] } }));
    const response = await fetch(`https://${apiDomain}/api/v1/requests/${encodeURIComponent(requestId)}/submit`, { method: "POST", headers, body: form, signal: AbortSignal.timeout(30000) });
    const submitted = await response.json().catch(() => null);
    if (!response.ok || submitted?.status !== "success") throw new Error("Zoho submission failed. Verify the PDF signature tags in Zoho, then resume this request.");
    remoteStatus = submitted.requests?.request_status;
  }
  if (!["inprogress", "completed"].includes(remoteStatus)) throw new Error("Zoho has not confirmed sending. Check the envelope status.");
  const changed = await prisma.agreement.updateMany({ where: { id: agreementId, status: "SENDING" }, data: { status: "SENT", sentAt: new Date() } });
  if (changed.count) await notifyOpsTelegram(TelegramNotificationEvent.AGREEMENT_SENT, `Agreement sent for e-sign: ${agreementId}`);
  if (remoteStatus === "completed") await markAgreementSigned(agreementId);
}
/**
 * Fetches the (signed, once complete) PDF for a Zoho Sign request as raw
 * bytes — used both to email a copy out and to stream it back for the
 * in-app "view document" button (api/agreements/[id]/document).
 */
export async function fetchAgreementPdf(requestId: string): Promise<Buffer | null> {
  const apiDomain = process.env.ZOHO_SIGN_API_DOMAIN || "sign.zoho.in";
  const accessToken = await getZohoAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`https://${apiDomain}/api/v1/requests/${requestId}/pdf`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!response.ok) {
    console.error(`[agreements] Fetch PDF failed for request ${requestId}: ${response.status}`);
    return null;
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Marks an Agreement SIGNED and activates its agreed SellRateCard (the
 * price list the signature was actually for) for the Customer — called
 * from Zoho Sign's completion webhook (api/webhooks/zoho-sign). Deactivates
 * any other active SellRateCard on the Customer first so getSellPrice
 * resolves to exactly one. Then emails a copy of the signed PDF to both the
 * signer and our own internal address (AGREEMENTS_NOTIFY_EMAIL) — best
 * effort, logged but not thrown on failure, since the signing itself has
 * already succeeded at this point.
 */
export async function markAgreementSigned(agreementId: string, signedAt: Date = new Date()): Promise<void> {
  const agreement = await prisma.agreement.findUnique({ where: { id: agreementId }, include: { customer: true } });
  if (!agreement) throw new Error(`Agreement ${agreementId} not found`);

  const applied = await prisma.$transaction(async (tx) => {
    const locked = await tx.agreement.updateMany({ where: { id: agreementId, status: { in: [AgreementStatus.SENT, AgreementStatus.SENDING] } }, data: { status: AgreementStatus.SIGNED, signedAt } });
    if (!locked.count) return false;
    await tx.agreement.update({
      where: { id: agreementId },
      data: { status: AgreementStatus.SIGNED, signedAt },
    });
    if (agreement.sellRateCardId) {
      const card = await tx.sellRateCard.findFirst({ where: { id: agreement.sellRateCardId, customerId: agreement.customerId } });
      if (!card) throw new Error("Agreement rate card does not belong to the signer.");
      await tx.sellRateCard.updateMany({
        where: { customerId: agreement.customerId, id: { not: agreement.sellRateCardId } },
        data: { isActive: false },
      });
      await tx.sellRateCard.update({
        where: { id: agreement.sellRateCardId },
        data: { isActive: true },
      });
    }
    return true;
  });
  if (!applied) return;

  await notifyOpsTelegram(
    TelegramNotificationEvent.AGREEMENT_SIGNED,
    `Agreement signed — <b>${agreement.customer.name}</b> (${agreement.kind}), ${signedAt.toDateString()}.`,
  );

  if (!agreement.externalEnvelopeId) return;
  const pdf = await fetchAgreementPdf(agreement.externalEnvelopeId);
  if (!pdf) {
    console.error(`[agreements] Could not fetch signed PDF for agreement ${agreementId} — skipping copy email`);
    return;
  }

  const signerEmail = agreement.signerEmail ?? agreement.customer.email;
  const internalEmail = process.env.AGREEMENTS_NOTIFY_EMAIL;
  const recipients = [signerEmail, internalEmail].filter((e): e is string => Boolean(e));
  if (recipients.length === 0) return;

  const attachments = [{ filename: `agreement-${agreement.id}.pdf`, content: pdf }];
  await sendEmail({
    to: recipients,
    subject: `Signed agreement — ${agreement.customer.name}`,
    html: `<p>Attached is the fully signed copy of the ${agreement.kind} agreement between AN Logistics and ${agreement.customer.name}, signed on ${signedAt.toDateString()}.</p>`,
    attachments,
  });
}
