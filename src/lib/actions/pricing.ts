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
  tenantId: z.string().optional(),
  name: z.string().min(1, "Rate card name is required"),
  effectiveFrom: z.string().min(1, "Effective-from date is required"),
  minMarginPercent: z.coerce.number().min(0).max(100).optional(),
  slabs: z.array(sellRateCardSlabSchema).min(1, "Add at least one slab"),
});

export async function createSellRateCardAction(formData: FormData) {
  await requireTenantSession();

  let slabs: unknown;
  try {
    slabs = JSON.parse(String(formData.get("slabsJson") ?? "[]"));
  } catch {
    throw new Error("Invalid slab data");
  }

  const rawTenantId = String(formData.get("tenantId") ?? "").trim();
  const rawMinMargin = String(formData.get("minMarginPercent") ?? "").trim();

  const parsed = createSellRateCardSchema.safeParse({
    tenantId: rawTenantId || undefined,
    name: formData.get("name"),
    effectiveFrom: formData.get("effectiveFrom"),
    minMarginPercent: rawMinMargin || undefined,
    slabs,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    // Same supersede pattern as createRateCardAction: a new active card
    // deactivates the prior active one for the same scope (same tenantId,
    // including the shared "null" default scope).
    await tx.sellRateCard.updateMany({
      where: { tenantId: data.tenantId ?? null, isActive: true },
      data: { isActive: false },
    });

    await tx.sellRateCard.create({
      data: {
        tenantId: data.tenantId ?? null,
        name: data.name,
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
