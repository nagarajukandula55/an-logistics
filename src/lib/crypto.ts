import crypto from "crypto";

// AES-256-GCM encryption for secrets at rest (e.g. CourierApiConfig.apiKeyEncrypted).
//
// ENCRYPTION_KEY must be a base64-encoded 32-byte key. Generate one with:
//   openssl rand -base64 32
//
// Stored format: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and set it in your environment before storing any encrypted secret."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). Generate one with \`openssl rand -base64 32\`.`
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decrypt(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value — expected iv:authTag:ciphertext");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Encrypts an API key for storage in CourierApiConfig.apiKeyEncrypted. */
export function encryptApiKey(plaintext: string): string {
  return encrypt(plaintext);
}

/** Decrypts a CourierApiConfig.apiKeyEncrypted value for actual use against a real API. */
export function decryptApiKey(stored: string): string {
  return decrypt(stored);
}
