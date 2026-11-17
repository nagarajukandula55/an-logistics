import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { renderQuotationHtml } from "@/lib/quotation-html";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireOnboardingAdmin();
  const { id } = await params;
  const q = await prisma.quotation.findUnique({ where: { id }, include: { application: true, customer: true, courierPartner: true, documentTemplate: true } });
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  const html = renderQuotationHtml({
    quoteNumber: q.quoteNumber,
    customerName: q.application?.company || q.application?.name || q.customer?.name || "Customer",
    courierName: q.courierPartner?.name || "Courier",
    templateSource: q.templateSource as "AN_LOGISTICS" | "COURIER",
    validUntil: q.validUntil,
    terms: q.termsSnapshot,
    rates: q.rateSnapshot as Array<{ zone: string; minWeightKg: number; maxWeightKg: number; price: number }>,
    templateHtml: q.documentTemplate?.html,
  });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
