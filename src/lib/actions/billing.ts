"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { InvoiceStatus, OrderStatus, SettlementStatus } from "@prisma/client";

export type ActionState = { ok: boolean; error?: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") throw new Error("Only admins can manage billing");
  return session;
}

function periodInvoiceNumber(prefix: string, existingCount: number) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(existingCount + 1).padStart(4, "0")}`;
}

// ---------- Invoices (us billing a CLIENT tenant) ----------

const generateInvoiceSchema = z.object({
  tenantId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

/**
 * Bills a tenant for platform usage over a period: one line item per
 * DELIVERED order in range with a non-null platformFeeAmount. Orders
 * already claimed by a prior invoice (via InvoiceLineItem.orderId) are
 * excluded so re-running generation for an overlapping period doesn't
 * double-bill.
 */
export async function generateInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = generateInvoiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { tenantId, periodStart, periodEnd } = parsed.data;

  const from = new Date(periodStart);
  const to = new Date(periodEnd);

  const alreadyInvoicedOrderIds = (
    await prisma.invoiceLineItem.findMany({ where: { orderId: { not: null } }, select: { orderId: true } })
  ).map((l) => l.orderId!);

  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      status: OrderStatus.DELIVERED,
      platformFeeAmount: { not: null },
      createdAt: { gte: from, lte: to },
      id: { notIn: alreadyInvoicedOrderIds },
    },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    return { ok: false, error: "No unbilled delivered orders with a platform fee in this period" };
  }

  const subtotal = orders.reduce((sum, o) => sum + (o.platformFeeAmount ?? 0), 0);
  const existingCount = await prisma.invoice.count({ where: { tenantId } });

  await prisma.invoice.create({
    data: {
      invoiceNumber: periodInvoiceNumber("INV", existingCount),
      tenantId,
      periodStart: from,
      periodEnd: to,
      status: InvoiceStatus.DRAFT,
      subtotal,
      totalAmount: subtotal,
      lineItems: {
        create: orders.map((o) => ({
          orderId: o.id,
          description: `Platform fee — order ${o.trackingCode}`,
          quantity: 1,
          unitPrice: o.platformFeeAmount!,
          amount: o.platformFeeAmount!,
        })),
      },
    },
  });

  revalidatePath("/billing/invoices");
  return { ok: true };
}

const invoiceStatusSchema = z.object({ invoiceId: z.string().min(1), status: z.nativeEnum(InvoiceStatus) });

export async function updateInvoiceStatusAction(formData: FormData) {
  await requireAdmin();
  const parsed = invoiceStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const { invoiceId, status } = parsed.data;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      issuedAt: status === InvoiceStatus.SENT ? new Date() : undefined,
      paidAt: status === InvoiceStatus.PAID ? new Date() : undefined,
    },
  });
  revalidatePath(`/billing/invoices/${invoiceId}`);
  revalidatePath("/billing/invoices");
}

// ---------- Settlements (us reconciling payouts with a CourierPartner) ----------

const generateSettlementSchema = z.object({
  courierPartnerId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

export async function generateSettlementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = generateSettlementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { courierPartnerId, periodStart, periodEnd } = parsed.data;

  const from = new Date(periodStart);
  const to = new Date(periodEnd);

  const alreadySettledOrderIds = (
    await prisma.settlementLineItem.findMany({ select: { orderId: true } })
  ).map((l) => l.orderId);

  const orders = await prisma.order.findMany({
    where: {
      courierPartnerId,
      status: OrderStatus.DELIVERED,
      createdAt: { gte: from, lte: to },
      id: { notIn: alreadySettledOrderIds },
    },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    return { ok: false, error: "No unsettled delivered orders for this partner in this period" };
  }

  const partner = await prisma.courierPartner.findUnique({ where: { id: courierPartnerId } });
  if (!partner) return { ok: false, error: "Courier partner not found" };

  // Gross payout is what the courier is owed (codAmount minus our platform
  // fee, or codAmount itself if no fee was computed); commission deducted
  // is the sum of platform fees already taken on these orders.
  let grossPayoutAmount = 0;
  let commissionDeducted = 0;
  const lineItems = orders.map((o) => {
    const fee = o.platformFeeAmount ?? 0;
    const payout = Math.max((o.codAmount ?? 0) - fee, 0);
    grossPayoutAmount += payout;
    commissionDeducted += fee;
    return { orderId: o.id, payoutAmount: payout, commissionAmount: fee };
  });

  const existingCount = await prisma.settlement.count({ where: { courierPartnerId } });

  await prisma.settlement.create({
    data: {
      settlementNumber: periodInvoiceNumber("SET", existingCount),
      courierPartnerId,
      tenantId: partner.tenantId,
      periodStart: from,
      periodEnd: to,
      status: SettlementStatus.DRAFT,
      grossPayoutAmount,
      commissionDeducted,
      netAmount: grossPayoutAmount,
      lineItems: { create: lineItems },
    },
  });

  revalidatePath("/billing/settlements");
  return { ok: true };
}

const settlementStatusSchema = z.object({ settlementId: z.string().min(1), status: z.nativeEnum(SettlementStatus) });

export async function updateSettlementStatusAction(formData: FormData) {
  await requireAdmin();
  const parsed = settlementStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const { settlementId, status } = parsed.data;
  await prisma.settlement.update({
    where: { id: settlementId },
    data: { status, paidAt: status === SettlementStatus.PAID ? new Date() : undefined },
  });
  revalidatePath(`/billing/settlements/${settlementId}`);
  revalidatePath("/billing/settlements");
}
