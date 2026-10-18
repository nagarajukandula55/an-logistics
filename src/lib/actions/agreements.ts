"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { AgreementKind, AgreementStatus } from "@prisma/client";
import { sendAgreementForSignature } from "@/lib/agreements";

const createAgreementSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  kind: z.nativeEnum(AgreementKind),
  templateVersion: z.string().min(1, "Template version is required"),
  documentUrl: z.string().url("Enter a valid document URL"),
  signerName: z.string().optional(),
  signerEmail: z.string().email().optional().or(z.literal("")),
  sellRateCardId: z.string().optional(),
  renewalDate: z.string().optional(),
});

export async function createAgreementAction(_prev: { ok: boolean; error?: string }, formData: FormData) {
  await requireOnboardingAdmin();

  const parsed = createAgreementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  if (data.sellRateCardId && !await prisma.sellRateCard.findFirst({ where: { id: data.sellRateCardId, customerId: data.customerId } })) return { ok: false, error: "Rate card must belong to this customer" };
  await prisma.agreement.create({
    data: {
      customerId: data.customerId,
      kind: data.kind,
      templateVersion: data.templateVersion,
      documentUrl: data.documentUrl,
      signerName: data.signerName || null,
      signerEmail: data.signerEmail || null,
      sellRateCardId: data.sellRateCardId || null,
      renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
      status: AgreementStatus.DRAFT,
    },
  });

  revalidatePath("/agreements");
  return { ok: true };
}

const updateAgreementSchema = z.object({
  agreementId: z.string().min(1),
  kind: z.nativeEnum(AgreementKind),
  templateVersion: z.string().min(1, "Template version is required"),
  documentUrl: z.string().url("Enter a valid document URL"),
  signerName: z.string().optional(),
  signerEmail: z.string().email().optional().or(z.literal("")),
  sellRateCardId: z.string().optional(),
  renewalDate: z.string().optional(),
});

// Sent and signed agreements are immutable; prepare a new version for amendments.
export async function updateAgreementAction(_prev: { ok: boolean; error?: string }, formData: FormData) {
  await requireOnboardingAdmin();

  const parsed = updateAgreementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const existing = await prisma.agreement.findUnique({ where: { id: data.agreementId } });
  if (!existing) return { ok: false, error: "Agreement not found" };

  if (existing.status !== "DRAFT") return { ok: false, error: "Sent and signed agreements are locked. Create a new version." };
  if (existing.termsSnapshot && (data.sellRateCardId !== existing.sellRateCardId || data.templateVersion !== existing.templateVersion)) return { ok: false, error: "Frozen terms and rates cannot be replaced. Prepare a new draft." };
  if (data.sellRateCardId && !await prisma.sellRateCard.findFirst({ where: { id: data.sellRateCardId, customerId: existing.customerId } })) return { ok: false, error: "Rate card must belong to this customer" };
  if (existing.termsSnapshot && formData.get("documentMatches") !== "on") return {ok:false,error:"Confirm that the PDF contains the reviewed terms and exact rate schedule."};
  const newSellRateCardId = data.sellRateCardId || null;

  await prisma.$transaction(async (tx) => {
    await tx.agreement.update({
      where: { id: data.agreementId, status: "DRAFT" },
      data: {
        kind: data.kind,
        templateVersion: data.templateVersion,
        documentUrl: data.documentUrl,
        signerName: data.signerName || null,
        signerEmail: data.signerEmail || null,
        sellRateCardId: newSellRateCardId,
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
      },
    });


  });

  revalidatePath("/agreements");
  return { ok: true };
}

export async function sendAgreementForSignatureAction(formData: FormData) {
  await requireOnboardingAdmin();
  const agreementId = String(formData.get("agreementId") ?? "");
  if (!agreementId) throw new Error("Missing agreement id");

  await sendAgreementForSignature(agreementId);
  revalidatePath("/agreements");
}

export async function voidAgreementAction(formData: FormData) {
  await requireOnboardingAdmin();
  const agreementId = String(formData.get("agreementId") ?? "");
  if (!agreementId) throw new Error("Missing agreement id");

  await prisma.agreement.update({
    where: { id: agreementId, status: "DRAFT" },
    data: { status: AgreementStatus.VOID },
  });
  revalidatePath("/agreements");
}
