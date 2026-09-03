// Thin Shiprocket HTTP client, parameterized by per-partner credentials
// (decrypted CourierApiConfig) rather than global env vars — each
// CourierPartner row with provider="SHIPROCKET" carries its own baseUrl +
// email/password, so multiple Shiprocket-backed partners (e.g. our own
// account and a client tenant's own Shiprocket account) can coexist.
// Ported from angroup/src/lib/shipping/shiprocket.ts, which proved this
// exact auth + request flow against the real Shiprocket API.

export type ShiprocketCredentials = {
  baseUrl: string;
  email: string;
  password: string;
};

type CachedToken = { token: string; expiry: number };
const tokenCache = new Map<string, CachedToken>();

function cacheKey(creds: ShiprocketCredentials) {
  return `${creds.baseUrl}:${creds.email}`;
}

export async function getShiprocketToken(creds: ShiprocketCredentials): Promise<string> {
  const key = cacheKey(creds);
  const cached = tokenCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.token;

  const response = await fetch(`${creds.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });

  const data = await response.json();
  if (!response.ok || !data?.token) {
    throw new Error(data?.message || "Shiprocket login failed");
  }

  tokenCache.set(key, { token: data.token, expiry: Date.now() + 8 * 60 * 60 * 1000 });
  return data.token;
}

export async function shiprocketRequest(
  creds: ShiprocketCredentials,
  endpoint: string,
  options: RequestInit = {}
) {
  const token = await getShiprocketToken(creds);

  const response = await fetch(`${creds.baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "Shiprocket request failed");
  }
  return data;
}
