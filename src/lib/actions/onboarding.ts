"use server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { getMarketplaceTenantId } from "@/lib/marketplace-tenant";
import { notifyOpsTelegram } from "@/lib/telegram";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getIndicativeRates } from "@/lib/indicative-pricing";
import { sendEmail } from "@/lib/email";
import type { IndicativeRate } from "@/lib/indicative-pricing";
import { INDIA_STATES_AND_UTS } from "@/lib/india-states";
import { SERVICE_OPTIONS } from "@/lib/signup-options";
export type OnboardingState = {
    ok: boolean;
    error?: string;
    message?: string;
    quotationSent?: boolean;
    applicationNumber?: string;
    formValues?: Record<string, string | string[]>;
    ratePreview?: { source: string; rates: IndicativeRate[] };
    applicant?: { name: string; email: string; businessModel: string; baseCity: string; basePincode: string; pickupCity: string; pickupPincode: string; monthlyVolume: number };
};
const applicationSchema = z.object({
    name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
    phone: z.string().trim().regex(/^(?:\+91[ -]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
    company: z.string().trim().max(200).optional(), accountType: z.enum(["individual", "business", "reseller"]),
    businessModel: z.string().refine((value) => value.split(",").every((item) => ["ECOM_B2B", "ECOM_B2C", "MLB_B2B", "MLB_B2C", "BIZ_B2B", "BIZ_B2C", "B2B", "B2C", "ECOM", "MIXED", "OTHER"].includes(item)), "Choose valid rate categories").refine((value) => value.length > 0, "Choose at least one rate category"),
    address: z.string().trim().min(10).max(1000), pincode: z.string().regex(/^[1-9]\d{5}$/),
    baseCity: z.string().trim().min(2).max(100), basePincode: z.string().regex(/^[1-9]\d{5}$/), pickupCity: z.string().trim().min(2).max(100),
    gstin: z.string().trim().toUpperCase().regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN or leave blank").optional(),
    billingName: z.string().trim().min(2).max(200), billingEmail: z.string().trim().email().max(254), billingAddress: z.string().trim().min(10).max(1000), billingState: z.string().trim().min(2).max(100),
    billingCycle: z.enum(["PER_SHIPMENT", "FORTNIGHTLY", "MONTHLY"]), paymentTermsDays: z.coerce.number().int().refine(v => [0, 7, 15, 30].includes(v), "Choose valid payment terms"),
    monthlyVolume: z.coerce.number().int().min(0).max(10000000), shipmentType: z.string().trim().max(80).optional(), servicePreference: z.string().trim().min(1, "Choose at least one service").max(500).refine((value) => value.split(", ").every((item) => (SERVICE_OPTIONS as readonly string[]).includes(item)), "Choose services from the list"), pickupFrequency: z.string().trim().max(80).optional(), operationArea: z.enum(["PAN_INDIA", "SELECTED_STATES", "BASE_CITY"]), operatingStates: z.string().trim().max(1000).optional().refine((value) => !value || value.split(", ").every((state) => (INDIA_STATES_AND_UTS as readonly string[]).includes(state)), "Choose states from the list"), requirements: z.string().max(2000).optional(),
    consent: z.literal("on", { error: "Please accept the privacy notice and contact consent" }), website: z.string().max(0).optional(),
});
export async function applyPartnerAction(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
    const selectedStates = fd.getAll("operatingStates").map(String).filter(Boolean).join(", ");
    const selectedServices = fd.getAll("servicePreference").map(String).filter(Boolean).join(", ");
    const formValues: Record<string, string | string[]> = {};
    for (const key of new Set([...fd.keys()])) {
        const values = fd.getAll(key).map(String);
        formValues[key] = values.length > 1 ? values : (values[0] ?? "");
    }
    const result = applicationSchema.safeParse({ ...Object.fromEntries(fd), businessModel: fd.getAll("businessModel").map(String).join(","), servicePreference: selectedServices, operatingStates: selectedStates });
    if (!result.success)
        return { ok: false, error: result.error.issues[0].message, formValues };
    const { consent, website, shipmentType, servicePreference, pickupFrequency, operationArea, operatingStates, ...data } = result.data;
    const inferredBaseCity = data.baseCity.trim().toLowerCase() === "vizianagaram" || data.basePincode.startsWith("535");
    const effectiveOperationArea = inferredBaseCity ? "BASE_CITY" : operationArea;
    if (!inferredBaseCity && data.businessModel.split(",").some((category) => category.startsWith("BIZ_"))) return { ok: false, error: "Branch rates are available only when the operation location matches the local branch area.", formValues };
    if (effectiveOperationArea === "SELECTED_STATES" && !operatingStates) return { ok: false, error: "Select at least one operating state", formValues };
    const requirements = [shipmentType && `Shipment type: ${shipmentType}`, servicePreference && `Service needs: ${servicePreference}`, pickupFrequency && `Pickup frequency: ${pickupFrequency}`, `Operation area: ${effectiveOperationArea === "BASE_CITY" ? "Local branch coverage and nearby areas" : effectiveOperationArea}`, operatingStates && `Operating states: ${operatingStates}`, data.requirements].filter(Boolean).join("\n").slice(0, 2000);
    data.requirements = requirements;
    const applicationNumber = `AN-APP-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    void consent;
    void website;
    const escape = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    try {
        await prisma.partnerApplication.create({ data: { ...data, applicationNumber, consentAt: new Date() } });
    }
    catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
            return { ok: false, error: "An application with this email already exists. Please contact AN Logistics for its status.", formValues };
        throw e;
    }
    try {
        await notifyOpsTelegram("PARTNER_APPLICATION", `New application: <b>${escape(data.name)}</b>\n${escape(data.company || data.accountType)}\n${escape(data.email)} · ${escape(data.phone)}\nReview in Admin → Onboarding.`);
    }
    catch {
        console.error("Application saved; Telegram notification failed.");
    }
    let ratePreview: Awaited<ReturnType<typeof getIndicativeRates>> | undefined;
    let quotationSent = false;
    try {
        ratePreview = await getIndicativeRates({ businessModel: data.businessModel, baseCity: data.baseCity, basePincode: data.basePincode, pickupCity: data.pickupCity, pickupPincode: data.pincode, monthlyVolume: data.monthlyVolume });
        const grouped = new Map<string, typeof ratePreview.rates>();
        for (const rate of ratePreview.rates) grouped.set(rate.categoryLabel, [...(grouped.get(rate.categoryLabel) ?? []), rate]);
        const rows = [...grouped.entries()].map(([category, rates]) => { const tableRows = rates.slice(0, 80).map((rate) => `<tr><td>${escape(rate.courierName)}</td><td>${escape(rate.serviceCode)}</td><td>${escape(rate.lane)}</td><td>${rate.minWeightKg}-${rate.maxWeightKg} kg</td><td>Rs. ${rate.defaultSellRate.toFixed(2)}</td></tr>`).join(""); return `<h3>${escape(category)}</h3><table border="1" cellpadding="6" cellspacing="0"><tr><th>Courier</th><th>Service</th><th>Lane</th><th>Weight</th><th>Indicative seller rate</th></tr>${tableRows}</table>`; }).join("");
        quotationSent = await sendEmail({ to: data.email, subject: `AN Logistics application ${applicationNumber} – indicative quotation`, html: `<h2>Application ${escape(applicationNumber)}</h2><h3>Applied indicative quotation for ${escape(data.company || data.name)}</h3><p>Selected categories: <strong>${escape(ratePreview.source)}</strong></p><p>These are discussion rates only and are not final. Please discuss and confirm the applicable services, rates, coverage, taxes, and additional charges with AN Logistics before the agreement is prepared.</p>${rows || "<p>Our team will prepare the detailed schedule and contact you.</p>"}` });
        const application = await prisma.partnerApplication.findUnique({ where: { email: data.email } });
        if (application && ratePreview) {
            const courier = await prisma.courierPartner.findFirst({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
            const quotation = await prisma.quotation.create({ data: { quoteNumber: `ANQ-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`, applicationId: application.id, courierPartnerId: courier?.id ?? null, status: quotationSent ? "SENT" : "DRAFT", title: `Applied indicative rates - ${ratePreview.source}`, termsSnapshot: "Indicative rates only. Final rates, serviceability, taxes, surcharges, and commercial terms require discussion and confirmation before agreement.", rateSnapshot: ratePreview.rates.map((rate) => ({ zone: rate.lane, minWeightKg: rate.minWeightKg, maxWeightKg: rate.maxWeightKg, price: rate.defaultSellRate, courierName: rate.courierName, serviceCode: rate.serviceCode })), sentAt: quotationSent ? new Date() : null } });
            void quotation;
            if (quotationSent) await prisma.partnerApplication.update({ where: { id: application.id }, data: { status: "QUOTATION" } });
        }
    } catch {
        console.error("Application saved; indicative quotation email failed.");
    }
    return { ok: true, applicationNumber, message: quotationSent ? "Application received. Your applied indicative quotation has been emailed. Please discuss and confirm the rates with AN Logistics before final agreement." : "Application received. We could not send the quotation email yet; our team will contact you to discuss and confirm the rates before final agreement.", quotationSent, ratePreview, applicant: { name: data.name, email: data.email, businessModel: data.businessModel, baseCity: data.baseCity, basePincode: data.basePincode, pickupCity: data.pickupCity, pickupPincode: data.pincode, monthlyVolume: data.monthlyVolume } };
}
export async function reviewApplicationAction(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
    await requireOnboardingAdmin();
    const parsed = z.object({ id: z.string(), status: z.enum(["CONTACTED", "QUOTATION", "NEGOTIATING", "AGREEMENT", "REJECTED"]), notes: z.string().max(10000) }).safeParse(Object.fromEntries(fd));
    if (!parsed.success)
        return { ok: false, error: "Invalid review details" };
    if (parsed.data.status === "AGREEMENT" && fd.get("ratesConfirmed") !== "on") return { ok: false, error: "Confirm that the applied rates were discussed and agreed before moving this application to agreement." };
    const tenantId = await getMarketplaceTenantId();
    await prisma.$transaction(async (tx) => {
        const a = await tx.partnerApplication.findUnique({ where: { id: parsed.data.id } });
        if (!a || a.status === "ACTIVE")
            throw new Error("Application is unavailable or already active");
        const customerId = a.customerId ?? (await tx.customer.create({ data: { name: a.company || a.name, email: a.email, phone: a.phone, address: a.address, billingName: a.billingName || a.company || a.name, billingEmail: a.billingEmail || a.email, billingAddress: a.billingAddress || a.address, billingState: a.billingState, gstin: a.gstin, billingCycle: a.billingCycle, paymentTermsDays: a.paymentTermsDays, businessModel: a.businessModel, baseCity: a.baseCity, basePincode: a.basePincode, kind: a.accountType === "individual" ? "INDIVIDUAL" : "BUSINESS", accountType: a.accountType === "reseller" ? "RESELLER" : "CLIENT", tenantId, isActive: false } })).id;
        await tx.customer.update({ where: { id: customerId }, data: { businessModel: a.businessModel, baseCity: a.baseCity, basePincode: a.basePincode, billingName: a.billingName || a.company || a.name, billingEmail: a.billingEmail || a.email, billingAddress: a.billingAddress || a.address, billingState: a.billingState, gstin: a.gstin, billingCycle: a.billingCycle, paymentTermsDays: a.paymentTermsDays } });
        const confirmedNotes = parsed.data.status === "AGREEMENT" ? `${parsed.data.notes}\n[RATES_CONFIRMED] Applied rates discussed and confirmed by AN Logistics on ${new Date().toISOString()}.` : parsed.data.notes;
        await tx.partnerApplication.update({ where: { id: a.id }, data: { customerId, status: parsed.data.status, notes: confirmedNotes } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/onboarding");
    return { ok: true, message: "Review saved. Customer record is ready for an agreement." };
}
export async function createTemplateAction(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
    await requireOnboardingAdmin();
    const p = z.object({ name: z.string().trim().min(3).max(100), category: z.string().min(1).max(80), version: z.string().min(1).max(40), terms: z.string().min(100).max(50000) }).safeParse(Object.fromEntries(fd));
    if (!p.success)
        return { ok: false, error: p.error.issues[0].message };
    try {
        await prisma.agreementTemplate.create({ data: p.data });
    }
    catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
            return { ok: false, error: "Use a new version number for this template." };
        throw e;
    }
    revalidatePath("/onboarding");
    return { ok: true, message: "Template version saved." };
}
export async function prepareAgreementAction(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
    await requireOnboardingAdmin();
    const p = z.object({ applicationId: z.string(), templateId: z.string(), title: z.string().min(3).max(200), terms: z.string().min(100).max(50000), slabsJson: z.string(), legalReviewed: z.literal("on"), effectiveFrom: z.iso.date() }).safeParse(Object.fromEntries(fd));
    if (!p.success)
        return { ok: false, error: "Complete the terms, effective date, rate card and legal-review confirmation." };
    const a = await prisma.partnerApplication.findUnique({ where: { id: p.data.applicationId }, include: { customer: true } });
    const template = await prisma.agreementTemplate.findUnique({ where: { id: p.data.templateId } });
    if (!a?.customer || !template || a.status === "REJECTED")
        return { ok: false, error: "Review the application and choose a saved template first." };
    if (a.status !== "AGREEMENT" || !a.notes.includes("[RATES_CONFIRMED]")) return { ok: false, error: "Rates must be discussed and confirmed in onboarding before preparing the agreement." };
    let raw: unknown;
    try {
        raw = JSON.parse(p.data.slabsJson);
    }
    catch {
        return { ok: false, error: "Rate card must be valid JSON." };
    }
    const slabs = z.array(z.object({ zone: z.enum(["LOCAL", "REGIONAL", "NATIONAL"]), minWeightKg: z.number().min(0), maxWeightKg: z.number().positive(), price: z.number().nonnegative() }).refine(s => s.maxWeightKg > s.minWeightKg)).min(1).max(300).safeParse(raw);
    if (!slabs.success)
        return { ok: false, error: "Each slab needs zone, minWeightKg, maxWeightKg and price; maximum weight must exceed minimum." };
    const rows = slabs.data;
    if (rows.some((s, i) => rows.some((o, j) => j > i && s.zone === o.zone && s.minWeightKg < o.maxWeightKg && o.minWeightKg < s.maxWeightKg)))
        return { ok: false, error: "Weight bands must not overlap within a zone." };
    await prisma.$transaction(async (tx) => {
        const card = await tx.sellRateCard.create({ data: { name: p.data.title, customerId: a.customerId!, tenantId: a.customer!.tenantId, effectiveFrom: new Date(p.data.effectiveFrom), isActive: false, slabs: { create: rows } } });
        await tx.agreement.create({ data: { customerId: a.customerId!, kind: a.accountType === "individual" ? "B2C" : "B2B", templateVersion: template.name + " / " + template.version, title: p.data.title, termsSnapshot: p.data.terms, rateSnapshot: rows, legalReviewedAt: new Date(), sellRateCardId: card.id, signerName: a.name, signerEmail: a.email } });
        await tx.partnerApplication.update({ where: { id: a.id }, data: { status: a.status === "ACTIVE" ? "ACTIVE" : "AGREEMENT" } });
    });
    revalidatePath("/onboarding");
    revalidatePath("/agreements");
    return { ok: true, message: "Draft created with frozen terms and rates. Open Agreements to preview and prepare signing." };
}
export async function activatePartnerAction(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
    await requireOnboardingAdmin();
    const id = String(fd.get("id") || "");
    const courierIds = fd.getAll("courierIds").map(String);
    const marginType = fd.get("marginType") === "FLAT" ? "FLAT" : "PERCENT";
    const marginValue = Math.max(0, Number(fd.get("marginValue") || 0));
    if (!Number.isFinite(marginValue) || (marginType === "PERCENT" && marginValue > 100)) return { ok: false, error: "Enter a valid reseller margin." };
    if (!courierIds.length)
        return { ok: false, error: "Allocate at least one active courier." };
    const password = randomBytes(18).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);
    try {
        await prisma.$transaction(async (tx) => {
            const a = await tx.partnerApplication.findUnique({ where: { id }, include: { customer: { include: { agreements: true } } } });
            if (!a?.customer || a.status === "ACTIVE" || a.status === "REJECTED")
                throw new Error("Application cannot be activated.");
            if (!a.customer.agreements.some(g => g.status === "SIGNED" && g.sellRateCardId && (!g.renewalDate || g.renewalDate > new Date())))
                throw new Error("A signed rate-card agreement is required.");
            if (await tx.courierPartner.count({ where: { id: { in: courierIds }, status: "ACTIVE" } }) !== new Set(courierIds).size)
                throw new Error("Choose active couriers only.");
            if (await tx.user.findUnique({ where: { email: a.email } }))
                throw new Error("An account with this email already exists; resolve it before activation.");
            await tx.customerCourier.createMany({ data: [...new Set(courierIds)].map(courierPartnerId => ({ customerId: a.customerId!, courierPartnerId })), skipDuplicates: true });
            await tx.user.create({ data: { name: a.name, email: a.email, passwordHash, role: "CUSTOMER", tenantId: a.customer.tenantId, customerId: a.customerId, isBusinessOwner: true, mustChangePassword: true } });
            await tx.customer.update({ where: { id: a.customerId! }, data: { isActive: true, resellerMarginType: marginType, resellerMarginValue: a.accountType === "reseller" ? marginValue : 0 } });
            await tx.partnerApplication.update({ where: { id }, data: { status: "ACTIVE" } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Activation failed" };
    }
    revalidatePath("/onboarding");
    return { ok: true, message: "Account activated. Share this temporary password securely (shown only in this response): " + password + ". Password change is required at first login." };
}
