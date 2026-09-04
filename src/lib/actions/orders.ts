"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateTrackingCode } from "@/lib/tracking-code";
import { OrderStatus } from "@prisma/client";
import { optionalPincodeSchema } from "@/lib/validation";
import { requireTenantSession } from "@/lib/tenant";
import { notifyTenantOnStatusChange } from "@/lib/webhooks";

const createOrderSchema = z.object({
  tenantId: z.string().optional(),
  customerId: z.string().min(1, "Select or create a customer"),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  pickupContactName: z.string().min(1, "Pickup contact name is required"),
  pickupContactPhone: z.string().min(1, "Pickup contact phone is required"),
  pickupPincode: optionalPincodeSchema,
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  deliveryContactName: z.string().min(1, "Delivery contact name is required"),
  deliveryContactPhone: z.string().min(1, "Delivery contact phone is required"),
  deliveryPincode: optionalPincodeSchema,
  weightKg: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  packageDescription: z.string().optional(),
  codAmount: z.coerce.number().nonnegative().optional().or(z.literal("").transform(() => undefined)),
});

export type CreateOrderState = {
  ok: boolean;
  errors?: Record<string, string[]>;
  message?: string;
};

export async function createOrderAction(_prev: CreateOrderState, formData: FormData): Promise<CreateOrderState> {
  const { tenantId, isStaff } = await requireTenantSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createOrderSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  // Staff (INTERNAL-tenant) users pick which tenant a new order belongs to;
  // a CLIENT-tenant user's orders always go under their own tenant.
  const effectiveTenantId = isStaff && data.tenantId ? data.tenantId : tenantId;

  const order = await prisma.order.create({
    data: {
      trackingCode: generateTrackingCode(),
      tenantId: effectiveTenantId,
      customerId: data.customerId,
      pickupAddress: data.pickupAddress,
      pickupContactName: data.pickupContactName,
      pickupContactPhone: data.pickupContactPhone,
      pickupPincode: data.pickupPincode || null,
      deliveryAddress: data.deliveryAddress,
      deliveryContactName: data.deliveryContactName,
      deliveryContactPhone: data.deliveryContactPhone,
      deliveryPincode: data.deliveryPincode || null,
      weightKg: data.weightKg,
      packageDescription: data.packageDescription || null,
      codAmount: data.codAmount,
      status: OrderStatus.CREATED,
      statusEvents: {
        create: { status: OrderStatus.CREATED, note: "Order created" },
      },
    },
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  tenantId: z.string().optional(),
});

export async function createCustomerAction(formData: FormData) {
  const { tenantId, isStaff } = await requireTenantSession();

  const parsed = createCustomerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const effectiveTenantId = isStaff && parsed.data.tenantId ? parsed.data.tenantId : tenantId;

  const customer = await prisma.customer.create({
    data: {
      tenantId: effectiveTenantId,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
    },
  });

  revalidatePath("/orders/new");
  return customer;
}

const assignSchema = z.object({
  orderId: z.string().min(1),
  driverId: z.string().min(1, "Select a driver"),
  vehicleId: z.string().min(1, "Select a vehicle"),
});

export async function assignDriverVehicleAction(formData: FormData) {
  const { tenantId, isStaff } = await requireTenantSession();

  const parsed = assignSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { orderId, driverId, vehicleId } = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || (!isStaff && order.tenantId !== tenantId)) throw new Error("Order not found");
  if (order.driverId) throw new Error("Order is already assigned");

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        driverId,
        vehicleId,
        status: OrderStatus.ASSIGNED,
        statusEvents: {
          create: { status: OrderStatus.ASSIGNED, note: "Driver and vehicle assigned" },
        },
      },
    }),
    prisma.driver.update({ where: { id: driverId }, data: { status: "ON_TRIP", vehicleId } }),
    prisma.vehicle.update({ where: { id: vehicleId }, data: { status: "ON_TRIP" } }),
  ]);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/dispatch");
  revalidatePath("/drivers");
  revalidatePath("/vehicles");
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ASSIGNED: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  PICKED_UP: [OrderStatus.IN_TRANSIT],
  IN_TRANSIT: [OrderStatus.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  CREATED: [OrderStatus.CANCELLED],
};

const advanceSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(Object.values(OrderStatus) as [string, ...string[]]),
  note: z.string().optional(),
});

export async function advanceOrderStatusAction(formData: FormData) {
  const { tenantId, isStaff } = await requireTenantSession();

  const parsed = advanceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { orderId, note } = parsed.data;
  const status = parsed.data.status as OrderStatus;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || (!isStaff && order.tenantId !== tenantId)) throw new Error("Order not found");

  const allowed = NEXT_STATUS[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(`Cannot move order from ${order.status} to ${status}`);
  }

  const isTerminal = status === OrderStatus.DELIVERED || status === OrderStatus.FAILED || status === OrderStatus.CANCELLED;

  const [, event] = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        statusEvents: { create: { status, note: note || null } },
      },
      include: { statusEvents: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (isTerminal && order.driverId) {
      await tx.driver.update({ where: { id: order.driverId }, data: { status: "AVAILABLE" } });
    }
    if (isTerminal && order.vehicleId) {
      await tx.vehicle.update({ where: { id: order.vehicleId }, data: { status: "AVAILABLE" } });
    }
    return [updated, updated.statusEvents[0]] as const;
  });
  notifyTenantOnStatusChange(order, event).catch(() => {});

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/dispatch");
  revalidatePath("/drivers");
  revalidatePath("/vehicles");
}

const podSchema = z.object({
  orderId: z.string().min(1),
  signedByName: z.string().min(1, "Signee name is required"),
  notes: z.string().optional(),
});

export async function capturePodAction(formData: FormData) {
  const { tenantId, isStaff } = await requireTenantSession();

  const parsed = podSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { orderId, signedByName, notes } = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || (!isStaff && order.tenantId !== tenantId)) throw new Error("Order not found");

  const event = await prisma.$transaction(async (tx) => {
    await tx.proofOfDelivery.upsert({
      where: { orderId },
      create: { orderId, signedByName, notes: notes || null },
      update: { signedByName, notes: notes || null },
    });

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DELIVERED,
        statusEvents: { create: { status: OrderStatus.DELIVERED, note: `Delivered — signed by ${signedByName}` } },
      },
      include: { statusEvents: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (order.driverId) await tx.driver.update({ where: { id: order.driverId }, data: { status: "AVAILABLE" } });
    if (order.vehicleId) await tx.vehicle.update({ where: { id: order.vehicleId }, data: { status: "AVAILABLE" } });
    return updated.statusEvents[0];
  });
  notifyTenantOnStatusChange(order, event).catch(() => {});

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/dispatch");
  revalidatePath("/drivers");
  revalidatePath("/vehicles");
}

export const ORDER_NEXT_STATUS = NEXT_STATUS;
