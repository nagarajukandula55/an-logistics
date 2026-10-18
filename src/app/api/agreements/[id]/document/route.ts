import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOnboardingAdmin } from "@/lib/onboarding";
import { fetchAgreementPdf } from "@/lib/agreements";

// Staff-only proxy for viewing/downloading an Agreement's PDF from Zoho
// Sign — works both pre-signature (the sent-for-signing draft) and post
// (the fully executed copy), since Zoho Sign serves both from the same
// endpoint. We don't store the bytes ourselves; this just streams them
// through on demand, same no-local-copy approach as providerLabelUrl.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireOnboardingAdmin();
  const { id } = await params;

  const agreement = await prisma.agreement.findUnique({ where: { id } });
  if (!agreement?.externalEnvelopeId) {
    return NextResponse.json({ error: "No document available for this agreement yet" }, { status: 404 });
  }

  const pdf = await fetchAgreementPdf(agreement.externalEnvelopeId);
  if (!pdf) {
    return NextResponse.json({ error: "Could not fetch document from Zoho Sign" }, { status: 502 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="agreement-${agreement.id}.pdf"`,
    },
  });
}
