"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import type { Session } from "next-auth";

export type ActionState = { ok: boolean; error?: string; tempPassword?: string };

type AdminGuard = { ok: true; session: Session; tenantId: string; isStaff: boolean } | { ok: false; error: string };

async function requireAdmin(): Promise<AdminGuard> {
  const { session, tenantId, isStaff } = await requireTenantSession();
  if (session.user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can perform this action" };
  }
  return { ok: true, session, tenantId, isStaff };
}

function generateTempPassword(): string {
  // 12 random bytes -> readable base64url string, guaranteed to satisfy the
  // 8-char minimum used elsewhere in the app.
  return crypto.randomBytes(9).toString("base64url");
}

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["STAFF", "COLLABORATOR", "DISPATCHER", "DRIVER", "WAREHOUSE"]),
  tenantId: z.string().optional(),
});

export async function createManagedUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    tenantId: String(formData.get("tenantId") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { ok: false, error: "An account with this email already exists" };

  const targetTenantId = parsed.data.tenantId ?? guard.tenantId;
  if (!guard.isStaff && targetTenantId !== guard.tenantId) return { ok: false, error: "You can only create users in your tenant" };
  const targetTenant = await prisma.tenant.findUnique({ where: { id: targetTenantId }, select: { id: true } });
  if (!targetTenant) return { ok: false, error: "Selected tenant was not found" };

  const tempPassword = generateTempPassword();
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      tenantId: targetTenantId,
      passwordHash: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
    },
  });

  revalidatePath("/users");
  return { ok: true, tempPassword };
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function adminResetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { userId } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || (!guard.isStaff && target.tenantId !== guard.tenantId)) {
    return { ok: false, error: "User not found" };
  }

  const tempPassword = parsed.data.newPassword ?? generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });

  revalidatePath("/users");
  return { ok: true, tempPassword };
}

const toggleActiveSchema = z.object({ userId: z.string().min(1) });

export async function toggleUserActiveAction(userId: string): Promise<ActionState> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = toggleActiveSchema.safeParse({ userId });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  if (userId === guard.session.user.id) {
    return { ok: false, error: "You cannot deactivate your own account" };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, tenantId: true } });
  if (!target || (!guard.isStaff && target.tenantId !== guard.tenantId)) return { ok: false, error: "User not found" };

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !target.isActive },
  });

  revalidatePath("/users");
  return { ok: true };
}

const courierAssignmentSchema = z.object({
  userId: z.string().min(1),
  courierPartnerIds: z.array(z.string().min(1)).default([]),
});

export async function setUserCourierAssignmentsAction(userId: string, courierPartnerIds: string[]): Promise<ActionState> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = courierAssignmentSchema.safeParse({ userId, courierPartnerIds });
  if (!parsed.success) return { ok: false, error: "Invalid courier assignment" };

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { tenantId: true, role: true } });
  if (!target || (!guard.isStaff && target.tenantId !== guard.tenantId)) return { ok: false, error: "User not found" };
  if (target.role !== "STAFF" && target.role !== "COLLABORATOR") return { ok: false, error: "Only staff and collaborator accounts can be assigned couriers" };

  const couriers = await prisma.courierPartner.findMany({ where: { id: { in: parsed.data.courierPartnerIds } }, select: { id: true } });
  if (couriers.length !== parsed.data.courierPartnerIds.length) return { ok: false, error: "One or more couriers were not found" };

  await prisma.$transaction(async (tx) => {
    await tx.userCourierAssignment.deleteMany({ where: { userId: parsed.data.userId } });
    if (parsed.data.courierPartnerIds.length > 0) {
      await tx.userCourierAssignment.createMany({
        data: parsed.data.courierPartnerIds.map((courierPartnerId) => ({ userId: parsed.data.userId, courierPartnerId })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/users");
  revalidatePath("/pricing");
  return { ok: true };
}

export async function toggleCourierCostPermissionAction(userId: string): Promise<ActionState> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (userId === guard.session.user.id) return { ok: false, error: "Your administrator account already has this permission" };
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true, role: true, canManageCourierCosts: true } });
  if (!target || (!guard.isStaff && target.tenantId !== guard.tenantId)) return { ok: false, error: "User not found" };
  if (target.role === "CUSTOMER") return { ok: false, error: "Customer accounts cannot manage courier costs" };
  if (!target.canManageCourierCosts) {
    const existingAuthorized = await prisma.user.findFirst({
      where: {
        canManageCourierCosts: true,
        id: { not: guard.session.user.id },
        ...(guard.isStaff ? {} : { tenantId: guard.tenantId }),
      },
      select: { id: true, name: true },
    });
    if (existingAuthorized) {
      return { ok: false, error: `Cost-card access is already assigned to ${existingAuthorized.name}. Remove that access first.` };
    }
  }
  await prisma.user.update({ where: { id: userId }, data: { canManageCourierCosts: !target.canManageCourierCosts } });
  revalidatePath("/users");
  return { ok: true };
}
