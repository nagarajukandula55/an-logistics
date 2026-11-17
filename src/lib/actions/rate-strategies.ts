"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  courierPartnerId: z.string().min(1),
  audience: z.enum(["DEFAULT", "STAFF", "COLLABORATOR", "CLIENT"]),
  name: z.string().min(2),
  volumeMinMonthly: z.coerce.number().nonnegative().optional(),
  volumeMaxMonthly: z.coerce.number().positive().optional(),
  markupPercent: z.coerce.number().min(0).max(500),
  minimumMarginPercent: z.coerce.number().min(0).max(99).optional(),
  handlingFee: z.coerce.number().min(0),
  roundingUnit: z.coerce.number().positive(),
  effectiveFrom: z.string().min(1),
  notes: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.volumeMaxMonthly !== undefined && value.volumeMinMonthly !== undefined && value.volumeMaxMonthly < value.volumeMinMonthly) {
    ctx.addIssue({ code: "custom", path: ["volumeMaxMonthly"], message: "Maximum volume must be greater than minimum volume" });
  }
});

export async function createRateStrategyAction(formData: FormData) {
  const { session } = await requireTenantSession();
  if (session.user.role !== "ADMIN") throw new Error("Only administrators can manage rate strategies");
  const parsed = schema.safeParse({
    courierPartnerId: formData.get("courierPartnerId"),
    audience: formData.get("audience") || "DEFAULT",
    name: formData.get("name"),
    volumeMinMonthly: formData.get("volumeMinMonthly") || undefined,
    volumeMaxMonthly: formData.get("volumeMaxMonthly") || undefined,
    markupPercent: formData.get("markupPercent"),
    minimumMarginPercent: formData.get("minimumMarginPercent") || undefined,
    handlingFee: formData.get("handlingFee"),
    roundingUnit: formData.get("roundingUnit"),
    effectiveFrom: formData.get("effectiveFrom"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid strategy");
  const data = parsed.data;
  await prisma.sellPricingStrategy.create({ data: {
    courierPartnerId: data.courierPartnerId,
    audience: data.audience,
    name: data.name,
    volumeMinMonthly: data.volumeMinMonthly ?? null,
    volumeMaxMonthly: data.volumeMaxMonthly ?? null,
    markupPercent: data.markupPercent,
    minimumMarginPercent: data.minimumMarginPercent ?? null,
    handlingFee: data.handlingFee,
    roundingUnit: data.roundingUnit,
    effectiveFrom: new Date(data.effectiveFrom),
    notes: data.notes ?? null,
  } });
  revalidatePath("/pricing");
  revalidatePath("/pricing/strategy");
}
