type DriveFile = { id: string; name?: string; mimeType?: string; size?: string; webViewLink?: string };

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

function configured() {
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN && process.env.GOOGLE_DRIVE_FOLDER_ID);
}

async function accessToken() {
  if (!configured()) throw new Error("Google Drive is not configured. Add the Drive OAuth variables to the deployment.");
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!, refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !data?.access_token) throw new Error("Google Drive access token could not be refreshed.");
  tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

export function isGoogleDriveConfigured() { return configured(); }

export async function uploadFileToGoogleDrive(input: { name: string; mimeType: string; bytes: ArrayBuffer; folderId?: string }) {
  const token = await accessToken();
  const metadata = { name: input.name, parents: [input.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID!] };
  const boundary = `anlogistics-${Date.now()}`;
  const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const payload = new Uint8Array(Buffer.concat([Buffer.from(prefix), Buffer.from(input.bytes), Buffer.from(suffix)]));
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: payload });
  const data = await response.json().catch(() => null) as DriveFile | { error?: unknown } | null;
  if (!response.ok || !data || !("id" in data) || !data.id) throw new Error("Google Drive upload failed.");
  return data;
}

export async function downloadFileFromGoogleDrive(fileId: string) {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Google Drive file download failed.");
  return { bytes: await response.arrayBuffer(), contentType: response.headers.get("content-type") || "application/octet-stream" };
}

