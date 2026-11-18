"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";

// SellRateCard/Slab management — what we charge, mirrors createRateCardAction
// (what a courier charges us) but keyed by tenantId instead of
// courierPartnerId. tenantId omitted/blank means the default price list
// (normal/marketplace bookings); a CLIENT tenant's own card overrides it.

const sellRateCardSlabSchema = z.object({
  zone: z.string().min(1),
  minWeightKg: z.coerce.number().nonnegative(),
  maxWeightKg: z.coerce.number().positive(),
  price: z.coerce.number().nonnegative(),
});

const createSellRateCardSchema = z.object({
  audience: z.enum(["DEFAULT", "STAFF", "COLLABORATOR", "CLIENT"]).default("DEFAULT"),
  courierPartnerId: z.string().optional(),
  tenantId: z.string().optional(),
  customerId: z.string().optional(),
  name: z.string().min(1, "Rate card name is required"),
  effectiveFrom: z.string().min(1, "Effective-from date is required"),
  minMarginPercent: z.coerce.number().min(0).max(100).optional(),
  slabs: z.array(sellRateCardSlabSchema).min(1, "Add at least one slab"),
});

export async function createSellRateCardAction(formData: FormData) {
  const context = await requireTenantSession();
  if (context.session.user.role !== "ADMIN") throw new Error("Only administrators can manage pricing");

  let slabs: unknown;
  try {
    slabs = JSON.parse(String(formData.get("slabsJson") ?? "[]"));
  } catch {
    throw new Error("Invalid slab data");
  }

  const rawTenantId = String(formData.get("tenantId") ?? "").trim();
  const rawCustomerId = String(formData.get("customerId") ?? "").trim();
  const rawCourierPartnerId = String(formData.get("courierPartnerId") ?? "").trim();
  const rawMinMargin = String(formData.get("minMarginPercent") ?? "").trim();

  const parsed = createSellRateCardSchema.safeParse({
    audience: formData.get("audience") || "DEFAULT",
    courierPartnerId: rawCourierPartnerId || undefined,
    tenantId: rawTenantId || undefined,
    customerId: rawCustomerId || undefined,
    name: formData.get("name"),
    effectiveFrom: formData.get("effectiveFrom"),
    minMarginPercent: rawMinMargin || undefined,
    slabs,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  if (data.courierPartnerId) {
    const courier = await prisma.courierPartner.findUnique({ where: { id: data.courierPartnerId }, select: { id: true } });
    if (!courier) throw new Error("Selected courier was not found");
  }

  if (data.audience === "CLIENT") {
    if (data.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId }, select: { type: true } });
      if (!tenant || tenant.type !== "CLIENT" && tenant.type !== "INTERNAL") throw new Error("Invalid client tenant");
    }
    if (data.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: data.customerId }, select: { tenantId: true } });
      if (!customer || (data.tenantId && customer.tenantId !== data.tenantId)) throw new Error("Customer does not belong to the selected tenant");
    }
  }

  await prisma.$transaction(async (tx) => {
    // Same supersede pattern as createRateCardAction: a new active card
    // deactivates the prior active one for the same scope (same tenantId,
    // including the shared "null" default scope).
    if (data.audience === "CLIENT" && !data.tenantId && !data.customerId) {
      throw new Error("Select a client tenant or customer for client pricing");
    }
    if (data.audience !== "CLIENT" && (data.tenantId || data.customerId)) {
      throw new Error("Staff and collaborator cards cannot be assigned to a client");
    }
    await tx.sellRateCard.updateMany({
      where: {
        audience: data.audience,
        courierPartnerId: data.courierPartnerId ?? null,
        tenantId: data.tenantId ?? null,
        customerId: data.customerId ?? null,
        isActive: true,
      },
      data: { isActive: false },
    });

    await tx.sellRateCard.create({
      data: {
        audience: data.audience,
        courierPartnerId: data.courierPartnerId ?? null,
        tenantId: data.tenantId ?? null,
        customerId: data.customerId ?? null,
        name: data.name,
        isFinalized: false,
        effectiveFrom: new Date(data.effectiveFrom),
        minMarginPercent: data.minMarginPercent ?? null,
        isActive: true,
        slabs: {
          create: data.slabs.map((s) => ({
            zone: s.zone,
            minWeightKg: s.minWeightKg,
            maxWeightKg: s.maxWeightKg,
            price: s.price,
          })),
        },
      },
    });
  });

  revalidatePath("/pricing");
}

const updateSellRateCardSchema = createSellRateCardSchema.extend({
  cardId: z.string().min(1),
});

export async function updateSellRateCardAction(formData: FormData) {
  const context = await requireTenantSession();
  if (context.session.user.role !== "ADMIN") throw new Error("Only administrators can manage pricing");

  let slabs: unknown;
  try {
    slabs = JSON.parse(String(formData.get("slabsJson") ?? "[]"));
  } catch {
    throw new Error("Invalid slab data");
  }

  const parsed = updateSellRateCardSchema.safeParse({
    cardId: String(formData.get("cardId") ?? ""),
    audience: formData.get("audience") || "DEFAULT",
    courierPartnerId: String(formData.get("courierPartnerId") ?? "") || undefined,
    tenantId: String(formData.get("tenantId") ?? "") || undefined,
    customerId: String(formData.get("customerId") ?? "") || undefined,
    name: formData.get("name"),
    effectiveFrom: formData.get("effectiveFrom"),
    minMarginPercent: String(formData.get("minMarginPercent") ?? "") || undefined,
    slabs,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.sellRateCard.findUnique({ where: { id: data.cardId } });
    if (!existing) throw new Error("Rate card not found");
    if (existing.isFinalized) throw new Error("Finalized rate cards are locked. Create a new revision to change rates.");
    if (existing.audience !== data.audience || existing.courierPartnerId !== (data.courierPartnerId ?? null) || existing.tenantId !== (data.tenantId ?? null) || existing.customerId !== (data.customerId ?? null)) {
      throw new Error("Rate-card ownership and audience cannot be changed");
    }
    await tx.sellRateCard.update({
      where: { id: data.cardId, isFinalized: false },
      data: {
        name: data.name,
        effectiveFrom: new Date(data.effectiveFrom),
        minMarginPercent: data.minMarginPercent ?? null,
        slabs: {
          deleteMany: {},
          create: data.slabs.map((s) => ({ zone: s.zone, minWeightKg: s.minWeightKg, maxWeightKg: s.maxWeightKg, price: s.price })),
        },
      },
    });
  });
  revalidatePath("/pricing");
}

export async function finalizeSellRateCardAction(cardId: string) {
  const context = await requireTenantSession();
  if (context.session.user.role !== "ADMIN") throw new Error("Only administrators can finalize pricing");
  const card = await prisma.sellRateCard.findUnique({ where: { id: cardId }, include: { slabs: { where: { isActive: true } } } });
  if (!card) throw new Error("Rate card not found");
  if (card.isFinalized) return;
  if (card.slabs.length === 0) throw new Error("Add at least one rate slab before finalizing");
  if (card.slabs.some((s) => !s.zone.trim() || s.minWeightKg < 0 || s.maxWeightKg <= s.minWeightKg || s.price < 0)) throw new Error("Every rate slab must have valid zone, weight and price values");
  await prisma.sellRateCard.update({ where: { id: cardId, isFinalized: false }, data: { isFinalized: true, finalizedAt: new Date(), finalizedBy: context.session.user.email ?? context.session.user.id } });
  revalidatePath("/pricing");
  revalidatePath("/quotations");
  revalidatePath("/agreements");
}
