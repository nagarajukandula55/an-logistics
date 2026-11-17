"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DocumentTemplateKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3).max(120),
  version: z.string().trim().min(1).max(40),
  kind: z.nativeEnum(DocumentTemplateKind),
  courierPartnerId: z.string().optional(),
  html: z.string().min(50).max(250000),
});

export async function saveDocumentTemplateAction(formData: FormData) {
  await requireOnboardingAdmin();
  const parsed = templateSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    name: formData.get("name"),
    version: formData.get("version"),
    kind: formData.get("kind"),
    courierPartnerId: String(formData.get("courierPartnerId") ?? "").trim() || undefined,
    html: formData.get("html"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template" };
  const data = parsed.data;
  if (data.courierPartnerId && !await prisma.courierPartner.findUnique({ where: { id: data.courierPartnerId }, select: { id: true } })) return { ok: false, error: "Courier not found" };
  try {
    if (data.id) {
      await prisma.documentTemplate.update({ where: { id: data.id }, data: { name: data.name, version: data.version, kind: data.kind, courierPartnerId: data.courierPartnerId ?? null, html: data.html } });
    } else {
      await prisma.documentTemplate.create({ data: { name: data.name, version: data.version, kind: data.kind, courierPartnerId: data.courierPartnerId ?? null, html: data.html } });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { ok: false, error: "A template with this name, version, type and courier already exists" };
    throw error;
  }
  revalidatePath("/documents");
  revalidatePath("/quotations");
  revalidatePath("/agreements");
  return { ok: true };
}

export async function deactivateDocumentTemplateAction(id: string) {
  await requireOnboardingAdmin();
  await prisma.documentTemplate.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/documents");
  return { ok: true };
}
