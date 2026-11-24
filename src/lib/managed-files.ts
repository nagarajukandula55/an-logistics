import { ManagedFileCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadFileToGoogleDrive } from "@/lib/google-drive";

export async function importUrlAsManagedFile(input: { url: string; name: string; category: ManagedFileCategory; orderId?: string; agreementId?: string; invoiceId?: string; customerId?: string }) {
  const source = await fetch(input.url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!source.ok) throw new Error(`Could not fetch document (${source.status}).`);
  const bytes = await source.arrayBuffer();
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("Document is larger than the 25 MB limit.");
  const mimeType = source.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  return importBytesAsManagedFile({ ...input, mimeType, bytes });
}

export async function importBytesAsManagedFile(input: { name: string; mimeType: string; bytes: ArrayBuffer; category: ManagedFileCategory; orderId?: string; agreementId?: string; invoiceId?: string; customerId?: string }) {
  if (input.bytes.byteLength > 25 * 1024 * 1024) throw new Error("Document is larger than the 25 MB limit.");
  const driveFile = await uploadFileToGoogleDrive({ name: input.name, mimeType: input.mimeType, bytes: input.bytes });
  return prisma.managedFile.create({ data: { category: input.category, originalName: input.name, mimeType: input.mimeType, sizeBytes: input.bytes.byteLength, driveFileId: driveFile.id, driveWebViewUrl: driveFile.webViewLink || null, orderId: input.orderId, agreementId: input.agreementId, invoiceId: input.invoiceId, customerId: input.customerId } });
}

