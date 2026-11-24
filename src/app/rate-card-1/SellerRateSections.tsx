"use client";

import { useMemo, useState } from "react";

type SourceRow = { lane: string; minWeightKg: number; maxWeightKg: number; sourceCostPrice: number };
type SourceMatrix = { idKey: string; name: string; matrixType: string; serviceCode: string; levelCode: string | null; customerSegment: string; costAdjustmentPercent: number; rows: SourceRow[] };

const labels: Record<string, string> = { ECOM_B2B: "E-commerce B2B", ECOM_B2C: "E-commerce B2C", BRANCH: "Branch", MLB: "MLB B2B / Non-e-commerce" };
const segmentLabels: Record<string, string> = { ECOM: "DTDC Direct", B2C_ECOM_DTDC: "DTDC Direct", B2C_ECOM_INDIA_POST: "India Post", BRANCH: "DTDC Direct", DTDC: "DTDC Direct", INDIA_POST: "India Post", DOX: "Dox", NON_DOX: "Non-Dox", NON_ECOM: "Blue CP" };
const laneLabels: Record<string, string> = { CITY: "City", LOCAL: "Local", METRO: "Metro", REGION: "Region", ZONE: "Zone", ROI: "ROI", ROI_A: "ROI A", ROI_B: "ROI B", SPECIAL_DESTINATION: "Special Destination", SPL_DEST: "Special Destination" };
const laneLabel = (lane: string) => laneLabels[lane] ?? lane.replaceAll("_", " ").replace(/\b\w/g, (value) => value.toUpperCase());
const segmentLabel = (segment: string) => segmentLabels[segment] ?? segment.replaceAll("_", " ").replace(/\b\w/g, (value) => value.toUpperCase());
const serviceLabel = (service: string) => ({ "7V": "7V", "7X": "7X", "7D": "7D", "7G": "7G", EXPRESS: "Express", AIR_CARGO: "Air Cargo", SURFACE_CARGO: "Surface Cargo", PRIORITY: "Priority", PEP_BLUE: "Blue PEP", PEC_BLUE: "Blue PEC" }[service] ?? service);

export function SellerRateSections({ matrices }: { matrices: SourceMatrix[] }) {
  const [category, setCategory] = useState<keyof typeof labels>("ECOM_B2B");
  const [segment, setSegment] = useState("");
  const [service, setService] = useState("ALL");
  const categoryMatrices = useMemo(() => matrices.filter((matrix) => {
    if (category === "ECOM_B2B") return matrix.matrixType === "CPDP_ECOM" && matrix.levelCode === "NEL0";
    if (category === "ECOM_B2C") return matrix.matrixType === "MLB_REVERSE" && ["B2C_ECOM_DTDC", "B2C_ECOM_INDIA_POST"].includes(matrix.customerSegment);
    if (category === "BRANCH") return matrix.matrixType === "DOMESTIC_TS_BASE" && ["EXPRESS", "AIR_CARGO", "SURFACE_CARGO"].includes(matrix.serviceCode) && ["BRANCH", "INDIA_POST"].includes(matrix.customerSegment);
    return matrix.matrixType === "MLB_REVERSE" && !matrix.customerSegment.startsWith("B2C_ECOM");
  }), [category, matrices]);
  const segments = useMemo(() => Array.from(new Set(categoryMatrices.map((matrix) => matrix.customerSegment))), [categoryMatrices]);
  const defaultSegment = segments.includes("DTDC") ? "DTDC" : segments[0] ?? "";
  const activeSegment = segments.includes(segment) ? segment : defaultSegment;
  const services = useMemo(() => Array.from(new Set(categoryMatrices.map((matrix) => matrix.serviceCode))), [categoryMatrices]);
  const visible = useMemo(() => category === "ECOM_B2B" ? categoryMatrices.filter((matrix) => service === "ALL" || matrix.serviceCode === service) : categoryMatrices.filter((matrix) => matrix.customerSegment === activeSegment && (service === "ALL" || matrix.serviceCode === service)), [category, categoryMatrices, activeSegment, service]);

  return <div className="mt-5 rounded-2xl border border-border bg-canvas p-4">
    <div className="flex flex-wrap gap-2">{(Object.keys(labels) as Array<keyof typeof labels>).map((key) => <button key={key} type="button" onClick={() => { setCategory(key); setSegment(""); setService("ALL"); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${category === key ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-2"}`}>{labels[key]}</button>)}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{category !== "ECOM_B2B" && <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Provider / schedule type<select value={activeSegment} onChange={(event) => setSegment(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case text-ink">{segments.map((item) => <option key={item} value={item}>{segmentLabel(item)}</option>)}</select></label>}<label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Service<select value={service} onChange={(event) => setService(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case text-ink"><option value="ALL">All services</option>{services.map((item) => <option key={item} value={item}>{serviceLabel(item)}</option>)}</select></label></div>
    <p className="mt-4 text-xs text-ink-3">Indicative seller rates only. Final rates may change after service review, volume confirmation, and commercial discussion.</p>
    <div className="mt-4 max-h-[34rem] overflow-auto rounded-xl border border-border"><div className="min-w-[620px]">{visible.length ? visible.map((matrix) => <section key={matrix.idKey} className="border-b border-border last:border-0"><div className="sticky top-0 z-[1] flex items-center justify-between gap-3 bg-surface-2 px-4 py-3"><div><h3 className="font-semibold text-ink">{segmentLabel(matrix.customerSegment)} � {serviceLabel(matrix.serviceCode)}</h3><p className="text-xs text-ink-3">{category === "ECOM_B2B" ? "E-commerce B2B" : category === "ECOM_B2C" ? "E-commerce B2C" : "MLB B2B / Non-e-commerce"} � {matrix.rows.length} rate rows</p></div><span className="text-xs text-ink-3">Seller price</span></div><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-4 py-2">Destination / zone</th><th className="px-4 py-2">Weight</th><th className="px-4 py-2 text-right">Rate</th></tr></thead><tbody>{matrix.rows.map((row, index) => { const price = Math.round(row.sourceCostPrice * (1 + matrix.costAdjustmentPercent / 100) * 2 * 100) / 100; return <tr key={`${matrix.idKey}-${row.lane}-${row.minWeightKg}-${index}`} className="border-t border-border"><td className="px-4 py-2 font-medium">{laneLabel(row.lane)}</td><td className="px-4 py-2">{row.minWeightKg}-{row.maxWeightKg} kg</td><td className="px-4 py-2 text-right font-semibold">Rs. {price.toFixed(2)}</td></tr>; })}</tbody></table></section>) : <p className="p-6 text-sm text-ink-2">No seller schedule is available for this selection.</p>}</div></div>
  </div>;
}
