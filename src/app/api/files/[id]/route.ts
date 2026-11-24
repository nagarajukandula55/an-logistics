import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { downloadFileFromGoogleDrive } from "@/lib/google-drive";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const file = await prisma.managedFile.findUnique({ where: { id }, include: { order: { select: { customerId: true, tenantId: true } }, agreement: { select: { customerId: true } }, invoice: { select: { customerId: true, tenantId: true } }, customer: { select: { id: true } } } });
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const isInternalStaff = session.user.tenantType === "INTERNAL" && session.user.role !== "CUSTOMER";
  const customerId = session.user.customerId;
  const belongsToCustomer = Boolean(customerId && [file.customer?.id, file.order?.customerId, file.agreement?.customerId, file.invoice?.customerId].includes(customerId));
  if (!isInternalStaff && !belongsToCustomer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const downloaded = await downloadFileFromGoogleDrive(file.driveFileId);
    return new NextResponse(new Uint8Array(downloaded.bytes), { headers: { "Content-Type": file.mimeType || downloaded.contentType, "Content-Disposition": `inline; filename="${file.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "File could not be retrieved" }, { status: 502 });
  }
}

