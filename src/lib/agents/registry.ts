import { OrderStatus, ApplicationStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AgentName, AgentResult } from "./types";

const money = (value: number) => `₹${value.toFixed(2)}`;

export async function runAgent(agent: AgentName): Promise<AgentResult> {
  if (agent === "onboarding") {
    const applications = await prisma.partnerApplication.groupBy({ by: ["status"], _count: { _all: true } });
    const pending = applications.filter((row) => row.status !== ApplicationStatus.ACTIVE && row.status !== ApplicationStatus.REJECTED).reduce((sum, row) => sum + row._count._all, 0);
    return { agent, summary: `${pending} onboarding application${pending === 1 ? "" : "s"} need operator attention`, findings: pending ? [{ severity: "ACTION", message: "Review and progress pending client/reseller applications.", count: pending }] : [{ severity: "INFO", message: "Onboarding queue is clear." }], data: { byStatus: applications } };
  }
  if (agent === "pricing") {
    const customers = await prisma.customer.count({ where: { isActive: true } });
    const withoutCards = await prisma.customer.count({ where: { isActive: true, sellRateCards: { none: { isActive: true } } } });
    return { agent, summary: `${withoutCards} active account${withoutCards === 1 ? "" : "s"} have no active agreed rate card`, findings: withoutCards ? [{ severity: "ACTION", message: "Assign a signed rate card before allowing client/reseller bookings.", count: withoutCards }] : [{ severity: "INFO", message: "All active accounts have an agreed rate card." }], data: { activeCustomers: customers, withoutActiveRateCard: withoutCards } };
  }
  if (agent === "wallet") {
    const low = await prisma.wallet.count({ where: { balance: { lte: 0 }, customer: { isActive: true } } });
    return { agent, summary: `${low} active account wallet${low === 1 ? "" : "s"} cannot fund a booking`, findings: low ? [{ severity: "WARNING", message: "Notify accounts to top up before shipment booking.", count: low }] : [{ severity: "INFO", message: "Active account wallets have funds available." }], data: { lowBalanceWallets: low } };
  }
  if (agent === "shipment") {
    const orders = await prisma.order.groupBy({ by: ["bookingState"], where: { bookingState: "RECONCILIATION_REQUIRED" }, _count: { _all: true } });
    const count = orders.reduce((sum, row) => sum + row._count._all, 0);
    return { agent, summary: `${count} shipment${count === 1 ? "" : "s"} require courier reconciliation`, findings: count ? [{ severity: "ACTION", message: "Inspect provider status before retrying any booking.", count }] : [{ severity: "INFO", message: "No shipment reconciliation queue items." }] };
  }
  if (agent === "tracking") {
    const count = await prisma.order.count({ where: { fulfillmentType: "COURIER_PARTNER", providerRef: { not: null }, status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.FAILED] }, updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
    return { agent, summary: `${count} courier shipment${count === 1 ? "" : "s"} have not updated in 24 hours`, findings: count ? [{ severity: "WARNING", message: "Run tracking reconciliation and investigate provider delays.", count }] : [{ severity: "INFO", message: "Tracking updates are current." }] };
  }
  if (agent === "billing") {
    const invoices = await prisma.invoice.count({ where: { status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } } });
    return { agent, summary: `${invoices} invoice${invoices === 1 ? "" : "s"} need collection follow-up`, findings: invoices ? [{ severity: "ACTION", message: "Review outstanding invoices and payment reconciliation.", count: invoices }] : [{ severity: "INFO", message: "No outstanding invoices." }] };
  }
  const failed = await prisma.agentRun.count({ where: { status: "FAILED", startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  return { agent, summary: `${failed} agent run${failed === 1 ? "" : "s"} failed in the last 24 hours`, findings: failed ? [{ severity: "WARNING", message: "Review failed agent runs and integration logs.", count: failed }] : [{ severity: "INFO", message: "Agent integrations are healthy." }] };
}
