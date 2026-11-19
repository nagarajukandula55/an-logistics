const OFFICIAL_MAP_URL = "https://livingatlas.esri.in/server1/rest/services/India/Pincode_Boundary_2025/MapServer/export?bbox=68,6,98,38&bboxSR=4326&imageSR=4326&size=1000,633&format=png32&transparent=false&f=image";

export const revalidate = 86400;

export async function GET() {
  try {
    const response = await fetch(OFFICIAL_MAP_URL, { next: { revalidate: 86400 } });
    if (!response.ok) return new Response("India map unavailable", { status: 502 });
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("India map unavailable", { status: 502 });
  }
}
