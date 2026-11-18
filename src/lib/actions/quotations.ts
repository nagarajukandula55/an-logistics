"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { renderQuotationHtml } from "@/lib/quotation-html";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
export async function createQuotationAction(formData: FormData) { await requireOnboardingAdmin(); const p = z.object({ applicationId:z.string().min(1), courierPartnerId:z.string().min(1), title:z.string().min(3), terms:z.string().min(10), validUntil:z.string().optional(), templateSource:z.enum(["AN_LOGISTICS", "COURIER"]).default("AN_LOGISTICS"), documentTemplateId:z.string().optional(), rateCardId:z.string().optional(), ratesJson:z.string() }).parse(Object.fromEntries(formData)); const rates = z.array(z.object({zone:z.string(),minWeightKg:z.number(),maxWeightKg:z.number(),price:z.number()}).refine(r => r.maxWeightKg > r.minWeightKg)).min(1).parse(JSON.parse(p.ratesJson)); const a=await prisma.partnerApplication.findUnique({where:{id:p.applicationId}}); const c=await prisma.courierPartner.findUnique({where:{id:p.courierPartnerId}}); if(!a||!c) throw new Error("Application or courier not found"); if (p.documentTemplateId && !await prisma.documentTemplate.findFirst({ where: { id: p.documentTemplateId, kind: "QUOTATION", isActive: true, OR: [{ courierPartnerId: c.id }, { courierPartnerId: null }] } })) throw new Error("Selected quotation format is not assigned to this courier"); if (p.rateCardId && !await prisma.sellRateCard.findFirst({ where: { id: p.rateCardId, courierPartnerId: c.id, audience: "DEFAULT", isActive: true, isFinalized: true } })) throw new Error("Selected rate card must be finalized before it can be used in a quotation"); const quoteNumber=`ANQ-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`; const quotation = await prisma.quotation.create({data:{quoteNumber,applicationId:a.id,courierPartnerId:c.id,status:"DRAFT",title:p.title,templateSource:p.templateSource,documentTemplateId:p.documentTemplateId || null,validUntil:p.validUntil?new Date(p.validUntil):null,termsSnapshot:p.terms,rateSnapshot:rates}}); revalidatePath("/quotations"); return quotation; }
export async function quotationHtmlAction(id:string) { await requireOnboardingAdmin(); const q=await prisma.quotation.findUniqueOrThrow({where:{id},include:{application:true,courierPartner:true,documentTemplate:true}}); return renderQuotationHtml({quoteNumber:q.quoteNumber,customerName:q.application?.company||q.application?.name||"Customer",courierName:q.courierPartner?.name||"Courier",templateSource:q.templateSource as "AN_LOGISTICS" | "COURIER",validUntil:q.validUntil,terms:q.termsSnapshot,rates:q.rateSnapshot as Array<{zone:string;minWeightKg:number;maxWeightKg:number;price:number}>,templateHtml:q.documentTemplate?.html}); }

export async function sendQuotationAction(id: string) {
  await requireOnboardingAdmin();
  const q = await prisma.quotation.findUnique({ where: { id }, include: { application: true, customer: true, courierPartner: true, documentTemplate: true } });
  if (!q) throw new Error("Quotation not found");
  if (q.status !== "DRAFT" && q.status !== "REVISION_REQUESTED") throw new Error("Only draft quotations can be sent");
  const recipient = q.application?.email ?? q.customer?.email;
  if (!recipient) throw new Error("The quotation customer has no email address");
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
  const sent = await sendEmail({ to: recipient, subject: `Quotation ${q.quoteNumber} - AN Logistics`, html });
  if (!sent) throw new Error("Email is not configured. Set RESEND_API_KEY and EMAIL_FROM before sending quotations.");
  await prisma.quotation.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  revalidatePath("/quotations");
}
