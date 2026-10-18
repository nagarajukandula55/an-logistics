"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/customer-session";
import { CustomerKind, UserRole } from "@prisma/client";

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

export type SignupState = { ok: boolean; error?: string };
export async function signupCustomerAction(_prev: SignupState, _formData: FormData): Promise<SignupState> {
  void _prev; void _formData;
  return { ok: false, error: "Please apply at /signup. Login access is issued after your agreement is signed and approved." };
}

// ---------- Business staff ----------
// Only the Customer owner (isBusinessOwner) can invite staff, and only a
// BUSINESS-kind Customer can have any — an INDIVIDUAL Customer has no staff
// seats at all. Capped at Customer.maxStaffUsers (default 2) beyond the
// owner themself; staff all book against the owner's own Customer/
// SellRateCard, never their own (see getSellPrice in lib/sell-pricing.ts).

const inviteStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
});

export async function inviteBusinessStaffAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const { customerId, tenantId, isBusinessOwner } = await requireCustomerSession();
  if (!isBusinessOwner) {
    return { ok: false, error: "Only the business owner can invite staff" };
  }

  const parsed = inviteStaffSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { ok: false, error: "Account not found" };
  if (customer.kind !== CustomerKind.BUSINESS) {
    return { ok: false, error: "Only business accounts can add staff" };
  }

  const existingStaffCount = await prisma.user.count({
    where: { customerId, isBusinessOwner: false },
  });
  if (existingStaffCount >= customer.maxStaffUsers) {
    return { ok: false, error: `Staff limit reached (${customer.maxStaffUsers}) — contact support to raise it` };
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists" };
  }

  // Temp password, forced reset on first login — same pattern as staff
  // accounts created from the internal admin side.
  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: UserRole.CUSTOMER,
      tenantId,
      customerId,
      isBusinessOwner: false,
      mustChangePassword: true,
    },
  });

  // TODO: email tempPassword to the invitee instead of returning it — no
  // outbound-email integration wired up yet. Surfaced in the UI for now so
  // the owner can relay it manually.
  return { ok: true, error: `Staff account created. Temporary password: ${tempPassword}` };
}

export async function setStaffActiveAction(formData: FormData): Promise<SignupState> {
  const { customerId, isBusinessOwner } = await requireCustomerSession();
  if (!isBusinessOwner) {
    return { ok: false, error: "Only the business owner can manage staff" };
  }

  const staffUserId = String(formData.get("userId") ?? "");
  const isActive = formData.get("isActive") === "true";

  const staff = await prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff || staff.customerId !== customerId || staff.isBusinessOwner) {
    return { ok: false, error: "Staff account not found" };
  }

  await prisma.user.update({ where: { id: staffUserId }, data: { isActive } });
  return { ok: true };
}
