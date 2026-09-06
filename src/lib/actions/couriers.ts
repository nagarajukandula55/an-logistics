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
  const { session, isStaff } = await requireTenantSession();
  return { session, isStaff };
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
  // Shiprocket authenticates with email+password, not a single API key —
  // when provider is SHIPROCKET these are combined into the encrypted
  // JSON blob stored in apiKeyEncrypted instead (see shiprocket-provider.ts).
  shiprocketEmail: z.string().optional(),
  shiprocketPassword: z.string().optional(),
  clearApiKey: z.coerce.boolean().default(false),
  webhookUrl: z.string().optional(),
  isActive: z.coerce.boolean().default(false),
});

// Returns { error } instead of throwing for any expected/validation-type
// failure. Next.js redacts the message of anything *thrown* from a Server
// Action once the app is built for production — the client only ever sees
// a generic "Minified React error #441" digest, no matter how friendly the
// original throw new Error(...) text was (dev mode shows the real message,
// which is why this class of bug is easy to miss locally). Returning a
// plain serializable result instead means the real message reaches the
// admin in both dev and prod. Genuinely unexpected failures (e.g. the
// prisma call itself failing) still propagate as a thrown error — those
// are Next.js/ops/database problems, not something the form should try to
// explain to the user anyway.
export async function createOrUpdateApiConfigAction(
  formData: FormData
): Promise<{ error: string } | { error?: undefined }> {
  await requireSession();

  const parsed = apiConfigSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  // A blank key field means "leave the stored key untouched" — the form
  // never pre-fills the key input with the stored (encrypted) value, so a
  // non-empty submission always means the admin actually typed a new key.
  // The explicit "clear" checkbox is the only way to wipe a stored key.
  const isShiprocket = data.provider.toUpperCase() === "SHIPROCKET";
  const rawSecret =
    isShiprocket && data.shiprocketEmail && data.shiprocketPassword
      ? JSON.stringify({ email: data.shiprocketEmail, password: data.shiprocketPassword })
      : data.apiKeyEncrypted;

  let newEncryptedKey: string | undefined;
  try {
    newEncryptedKey = rawSecret ? encryptApiKey(rawSecret) : undefined;
  } catch (err) {
    console.error("Failed to encrypt courier API key:", err);
    return { error: "Could not save the API key — encryption is not configured correctly. Contact an administrator." };
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
  return {};
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
  // Which specific option within the provider was picked (e.g. one of
  // Shiprocket's bundled couriers) — optional since MANUAL partners only
  // ever have one option and don't need to disambiguate.
  providerCourierId: z.string().optional(),
});

/**
 * Assigns an order to a courier partner branch: sets fulfillmentType to
 * COURIER_PARTNER, links courierPartnerId/courierBranchId, moves status to
 * ASSIGNED, records assignmentMethod=MANUAL, writes an OrderStatusEvent,
 * and computes platformFeeAmount from the partner's commission settings
 * against codAmount (left null when there is no COD amount to compute against).
 */
export async function assignOrderToCourierAction(formData: FormData) {
  const { session, isStaff } = await requireSession();

  const parsed = assignCourierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { orderId, courierBranchId, providerCourierId } = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || (!isStaff && order.tenantId !== session.user.tenantId)) throw new Error("Order not found");
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
    const provider = await getCourierProvider(partner);
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
        selectedProviderCourierId: providerCourierId || null,
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

export type CourierQuoteOption = {
  price: number;
  etaDays?: number;
  providerCourierId?: string;
  label?: string;
  platformFee: number | null;
  netCourierPayout: number | null;
};

// One entry per connected provider (Shiprocket, a directly-onboarded DTDC,
// Bluedart, ...) servicing the delivery pincode — each with every bookable
// option that provider offers, so the dispatch UI can show a tab per
// provider and let staff compare options within it, rather than flattening
// everything (and Shiprocket's own bundled couriers) into one undifferentiated list.
export type ProviderQuoteGroup = {
  partnerId: string;
  partnerName: string;
  branchId: string;
  branchName: string;
  zone: string;
  options: CourierQuoteOption[];
};

/**
 * Builds a live quote comparison for an order, grouped by connected
 * provider (one group per ACTIVE courier partner with a branch servicing
 * the delivery pincode). A provider with no usable quote (no active rate
 * card / no matching slab / API error) is still returned, with an empty
 * options list, so its tab exists and explains itself rather than
 * silently vanishing.
 */
export async function getProviderQuotesForOrder(orderId: string): Promise<ProviderQuoteGroup[]> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  if (!order.deliveryPincode) return [];

  const branches = await findServiceableBranches(order.deliveryPincode);
  const weightKg = order.weightKg ?? 0;
  const zone = determineZone(order.pickupPincode ?? "", order.deliveryPincode);

  return Promise.all(
    branches.map(async (branch) => {
      const partner = branch.courierPartner;
      const provider = await getCourierProvider(partner);
      const commission = await getEffectiveCommission(partner.id, partner);

      let rawOptions: { price: number; etaDays?: number; providerCourierId?: string; label?: string }[] = [];
      try {
        rawOptions = provider.getQuotes
          ? await provider.getQuotes(partner, {
              pickupPincode: order.pickupPincode ?? "",
              deliveryPincode: order.deliveryPincode!,
              weightKg,
            })
          : [];
        if (!provider.getQuotes) {
          const quote = await provider.getQuote(partner, {
            pickupPincode: order.pickupPincode ?? "",
            deliveryPincode: order.deliveryPincode!,
            weightKg,
          });
          if (quote) rawOptions = [quote];
        }
      } catch {
        // API integration not yet implemented, or provider lookup failed —
        // this provider's tab just shows no options, rather than failing
        // the whole comparison.
        rawOptions = [];
      }

      const options: CourierQuoteOption[] = rawOptions.map((o) => {
        const platformFee = computePlatformFee(commission, o.price);
        return {
          ...o,
          platformFee,
          netCourierPayout: platformFee != null ? Math.round((o.price - platformFee) * 100) / 100 : null,
        };
      });

      return {
        partnerId: partner.id,
        partnerName: partner.name,
        branchId: branch.id,
        branchName: branch.name,
        zone,
        options,
      };
    })
  );
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
