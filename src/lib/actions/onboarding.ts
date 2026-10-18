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
export type OnboardingState = {
    ok: boolean;
    error?: string;
    message?: string;
};
const applicationSchema = z.object({
    name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
    phone: z.string().trim().regex(/^(?:\+91[ -]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
    company: z.string().trim().max(200).optional(), accountType: z.enum(["individual", "business", "reseller"]),
    address: z.string().trim().min(10).max(1000), pincode: z.string().regex(/^[1-9]\d{5}$/),
    gstin: z.string().trim().toUpperCase().regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN or leave blank").optional(),
    monthlyVolume: z.coerce.number().int().min(0).max(10000000), shipmentType: z.string().trim().max(80).optional(), servicePreference: z.string().trim().max(120).optional(), pickupFrequency: z.string().trim().max(80).optional(), requirements: z.string().max(2000).optional(),
    consent: z.literal("on", { error: "Please accept the privacy notice and contact consent" }), website: z.string().max(0).optional(),
});
export async function applyPartnerAction(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
    const result = applicationSchema.safeParse(Object.fromEntries(fd));
    if (!result.success)
        return { ok: false, error: result.error.issues[0].message };
    const { consent, website, shipmentType, servicePreference, pickupFrequency, ...data } = result.data;
    const requirements = [shipmentType && `Shipment type: ${shipmentType}`, servicePreference && `Service needs: ${servicePreference}`, pickupFrequency && `Pickup frequency: ${pickupFrequency}`, data.requirements].filter(Boolean).join("\n").slice(0, 2000);
    data.requirements = requirements;
    void consent;
    void website;
    try {
        await prisma.partnerApplication.create({ data: { ...data, consentAt: new Date() } });
    }
    catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
            return { ok: true, message: "Your application is already with our team. We will contact you." };
        throw e;
    }
    const escape = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    try {
        await notifyOpsTelegram("PARTNER_APPLICATION", `New application: <b>${escape(data.name)}</b>\n${escape(data.company || data.accountType)}\n${escape(data.email)} · ${escape(data.phone)}\nReview in Admin → Onboarding.`);
    }
    catch {
        console.error("Application saved; Telegram notification failed.");
    }
    return { ok: true, message: "Application received. Our team will contact you to discuss rates and an agreement. Login access follows signing and approval." };
}
export async function reviewApplicationAction(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
    await requireOnboardingAdmin();
    const parsed = z.object({ id: z.string(), status: z.enum(["CONTACTED", "NEGOTIATING", "AGREEMENT", "REJECTED"]), notes: z.string().max(10000) }).safeParse(Object.fromEntries(fd));
    if (!parsed.success)
        return { ok: false, error: "Invalid review details" };
    const tenantId = await getMarketplaceTenantId();
    await prisma.$transaction(async (tx) => {
        const a = await tx.partnerApplication.findUnique({ where: { id: parsed.data.id } });
        if (!a || a.status === "ACTIVE")
            throw new Error("Application is unavailable or already active");
        const customerId = a.customerId ?? (await tx.customer.create({ data: { name: a.company || a.name, email: a.email, phone: a.phone, address: a.address, kind: a.accountType === "individual" ? "INDIVIDUAL" : "BUSINESS", tenantId, isActive: false } })).id;
        await tx.partnerApplication.update({ where: { id: a.id }, data: { customerId, status: parsed.data.status, notes: parsed.data.notes } });
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
            await tx.customer.update({ where: { id: a.customerId! }, data: { isActive: true } });
            await tx.partnerApplication.update({ where: { id }, data: { status: "ACTIVE" } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Activation failed" };
    }
    revalidatePath("/onboarding");
    return { ok: true, message: "Account activated. Share this temporary password securely (shown only in this response): " + password + ". Password change is required at first login." };
}
