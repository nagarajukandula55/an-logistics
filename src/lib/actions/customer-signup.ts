"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMarketplaceTenantId } from "@/lib/marketplace-tenant";
import { UserRole } from "@prisma/client";

// Self-service signup for the customer portal (src/app/portal/**). Creates
// both a Customer (the shipper identity orders are attached to — already
// existed for staff-entered bookings) and a User with role=CUSTOMER linked
// to it via User.customerId, so the same schema that already supported
// "internal-only usage now" also supports "self-service customers later"
// (see the Customer model's doc comment in schema.prisma) without any new
// tables. New signups default to the MARKETPLACE tenant, same as anonymous
// /book bookings — a commercial (CLIENT) tenant's own customers are
// provisioned by staff via /users instead, so their orders roll up under
// that tenant's negotiated pricing/settlement rather than the public
// marketplace bucket.

const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().min(1, "Phone is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignupState = { ok: boolean; error?: string };

export async function signupCustomerAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists — try signing in instead." };
  }

  const tenantId = await getMarketplaceTenantId();
  const passwordHash = await bcrypt.hash(data.password, 10);

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: { tenantId, name: data.name, phone: data.phone, email: data.email },
    });
    await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: UserRole.CUSTOMER,
        tenantId,
        customerId: customer.id,
        // They just set their own password — no forced reset, unlike
        // adminResetPasswordAction's temp-password flow for staff.
        mustChangePassword: false,
      },
    });
  });

  return { ok: true };
}
