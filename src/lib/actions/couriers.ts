"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  CommissionType,
  CourierAgreementStatus,
  CourierIntegrationType,
  CourierPartnerStatus,
  OrderAssignmentMethod,
  OrderFulfillmentType,
  OrderStatus,
} from "@prisma/client";

export type ActionState = { ok: boolean; error?: string };

async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
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
  pincode: z.string().min(1, "Pincode is required"),
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

  await prisma.courierApiConfig.upsert({
    where: { courierPartnerId: data.courierPartnerId },
    create: {
      courierPartnerId: data.courierPartnerId,
      provider: data.provider,
      baseUrl: data.baseUrl || null,
      apiKeyEncrypted: data.apiKeyEncrypted || null,
      webhookUrl: data.webhookUrl || null,
      isActive: data.isActive,
    },
    update: {
      provider: data.provider,
      baseUrl: data.baseUrl || null,
      apiKeyEncrypted: data.apiKeyEncrypted || null,
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
export async function findServiceableBranches(pincode: string) {
  if (!pincode) return [];

  return prisma.courierBranch.findMany({
    where: {
      isActive: true,
      courierPartner: { status: CourierPartnerStatus.ACTIVE },
      serviceAreas: { some: { pincode } },
    },
    include: { courierPartner: true },
    orderBy: { name: "asc" },
  });
}

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
  await requireSession();

  const parsed = assignCourierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { orderId, courierBranchId } = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
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

  // Prefer the partner's currently-ACTIVE agreement's commission terms over
  // the partner's own defaults, per real onboarding/agreement lifecycle.
  const activeAgreement = await prisma.courierAgreement.findFirst({
    where: { courierPartnerId: partner.id, status: CourierAgreementStatus.ACTIVE },
    orderBy: { effectiveFrom: "desc" },
  });
  const commissionType = activeAgreement?.commissionType ?? partner.commissionType;
  const commissionValue = activeAgreement?.commissionValue ?? partner.commissionValue;

  // Platform fee is computed against codAmount as a stand-in for real order
  // value — there is no separate declared-value/rate-card field yet. If
  // codAmount is null we deliberately leave the fee null rather than
  // fabricate a number; real order-value/rate-card modeling is a planned
  // next-phase gap (see README).
  let platformFeeAmount: number | null = null;
  if (order.codAmount != null) {
    platformFeeAmount =
      commissionType === CommissionType.PERCENT
        ? Math.round(order.codAmount * (commissionValue / 100) * 100) / 100
        : commissionValue;
  }

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
