import { redirect } from "next/navigation";

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/api/quotations/${id}`);
}
