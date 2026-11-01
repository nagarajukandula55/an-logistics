import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenant";

export async function POST(request: Request) {
  await requireTenantSession();
  const serviceUrl = process.env.VOLUMETRIC_MEASUREMENT_URL;
  const serviceToken = process.env.VOLUMETRIC_MEASUREMENT_TOKEN;
  if (!serviceUrl) return NextResponse.json({ message: "No package measurement service is configured." }, { status: 503 });

  const incoming = await request.formData();
  const images = incoming.getAll("images").filter((value): value is File => value instanceof File);
  if (images.length === 0 || images.length > 8) return NextResponse.json({ message: "Capture between one and eight package images." }, { status: 400 });

  const upstream = new FormData();
  images.forEach((image) => upstream.append("images", image, image.name));
  const response = await fetch(serviceUrl, {
    method: "POST",
    headers: serviceToken ? { Authorization: `Bearer ${serviceToken}` } : undefined,
    body: upstream,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ message: "The package measurement service returned an error." }, { status: 502 });
  return NextResponse.json(result);
}
