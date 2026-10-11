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

/**
 * Sends a DRAFT Agreement to Zoho Sign for signature and marks it SENT
 * with the returned request id (stored as externalEnvelopeId, used to
 * correlate the completion webhook — see api/webhooks/zoho-sign).
 *
 * The caller supplies documentUrl (the filled B2B/B2C template, built from
 * the user's Word-doc format — not generated here); it must be a URL this
 * server can fetch (e.g. stored upload), since Zoho Sign takes the file
 * bytes, not a link.
 */
export async function sendAgreementForSignature(agreementId: string): Promise<void> {
  const apiDomain = process.env.ZOHO_SIGN_API_DOMAIN || "sign.zoho.in";
  const accessToken = await getZohoAccessToken();
  if (!accessToken) {
    console.error(`[agreements] Zoho Sign not configured — skipped agreement ${agreementId}`);
    return;
  }

  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    include: { customer: true },
  });
  if (!agreement) {
    console.error(`[agreements] Agreement ${agreementId} not found`);
    return;
  }
  if (!agreement.documentUrl) {
    console.error(`[agreements] Agreement ${agreementId} has no documentUrl set — nothing to send`);
    return;
  }

  const signerEmail = agreement.signerEmail ?? agreement.customer.email;
  if (!signerEmail) {
    console.error(`[agreements] Agreement ${agreementId} has no signer email — nothing to send`);
    return;
  }

  try {
    const fileResponse = await fetch(agreement.documentUrl);
    if (!fileResponse.ok) {
      console.error(`[agreements] Could not fetch documentUrl for agreement ${agreement.id}: ${fileResponse.status}`);
      return;
    }
    const fileBlob = await fileResponse.blob();

    const requestData = {
      requests: {
        request_name: `AN Logistics Agreement — ${agreement.customer.name}`,
        is_quicksend: true,
        actions: [
          {
            action_type: "SIGN",
            recipient_name: agreement.signerName ?? agreement.customer.name,
            recipient_email: signerEmail,
            signing_order: 0,
          },
        ],
      },
    };

    const form = new FormData();
    form.append("file", fileBlob, "agreement.pdf");
    form.append("data", JSON.stringify(requestData));

    const response = await fetch(`https://${apiDomain}/api/v1/requests`, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      body: form,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[agreements] Zoho Sign send failed for agreement ${agreement.id}: ${response.status} ${text}`);
      return;
    }
    const data = (await response.json().catch(() => null)) as {
      requests?: { request_id?: string };
    } | null;
    await prisma.agreement.update({
      where: { id: agreement.id },
      data: {
        status: AgreementStatus.SENT,
        sentAt: new Date(),
        externalEnvelopeId: data?.requests?.request_id ?? undefined,
      },
    });
    await notifyOpsTelegram(
      TelegramNotificationEvent.AGREEMENT_SENT,
      `Agreement sent for e-sign — <b>${agreement.customer.name}</b> (${agreement.kind}).`,
    );
  } catch (error) {
    console.error(`[agreements] Send request failed for agreement ${agreementId}:`, error);
  }
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

  await prisma.$transaction(async (tx) => {
    await tx.agreement.update({
      where: { id: agreementId },
      data: { status: AgreementStatus.SIGNED, signedAt },
    });
    if (agreement.sellRateCardId) {
      await tx.sellRateCard.updateMany({
        where: { customerId: agreement.customerId, id: { not: agreement.sellRateCardId } },
        data: { isActive: false },
      });
      await tx.sellRateCard.update({
        where: { id: agreement.sellRateCardId },
        data: { isActive: true },
      });
    }
  });

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
