"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import {
  CommissionType,
  CourierAgreementStatus,
  CourierIntegrationType,
  CourierPartnerStatus,
  OrderAssignmentMethod,
  OrderFulfillmentType,
  OrderStatus,
} from "@prisma/client";
import { getCourierProvider } from "@/lib/courier-providers/registry";
import { determineZone } from "@/lib/zone";
import { findServiceableBranches, computePlatformFee, getEffectiveCommission } from "@/lib/courier-queries";
import { pincodeSchema } from "@/lib/validation";
import { encryptApiKey } from "@/lib/crypto";

export type ActionState = { ok: boolean; error?: string };

// CourierPartner/branch/rate-card data is a shared routable-provider pool,
// not tenant-scoped (see Tenant model doc comment in schema.prisma) — any
// authenticated staff user can manage it. Only Order lookups within this
// file need tenant scoping.
async function requireSession() {
  const { session } = await requireTenantSession();
  return session;
}

// ---------- Courier partner ----------

const createCourierPartnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  legalName: z.string().optional(),
  contactName: z.string().min(1, "Contact name is required"),
  contactPhone: z.string().min(1, "Contact phone is required"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  integrationType: z.nativeEnum(CourierIntegrationType).default(CourierIntegrationType.MANUAL),
  commissionType: z.nativeEnum(CommissionType).default(CommissionType.PERCENT),
  commissionValue: z.coerce.number().nonnegative("Commission value must be 0 or more"),
  notes: z.string().optional(),
});

export async function createCourierPartnerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();

  const parsed = createCourierPartnerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const partner = await prisma.courierPartner.create({
    data: {
      name: data.name,
      legalName: data.legalName || null,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail || null,
      integrationType: data.integrationType,
      commissionType: data.commissionType,
      commissionValue: data.commissionValue,
      notes: data.notes || null,
    },
  });

  revalidatePath("/couriers");
  redirect(`/couriers/${partner.id}`);
}

const updateStatusSchema = z.object({
  courierPartnerId: z.string().min(1),
  status: z.nativeEnum(CourierPartnerStatus),
});

export async function updateCourierPartnerStatusAction(formData: FormData) {
  await requireSession();

  const parsed = updateStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { courierPartnerId, status } = parsed.data;

  await prisma.courierPartner.update({
    where: { id: courierPartnerId },
    data: { status },
  });

  revalidatePath(`/couriers/${courierPartnerId}`);
  revalidatePath("/couriers");
}

// ---------- Branch ----------

const createBranchSchema = z.object({
  courierPartnerId: z.string().min(1),
  name: z.string().min(1, "Branch name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  contactPhone: z.string().min(1, "Contact phone is required"),
});

export async function createCourierBranchAction(formData: FormData) {
  await requireSession();

  const parsed = createBranchSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { courierPartnerId, ...rest } = parsed.data;

  await prisma.courierBranch.create({
    data: { courierPartnerId, ...rest },
  });

  revalidatePath(`/couriers/${courierPartnerId}`);
}

const branchActiveSchema = z.object({
  branchId: z.string().min(1),
  courierPartnerId: z.string().min(1),
  // z.coerce.boolean() would coerce the string "false" to true (non-empty
  // string), so compare explicitly instead of coercing.
  isActive: z.string().transform((v) => v === "true"),
});

export async function setCourierBranchActiveAction(formData: FormData) {
  await requireSession();
  const parsed = branchActiveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { branchId, courierPartnerId, isActive } = parsed.data;

  await prisma.courierBranch.update({ where: { id: branchId }, data: { isActive } });
  revalidatePath(`/couriers/${courierPartnerId}`);
}

// ---------- Service area ----------

const createServiceAreaSchema = z.object({
  courierBranchId: z.string().min(1),
  courierPartnerId: z.string().min(1),
  pincode: pincodeSchema,
  city: z.string().optional(),
});

export async function createServiceAreaAction(formData: FormData) {
  await requireSession();

  const parsed = createServiceAreaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { courierBranchId, courierPartnerId, pincode, city } = parsed.data;

  await prisma.serviceArea.create({
    data: { courierBranchId, pincode, city: city || null },
  });

  revalidatePath(`/couriers/${courierPartnerId}`);
}

// ---------- Agreement ----------

const agreementSchema = z.object({
  courierPartnerId: z.string().min(1),
  effectiveFrom: z.string().min(1, "Effective-from date is required"),
  effectiveTo: z.string().optional(),
  commissionType: z.nativeEnum(CommissionType),
  commissionValue: z.coerce.number().nonnegative(),
  documentUrl: z.string().optional(),
  status: z.nativeEnum(CourierAgreementStatus).default(CourierAgreementStatus.DRAFT),
});

export async function createOrUpdateAgreementAction(formData: FormData) {
  await requireSession();

  const parsed = agreementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    // Only one agreement per partner should be ACTIVE at a time — creating
    // a new active agreement supersedes (expires) any prior active one.
    if (data.status === CourierAgreementStatus.ACTIVE) {
      await tx.courierAgreement.updateMany({
        where: { courierPartnerId: data.courierPartnerId, status: CourierAgreementStatus.ACTIVE },
        data: { status: CourierAgreementStatus.EXPIRED },
      });
    }

    await tx.courierAgreement.create({
      data: {
        courierPartnerId: data.courierPartnerId,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        commissionType: data.commissionType,
        commissionValue: data.commissionValue,
        documentUrl: data.documentUrl || null,
        status: data.status,
      },
    });
  });

  revalidatePath(`/couriers/${data.courierPartnerId}`);
}

// ---------- API config ----------

const apiConfigSchema = z.object({
  courierPartnerId: z.string().min(1),
  provider: z.string().min(1, "Provider name is required"),
  baseUrl: z.string().optional(),
  apiKeyEncrypted: z.string().optional(),
  clearApiKey: z.coerce.boolean().default(false),
  webhookUrl: z.string().optional(),
  isActive: z.coerce.boolean().default(false),
});

export async function createOrUpdateApiConfigAction(formData: FormData) {
  await requireSession();

  const parsed = apiConfigSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  // A blank key field means "leave the stored key untouched" — the form
  // never pre-fills the key input with the stored (encrypted) value, so a
  // non-empty submission always means the admin actually typed a new key.
  // The explicit "clear" checkbox is the only way to wipe a stored key.
  let newEncryptedKey: string | undefined;
  try {
    newEncryptedKey = data.apiKeyEncrypted ? encryptApiKey(data.apiKeyEncrypted) : undefined;
  } catch (err) {
    console.error("Failed to encrypt courier API key:", err);
    throw new Error("Could not save the API key — encryption is not configured correctly. Contact an administrator.");
  }
  const shouldClearKey = data.clearApiKey && !data.apiKeyEncrypted;

  await prisma.courierApiConfig.upsert({
    where: { courierPartnerId: data.courierPartnerId },
    create: {
      courierPartnerId: data.courierPartnerId,
      provider: data.provider,
      baseUrl: data.baseUrl || null,
      apiKeyEncrypted: newEncryptedKey ?? null,
      webhookUrl: data.webhookUrl || null,
      isActive: data.isActive,
    },
    update: {
      provider: data.provider,
      baseUrl: data.baseUrl || null,
      ...(shouldClearKey
        ? { apiKeyEncrypted: null }
        : newEncryptedKey !== undefined
          ? { apiKeyEncrypted: newEncryptedKey }
          : {}),
      webhookUrl: data.webhookUrl || null,
      isActive: data.isActive,
    },
  });

  revalidatePath(`/couriers/${data.courierPartnerId}`);
}

// ---------- Routing / dispatch ----------

/**
 * Finds courier branches that service a given pincode, restricted to
 * ACTIVE partners with ACTIVE (isActive) branches. Used to offer
 * courier-partner options alongside self-fleet dispatch on an order.
 */

const assignCourierSchema = z.object({
  orderId: z.string().min(1),
  courierBranchId: z.string().min(1, "Select a courier branch"),
});

/**
 * Assigns an order to a courier partner branch: sets fulfillmentType to
 * COURIER_PARTNER, links courierPartnerId/courierBranchId, moves status to
 * ASSIGNED, records assignmentMethod=MANUAL, writes an OrderStatusEvent,
 * and computes platformFeeAmount from the partner's commission settings
 * against codAmount (left null when there is no COD amount to compute against).
 */
export async function assignOrderToCourierAction(formData: FormData) {
  const session = await requireSession();

  const parsed = assignCourierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { orderId, courierBranchId } = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.tenantId !== session.user.tenantId) throw new Error("Order not found");
  if (order.driverId || order.courierPartnerId) throw new Error("Order is already assigned");

  const branch = await prisma.courierBranch.findUnique({
    where: { id: courierBranchId },
    include: { courierPartner: true },
  });
  if (!branch) throw new Error("Courier branch not found");
  if (!branch.isActive || branch.courierPartner.status !== CourierPartnerStatus.ACTIVE) {
    throw new Error("Courier branch is not currently active");
  }

  const partner = branch.courierPartner;

  // Confirm serviceability through the pluggable provider adapter rather
  // than querying ServiceArea directly, so MANUAL vs. future API partners
  // go through one code path.
  if (order.deliveryPincode) {
    const provider = getCourierProvider(partner);
    const serviceability = await provider.checkServiceability(partner, order.deliveryPincode);
    if (!serviceability.serviceable) {
      throw new Error("Courier branch does not service the delivery pincode");
    }
  }

  // Prefer the partner's currently-ACTIVE agreement's commission terms over
  // the partner's own defaults, per real onboarding/agreement lifecycle.
  const commission = await getEffectiveCommission(partner.id, partner);

  // Platform fee is computed against codAmount as a stand-in for real order
  // value — there is no separate declared-value field yet. If codAmount is
  // null we deliberately leave the fee null rather than fabricate a number;
  // real order-value modeling is a planned next-phase gap (see README).
  const platformFeeAmount = computePlatformFee(commission, order.codAmount);

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentType: OrderFulfillmentType.COURIER_PARTNER,
        courierPartnerId: partner.id,
        courierBranchId: branch.id,
        assignmentMethod: OrderAssignmentMethod.MANUAL,
        platformFeeAmount,
        status: OrderStatus.ASSIGNED,
        statusEvents: {
          create: {
            status: OrderStatus.ASSIGNED,
            note: `Routed to courier partner ${partner.name} (${branch.name})`,
          },
        },
      },
    }),
  ]);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/dispatch");
}

// ---------- Quote comparison ----------

export type CourierQuote = {
  partnerId: string;
  partnerName: string;
  branchId: string;
  branchName: string;
  zone: string;
  price: number | null;
  etaDays?: number;
  platformFee: number | null;
  netCourierPayout: number | null;
  noRateCard: boolean;
};

/**
 * Builds a live, sorted quote-comparison list for an order across every
 * ACTIVE courier partner with a branch that services the delivery pincode.
 * Partners with no usable quote (no active rate card / no matching slab /
 * API not yet implemented) are still shown, ranked last, with
 * noRateCard: true — they are a real "no quote available" state, not
 * omitted from the list.
 */
export async function getQuotesForOrder(orderId: string): Promise<CourierQuote[]> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  if (!order.deliveryPincode) return [];

  const branches = await findServiceableBranches(order.deliveryPincode);
  const weightKg = order.weightKg ?? 0;
  const zone = determineZone(order.pickupPincode ?? "", order.deliveryPincode);

  const quotes: CourierQuote[] = await Promise.all(
    branches.map(async (branch) => {
      const partner = branch.courierPartner;
      const provider = getCourierProvider(partner);

      let quote: { price: number; etaDays?: number } | null = null;
      try {
        quote = await provider.getQuote(partner, {
          pickupPincode: order.pickupPincode ?? "",
          deliveryPincode: order.deliveryPincode!,
          weightKg,
        });
      } catch {
        // API integration not yet implemented, or provider lookup failed —
        // treat as "no quote available" rather than failing the whole list.
        quote = null;
      }

      const commission = await getEffectiveCommission(partner.id, partner);
      const platformFee = quote ? computePlatformFee(commission, quote.price) : null;
      const netCourierPayout = quote && platformFee != null ? Math.round((quote.price - platformFee) * 100) / 100 : null;

      return {
        partnerId: partner.id,
        partnerName: partner.name,
        branchId: branch.id,
        branchName: branch.name,
        zone,
        price: quote?.price ?? null,
        etaDays: quote?.etaDays,
        platformFee,
        netCourierPayout,
        noRateCard: quote === null,
      };
    })
  );

  return quotes.sort((a, b) => {
    if (a.noRateCard !== b.noRateCard) return a.noRateCard ? 1 : -1;
    if (a.price == null || b.price == null) return 0;
    return a.price - b.price;
  });
}

// ---------- Rate cards ----------

const createRateCardSlabSchema = z.object({
  zone: z.string().min(1),
  minWeightKg: z.coerce.number().nonnegative(),
  maxWeightKg: z.coerce.number().positive(),
  price: z.coerce.number().nonnegative(),
});

const createRateCardSchema = z.object({
  courierPartnerId: z.string().min(1),
  name: z.string().min(1, "Rate card name is required"),
  effectiveFrom: z.string().min(1, "Effective-from date is required"),
  slabs: z.array(createRateCardSlabSchema).min(1, "Add at least one slab"),
});

/**
 * Creates a new rate card for a partner from a JSON-encoded payload
 * (slabs are a variable-length list, not flat form fields). Mirrors
 * createOrUpdateAgreementAction's supersede pattern: a new rate card
 * auto-deactivates the partner's prior active one.
 */
export async function createRateCardAction(formData: FormData) {
  await requireSession();

  let slabs: unknown;
  try {
    slabs = JSON.parse(String(formData.get("slabsJson") ?? "[]"));
  } catch {
    throw new Error("Invalid slab data");
  }

  const parsed = createRateCardSchema.safeParse({
    courierPartnerId: formData.get("courierPartnerId"),
    name: formData.get("name"),
    effectiveFrom: formData.get("effectiveFrom"),
    slabs,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.rateCard.updateMany({
      where: { courierPartnerId: data.courierPartnerId, isActive: true },
      data: { isActive: false },
    });

    await tx.rateCard.create({
      data: {
        courierPartnerId: data.courierPartnerId,
        name: data.name,
        effectiveFrom: new Date(data.effectiveFrom),
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

  revalidatePath(`/couriers/${data.courierPartnerId}`);
}
