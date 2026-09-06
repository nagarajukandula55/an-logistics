"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { TenantStatus, TenantType } from "@prisma/client";

export type ActionState = { ok: boolean; error?: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") {
    throw new Error("Only admins can manage tenants");
  }
  return session;
}

const createTenantSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  name: z.string().min(1, "Name is required"),
  type: z.nativeEnum(TenantType),
  billingEmail: z.string().email().optional().or(z.literal("")),
});

export async function createTenantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = createTenantSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    await prisma.tenant.create({
      data: {
        slug: data.slug,
        name: data.name,
        type: data.type,
        status: TenantStatus.ONBOARDING,
        billingEmail: data.billingEmail || null,
      },
    });
  } catch {
    return { ok: false, error: "A tenant with that slug already exists" };
  }

  revalidatePath("/tenants");
  return { ok: true };
}

const updateTenantStatusSchema = z.object({
  tenantId: z.string().min(1),
  status: z.nativeEnum(TenantStatus),
});

export async function updateTenantStatusAction(formData: FormData) {
  await requireAdmin();

  const parsed = updateTenantStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await prisma.tenant.update({ where: { id: parsed.data.tenantId }, data: { status: parsed.data.status } });
  revalidatePath(`/tenants/${parsed.data.tenantId}`);
  revalidatePath("/tenants");
}

// TenantApiKey stores only a hash — the full key is shown once, at
// creation time, and never again. Prefix (unmasked) lets an admin
// recognize which key is which afterward without exposing the secret.
export type CreateApiKeyState = { ok: boolean; error?: string; plaintextKey?: string };

const createApiKeySchema = z.object({
  tenantId: z.string().min(1),
  label: z.string().min(1, "Label is required"),
});

export async function createTenantApiKeyAction(
  _prev: CreateApiKeyState,
  formData: FormData
): Promise<CreateApiKeyState> {
  await requireAdmin();

  const parsed = createApiKeySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { tenantId, label } = parsed.data;

  const secret = crypto.randomBytes(24).toString("base64url");
  const keyPrefix = secret.slice(0, 8);
  const plaintextKey = `anl_${secret}`;
  const keyHash = crypto.createHash("sha256").update(plaintextKey).digest("hex");

  await prisma.tenantApiKey.create({
    data: {
      tenantId,
      label,
      keyPrefix,
      keyHash,
      scopes: ["orders:create", "orders:read", "rates:read"],
    },
  });

  revalidatePath(`/tenants/${tenantId}`);
  return { ok: true, plaintextKey };
}

// Tenant.webhookUrl / Tenant.webhookSecret drive notifyTenantOnStatusChange
// (src/lib/webhooks.ts), which pushes order status changes to the tenant's
// receiver. The secret is generated here (never entered by hand) and shown
// once, the same generate-once-show-plaintext pattern as the API key above —
// the admin must copy it into the receiving system's env immediately.
export type SaveWebhookState = { ok: boolean; error?: string; plaintextSecret?: string };

const saveWebhookSchema = z.object({
  tenantId: z.string().min(1),
  webhookUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https:\/\/.+/i.test(v), "Webhook URL must be a valid https:// URL")
    .optional()
    .or(z.literal("")),
  regenerateSecret: z.string().optional(),
});

export async function saveTenantWebhookAction(
  _prev: SaveWebhookState,
  formData: FormData
): Promise<SaveWebhookState> {
  await requireAdmin();

  const parsed = saveWebhookSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { tenantId, webhookUrl, regenerateSecret } = parsed.data;

  let plaintextSecret: string | undefined;
  const data: { webhookUrl?: string | null; webhookSecret?: string } = {
    webhookUrl: webhookUrl ? webhookUrl : null,
  };

  if (regenerateSecret === "true") {
    plaintextSecret = crypto.randomBytes(32).toString("base64url");
    data.webhookSecret = plaintextSecret;
  }

  await prisma.tenant.update({ where: { id: tenantId }, data });

  revalidatePath(`/tenants/${tenantId}`);
  return { ok: true, plaintextSecret };
}

const revokeApiKeySchema = z.object({ apiKeyId: z.string().min(1), tenantId: z.string().min(1) });

export async function revokeTenantApiKeyAction(formData: FormData) {
  await requireAdmin();

  const parsed = revokeApiKeySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await prisma.tenantApiKey.update({
    where: { id: parsed.data.apiKeyId },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/tenants/${parsed.data.tenantId}`);
}
