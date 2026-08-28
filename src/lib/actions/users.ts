"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export type ActionState = { ok: boolean; error?: string; tempPassword?: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") {
    throw new Error("Only admins can perform this action");
  }
  return session;
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
  await requireAdmin();

  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { userId } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
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
  const session = await requireAdmin();

  const parsed = toggleActiveSchema.safeParse({ userId });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.id === session.user.id) {
    return { ok: false, error: "You cannot deactivate your own account" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !target.isActive },
  });

  revalidatePath("/users");
  return { ok: true };
}
