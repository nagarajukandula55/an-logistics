import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CoverageMap } from "./CoverageMap";
import coverage from "../../../prisma/rate-data/pincode-coverage.json";

type SearchParams = Promise<{ pincode?: string }>;

export const dynamic = "force-dynamic";

function isDtdcDirect(pickupStatus: string) {
  return pickupStatus.trim().toUpperCase() === "NORMAL PICK UP SERVICE AVAILABLE";
}

export default async function RateCardOnePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.pincode ?? "").replace(/\D/g, "").slice(0, 6);
  const match = query.length === 6 ? coverage.records.find((row) => row.pincode === query) : null;
  const card = await prisma.sellRateCard.findFirst({
    where: { name: "Rate Card 1", audience: "DEFAULT", tenantId: null, customerId: null, isActive: true, isFinalized: true },
    include: { slabs: { where: { isActive: true }, orderBy: [{ zone: "asc" }, { minWeightKg: "asc" }] }, courierPartner: true },
    orderBy: { effectiveFrom: "desc" },
  }).catch(() => null);

  return <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-8">
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">AN Logistics - DTDC verification</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Rate Card 1</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-2">Customer-facing selling rates and serviceability reference. Internal courier cost sheets, fuel calculations, and unpublished schedules are not shown on this page.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-ink-3"><span className="rounded-full bg-surface-2 px-3 py-1">Direct verification link</span><span className="rounded-full bg-surface-2 px-3 py-1">No navigation entry</span><span className="rounded-full bg-surface-2 px-3 py-1">Pincode master: {coverage.recordCount.toLocaleString()} records</span></div>
      </header>

      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Pincode coverage</h2><p className="mt-1 text-sm text-ink-2">Official India PIN-code boundaries with service coverage filters. End Mile TAT is kept separately from rate calculation.</p></div><div className="text-right text-xs text-ink-3"><div>{coverage.states.length} states - {coverage.districtCount} districts</div><div>Source: {coverage.sourceFile}</div></div></div>
        <div className="mt-6"><CoverageMap records={coverage.records.map((row) => [row.state, row.indiaPostAvailable, row.pickupStatus.trim().toUpperCase() === "NORMAL PICK UP SERVICE AVAILABLE", row.latitude, row.longitude] as [string, boolean, boolean, number | null, number | null])} /></div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8"><h2 className="text-xl font-semibold">Check a pincode</h2><form className="mt-4 flex max-w-xl gap-2" method="get"><input name="pincode" inputMode="numeric" maxLength={6} defaultValue={query} placeholder="Enter 6-digit pincode" className="min-w-0 flex-1 rounded-xl border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" /><button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">Check coverage</button></form>{query && (match ? <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"><p className="font-semibold text-emerald-300">{match.pincode} {isDtdcDirect(match.pickupStatus) || match.indiaPostAvailable ? "is serviceable" : "has a coverage record"}</p><p className="mt-1 text-ink-2">{match.district}, {match.state}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><p className="rounded-lg bg-black/10 px-3 py-2 text-ink-2"><span className="font-semibold text-ink">Service:</span> {isDtdcDirect(match.pickupStatus) ? "DTDC direct" : match.indiaPostAvailable ? "India Post via DTDC" : "Not marked available"}</p><p className="rounded-lg bg-black/10 px-3 py-2 text-ink-2"><span className="font-semibold text-ink">Pickup:</span> {match.pickupStatus}</p><p className="rounded-lg bg-black/10 px-3 py-2 text-ink-2"><span className="font-semibold text-ink">Delivery:</span> {match.deliveryStatus}</p><p className="rounded-lg bg-black/10 px-3 py-2 text-ink-2"><span className="font-semibold text-ink">End Mile TAT:</span> {match.endMileTatDays ?? "Not provided"} day(s)</p></div></div> : <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">That pincode is not present in the supplied coverage master.</div>)}</section>

      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Published selling rates</h2><p className="mt-1 text-sm text-ink-2">Only a finalized card named &quot;Rate Card 1&quot; is eligible for this direct page.</p></div>{card?.courierPartner && <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-2">Courier: {card.courierPartner.name}</span>}</div>{card ? <div className="mt-5 overflow-x-auto rounded-2xl border border-border"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Min kg</th><th className="px-4 py-3">Max kg</th><th className="px-4 py-3">Selling price</th></tr></thead><tbody>{card.slabs.map((slab) => <tr key={slab.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{slab.zone}</td><td className="px-4 py-3">{slab.minWeightKg}</td><td className="px-4 py-3">{slab.maxWeightKg}</td><td className="px-4 py-3 font-semibold">Rs. {slab.price.toFixed(2)}</td></tr>)}</tbody></table></div> : <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Rate Card 1 is not yet finalized and published. This page will remain safe to share; it will show the rates automatically after the card is finalized.</div>}</section>
      <footer className="flex justify-between text-xs text-ink-3"><span>Prepared for DTDC verification</span><Link href="/login" className="text-accent">Partner login</Link></footer>
    </div>
  </main>;
}
