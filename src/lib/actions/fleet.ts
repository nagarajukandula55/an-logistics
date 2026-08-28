"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const createVehicleSchema = z.object({
  registration: z.string().min(1, "Registration is required"),
  type: z.string().min(1, "Vehicle type is required"),
  capacityKg: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
});

export type ActionState = { ok: boolean; error?: string };

export async function createVehicleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

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

const createDriverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(1, "Phone is required"),
  licenseNo: z.string().min(1, "License number is required"),
});

export async function createDriverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
