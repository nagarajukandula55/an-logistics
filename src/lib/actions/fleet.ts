"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { DriverStatus, VehicleStatus } from "@prisma/client";

const FLEET_MANAGER_ROLES = ["ADMIN", "DISPATCHER"];

// Fleet data (drivers/vehicles) is operational, not something every
// authenticated role (e.g. DRIVER, CUSTOMER) should be able to edit or
// deactivate — only admins/dispatchers manage it.
async function requireFleetManager() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!FLEET_MANAGER_ROLES.includes(session.user.role)) {
    return { ok: false as const, error: "You don't have permission to do that." };
  }
  return { ok: true as const };
}

const createVehicleSchema = z.object({
  registration: z.string().min(1, "Registration is required"),
  type: z.string().min(1, "Vehicle type is required"),
  capacityKg: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
});

export type ActionState = { ok: boolean; error?: string };

export async function createVehicleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireFleetManager();
  if (!guard.ok) return guard;

  const parsed = createVehicleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.vehicle.create({
      data: {
        registration: parsed.data.registration.toUpperCase(),
        type: parsed.data.type,
        capacityKg: parsed.data.capacityKg,
      },
    });
  } catch {
    return { ok: false, error: "A vehicle with that registration already exists" };
  }

  revalidatePath("/vehicles");
  return { ok: true };
}

const updateVehicleSchema = z.object({
  vehicleId: z.string().min(1),
  type: z.string().min(1, "Vehicle type is required"),
  capacityKg: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  status: z.nativeEnum(VehicleStatus),
});

export async function updateVehicleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireFleetManager();
  if (!guard.ok) return guard;

  const parsed = updateVehicleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { vehicleId, type, capacityKg, status } = parsed.data;

  try {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { type, capacityKg: capacityKg ?? null, status },
    });
  } catch {
    return { ok: false, error: "Could not update vehicle" };
  }

  revalidatePath("/vehicles");
  return { ok: true };
}

export async function deactivateVehicleAction(vehicleId: string): Promise<ActionState> {
  const guard = await requireFleetManager();
  if (!guard.ok) return guard;

  try {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: VehicleStatus.INACTIVE },
    });
  } catch {
    return { ok: false, error: "Could not deactivate vehicle" };
  }

  revalidatePath("/vehicles");
  return { ok: true };
}

const createDriverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(1, "Phone is required"),
  licenseNo: z.string().min(1, "License number is required"),
});

export async function createDriverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireFleetManager();
  if (!guard.ok) return guard;

  const parsed = createDriverSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password, phone, licenseNo } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with that email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "DRIVER",
        driverProfile: {
          create: { phone, licenseNo },
        },
      },
    });
  } catch {
    return { ok: false, error: "Could not create driver. Check the license number is unique." };
  }

  revalidatePath("/drivers");
  return { ok: true };
}

const updateDriverSchema = z.object({
  driverId: z.string().min(1),
  phone: z.string().min(1, "Phone is required"),
  licenseNo: z.string().min(1, "License number is required"),
  status: z.nativeEnum(DriverStatus),
});

export async function updateDriverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireFleetManager();
  if (!guard.ok) return guard;

  const parsed = updateDriverSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { driverId, phone, licenseNo, status } = parsed.data;

  const driver = await prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } });
  if (!driver) return { ok: false, error: "Driver not found" };
  if (!driver.user.isActive && status !== DriverStatus.OFF_DUTY) {
    return { ok: false, error: "Reactivate this driver before changing their dispatch status." };
  }

  try {
    await prisma.driver.update({
      where: { id: driverId },
      data: { phone, licenseNo, status },
    });
  } catch {
    return { ok: false, error: "Could not update driver. Check the license number is unique." };
  }

  revalidatePath("/drivers");
  return { ok: true };
}

// Deactivating a driver disables their login (User.isActive = false) and
// frees them from dispatch (Driver.status = OFF_DUTY), rather than adding a
// redundant Driver-level active flag — User.isActive already models this.
export async function deactivateDriverAction(driverId: string): Promise<ActionState> {
  const guard = await requireFleetManager();
  if (!guard.ok) return guard;

  try {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return { ok: false, error: "Driver not found" };

    await prisma.$transaction([
      prisma.user.update({ where: { id: driver.userId }, data: { isActive: false } }),
      prisma.driver.update({ where: { id: driverId }, data: { status: DriverStatus.OFF_DUTY } }),
    ]);
  } catch {
    return { ok: false, error: "Could not deactivate driver" };
  }

  revalidatePath("/drivers");
  return { ok: true };
}

export async function reactivateDriverAction(driverId: string): Promise<ActionState> {
  const guard = await requireFleetManager();
  if (!guard.ok) return guard;

  try {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return { ok: false, error: "Driver not found" };

    await prisma.user.update({ where: { id: driver.userId }, data: { isActive: true } });
  } catch {
    return { ok: false, error: "Could not reactivate driver" };
  }

  revalidatePath("/drivers");
  return { ok: true };
}
