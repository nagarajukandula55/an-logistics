"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
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
  await requireTenantSession();

  const parsed = createAgreementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

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

/**
 * Edits an existing agreement's terms — the document, signer details,
 * renewal date, and which SellRateCard it's tied to. The agreed rate isn't
 * fixed at creation: if the agreement is already SIGNED and the rate card
 * selection changes, the newly-selected card is activated for the customer
 * immediately (same supersede logic as markAgreementSigned), so correcting
 * a negotiated rate here takes effect right away rather than waiting for a
 * re-sign. Document/signer/kind fields on a SENT agreement can still be
 * edited, but won't retroactively change what's already out for signature
 * at Zoho — re-send after editing if the in-flight request needs to change.
 */
export async function updateAgreementAction(_prev: { ok: boolean; error?: string }, formData: FormData) {
  await requireTenantSession();

  const parsed = updateAgreementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const existing = await prisma.agreement.findUnique({ where: { id: data.agreementId } });
  if (!existing) return { ok: false, error: "Agreement not found" };

  const newSellRateCardId = data.sellRateCardId || null;

  await prisma.$transaction(async (tx) => {
    await tx.agreement.update({
      where: { id: data.agreementId },
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

    if (existing.status === AgreementStatus.SIGNED && newSellRateCardId && newSellRateCardId !== existing.sellRateCardId) {
      await tx.sellRateCard.updateMany({
        where: { customerId: existing.customerId, id: { not: newSellRateCardId } },
        data: { isActive: false },
      });
      await tx.sellRateCard.update({
        where: { id: newSellRateCardId },
        data: { isActive: true },
      });
    }
  });

  revalidatePath("/agreements");
  return { ok: true };
}

export async function sendAgreementForSignatureAction(formData: FormData) {
  await requireTenantSession();
  const agreementId = String(formData.get("agreementId") ?? "");
  if (!agreementId) throw new Error("Missing agreement id");

  await sendAgreementForSignature(agreementId);
  revalidatePath("/agreements");
}

export async function voidAgreementAction(formData: FormData) {
  await requireTenantSession();
  const agreementId = String(formData.get("agreementId") ?? "");
  if (!agreementId) throw new Error("Missing agreement id");

  await prisma.agreement.update({
    where: { id: agreementId },
    data: { status: AgreementStatus.VOID },
  });
  revalidatePath("/agreements");
}
