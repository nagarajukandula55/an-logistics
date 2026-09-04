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
