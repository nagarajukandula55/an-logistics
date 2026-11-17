"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import { readXlsxRows } from "@/lib/xlsx-xml";

const uploadSchema = z.object({ name: z.string().trim().min(2), effectiveFrom: z.string().min(1) });

function headerIndex(headers: string[], names: string[]): number {
  return headers.findIndex((header) => names.includes(header.trim().toLowerCase().replace(/[_-]/g, " ")));
}

export async function uploadTatWorkbookAction(formData: FormData) {
  const { session } = await requireTenantSession();
  if (session.user.role !== "ADMIN") throw new Error("Only administrators can upload TAT workbooks");
  const parsed = uploadSchema.safeParse({ name: formData.get("name"), effectiveFrom: formData.get("effectiveFrom") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Enter the TAT schedule details");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Upload an .xlsx workbook");
  const rows = readXlsxRows(Buffer.from(await file.arrayBuffer()));
  const headers = (rows.shift() ?? []).map((header) => header.trim().toLowerCase().replace(/[_-]/g, " "));
  const destinationIndex = headerIndex(headers, ["destination pincode", "destination pin", "dest pincode", "pincode", "pin code"]);
  const originIndex = headerIndex(headers, ["origin pincode", "origin pin", "pickup pincode", "pickup pin"]);
  const tatIndex = headerIndex(headers, ["tat days", "tat", "transit days", "delivery days"]);
  if (destinationIndex < 0 || tatIndex < 0) throw new Error("The workbook must have Destination Pincode and TAT Days columns");
  const data = rows.map((row) => ({
    destinationPincode: String(row[destinationIndex] ?? "").trim(),
    originPincode: originIndex >= 0 ? String(row[originIndex] ?? "").trim() || null : null,
    tatDays: Number(row[tatIndex]),
    originCity: String(row[headerIndex(headers, ["origin city", "pickup city"])] ?? "").trim() || null,
    destinationCity: String(row[headerIndex(headers, ["destination city", "delivery city"])] ?? "").trim() || null,
    serviceCode: String(row[headerIndex(headers, ["service", "service code", "product"])] ?? "").trim() || null,
  })).filter((row) => /^[1-9]\d{5}$/.test(row.destinationPincode) && Number.isFinite(row.tatDays) && row.tatDays >= 0);
  if (!data.length) throw new Error("No valid TAT rows were found in the workbook");
  await prisma.$transaction(async (tx) => {
    await tx.tatMatrix.updateMany({ where: { isActive: true }, data: { isActive: false, effectiveTo: new Date(parsed.data.effectiveFrom) } });
    const matrix = await tx.tatMatrix.create({ data: { name: parsed.data.name, sourceFile: file.name, effectiveFrom: new Date(parsed.data.effectiveFrom) } });
    await tx.tatRateRow.createMany({ data: data.map((row) => ({ ...row, matrixId: matrix.id })) });
  });
  revalidatePath("/tat");
  return { count: data.length };
}

export async function lookupTatAction(formData: FormData) {
  await requireTenantSession();
  const destinationPincode = String(formData.get("destinationPincode") ?? "").trim();
  const originPincode = String(formData.get("originPincode") ?? "").trim();
  const serviceCode = String(formData.get("serviceCode") ?? "").trim();
  if (!/^[1-9]\d{5}$/.test(destinationPincode)) throw new Error("Enter a valid destination pincode");
  const matrix = await prisma.tatMatrix.findFirst({ where: { isActive: true, effectiveFrom: { lte: new Date() } }, orderBy: { effectiveFrom: "desc" }, include: { rows: { where: { destinationPincode, ...(serviceCode ? { serviceCode } : {}), ...(originPincode ? { OR: [{ originPincode }, { originPincode: null }] } : {}) }, orderBy: [{ originPincode: "desc" }, { tatDays: "asc" }], take: 1 } } });
  const row = matrix?.rows[0];
  return row ? { found: true, tatDays: row.tatDays, originCity: row.originCity, destinationCity: row.destinationCity, serviceCode: row.serviceCode, matrixName: matrix.name } : { found: false };
}
