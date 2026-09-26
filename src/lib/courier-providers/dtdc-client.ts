// Thin DTDC HTTP client, parameterized by per-partner credentials (decrypted
// CourierApiConfig) rather than a global env var — same reasoning as the
// former shiprocket-client.ts: multiple DTDC-backed partners (our own
// account today, a client tenant's own DTDC account later) can coexist.
//
// DTDC's current partner platform ("Shipsy") authenticates with a single
// static API key sent as an `api-key` header (see the API Playground at
// dtdc.portal.shipsy.in/ops/dashboard/manage/apiDocs — "API Key (api-key)"
// lock icon on every endpoint), not OAuth/login-token exchange like
// Shiprocket. There's no separate login call, so no token cache is needed
// here — just attach the key to every request.
//
// baseUrl is the customer-specific API host DTDC issues alongside the key
// (visible under Setup / Integration Logs in the portal) — not hardcoded
// here since it may differ per account/environment (staging vs prod).

export type DtdcCredentials = {
  baseUrl: string;
  apiKey: string;
  customerCode: string; // DTDC's `customer_code` — required on most request bodies
  hubCode: string; // DTDC's Order Manifestation Hub Code for the pickup branch, e.g. "VF1808"
};

export async function dtdcRequest(
  creds: DtdcCredentials,
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${creds.baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "api-key": creds.apiKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `DTDC request failed (${response.status})`);
  }
  return data;
}
