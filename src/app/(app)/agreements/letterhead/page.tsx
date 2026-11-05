import { requireOnboardingAdmin } from "@/lib/onboarding";
import { renderDtdcLetterheadHtml } from "@/lib/dtdc-documents";

export default async function LetterheadPage() {
  await requireOnboardingAdmin();
  const html = renderDtdcLetterheadHtml({ title: "AN Logistics Letterhead", reference: "ANL-LH", subject: "DTDC Channel Partner Communication", body: "Use this page for DTDC customer, courier and operations communications. Replace this text with the approved communication before printing or saving as PDF." });
  return <iframe title="AN Logistics letterhead" srcDoc={html} className="min-h-[calc(100vh-120px)] w-full rounded-xl border border-border bg-white" />;
}
