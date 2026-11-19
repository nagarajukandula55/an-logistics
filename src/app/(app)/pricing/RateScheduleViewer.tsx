"use client";

import { useMemo, useState } from "react";

type RateRow = { lane: string; minWeightKg: number; maxWeightKg: number; costPrice: number };
type RateMatrix = { id: string; name: string; matrixType: string; serviceCode: string; levelCode: string | null; customerSegment: string; sourceSheet: string | null; effectiveFrom: Date | string; rows: RateRow[] };
type CategoryId = "B2B_ECOM" | "B2C_ECOM" | "BRANCH" | "MLB";

const categoryInfo: Record<CategoryId, { label: string; description: string }> = {
  B2B_ECOM: { label: "E-commerce B2B", description: "CPDP online-shipping rates. NEL0 is the default customer-facing level." },
  B2C_ECOM: { label: "E-commerce B2C", description: "MLB e-commerce schedules for B2C shipments, separated by DTDC and India Post." },
  BRANCH: { label: "Branch", description: "Branch schedules split between DTDC direct and India Post services." },
  MLB: { label: "Reverse pickup (MLB)", description: "Multilocation reverse-pickup schedules, including regional zones and special categories." },
};

const serviceLabels: Record<string, string> = {
  "7V": "7V - E-commerce Priority",
  "7X": "7X - E-commerce Priority",
  "7D": "7D - E-commerce",
  "7G": "7G - E-commerce",
  EXPRESS: "Express",
  AIR_CARGO: "Air Cargo",
  SURFACE_CARGO: "Surface Cargo",
  PEP_BLUE: "PEP Blue CP",
  PEC_BLUE: "PEC Blue CP",
  PRIORITY: "Priority",
};

const segmentLabels: Record<string, string> = {
  B2C_ECOM_DTDC: "DTDC",
  B2C_ECOM_INDIA_POST: "India Post",
  BRANCH: "DTDC direct",
  DTDC: "DTDC",
  INDIA_POST: "India Post",
  DOX: "Dox",
  NON_DOX: "Non-Dox",
  NON_ECOM: "Blue CP",
};

function label(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function serviceLabel(value: string) { return serviceLabels[value] ?? label(value); }
function segmentLabel(value: string) { return segmentLabels[value] ?? label(value); }
function weightLabel(min: number, max: number) { const format = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); return max >= 1000 ? `${format(min)} kg+` : `${format(min)}-${format(max)} kg`; }
function isCategory(matrix: RateMatrix, category: CategoryId) {
  if (category === "B2B_ECOM") return matrix.matrixType === "CPDP_ECOM";
  if (category === "B2C_ECOM") return matrix.matrixType === "MLB_REVERSE" && matrix.customerSegment.startsWith("B2C_ECOM");
  if (category === "BRANCH") return matrix.matrixType === "DOMESTIC_TS_BASE";
  return matrix.matrixType === "MLB_REVERSE" && !matrix.customerSegment.startsWith("B2C_ECOM");
}

export function RateScheduleViewer({ matrices, audience }: { matrices: RateMatrix[]; audience: "DEFAULT" | "STAFF" | "COLLABORATOR" }) {
  const categories = (Object.keys(categoryInfo) as CategoryId[]).filter((category) => matrices.some((matrix) => isCategory(matrix, category)));
  const [category, setCategory] = useState<CategoryId>(categories[0] ?? "B2B_ECOM");
  const categoryMatrices = matrices.filter((matrix) => isCategory(matrix, category));
  const segments = useMemo(() => [...new Set(categoryMatrices.map((matrix) => matrix.customerSegment))], [categoryMatrices]);
  const [segment, setSegment] = useState("");
  const activeSegment = segments.includes(segment) ? segment : segments[0] ?? "";
  const segmentMatrices = category === "B2B_ECOM" ? categoryMatrices : categoryMatrices.filter((matrix) => matrix.customerSegment === activeSegment);
  const services = [...new Set(segmentMatrices.map((matrix) => matrix.serviceCode))];
  const [service, setService] = useState("");
  const activeService = services.includes(service) ? service : services[0] ?? "";
  const serviceMatrices = segmentMatrices.filter((matrix) => matrix.serviceCode === activeService);
  const levels = [...new Set(serviceMatrices.map((matrix) => matrix.levelCode).filter(Boolean) as string[])];
  const [level, setLevel] = useState("");
  const activeLevel = category === "B2B_ECOM" ? "NEL0" : levels.includes(level) ? level : levels[0] ?? "";
  const choices = serviceMatrices.filter((matrix) => !activeLevel || matrix.levelCode === activeLevel);
  const [matrixId, setMatrixId] = useState("");
  const matrix = choices.find((item) => item.id === matrixId) ?? choices[0];
  const weights = matrix ? [...new Map(matrix.rows.map((row) => [`${row.minWeightKg}|${row.maxWeightKg}`, { min: row.minWeightKg, max: row.maxWeightKg }])).values()].sort((a, b) => a.min - b.min) : [];
  const lanes = [...new Set((matrix?.rows ?? []).map((row) => row.lane))].sort();
  const rate = (lane: string, min: number, max: number) => matrix?.rows.find((row) => row.lane === lane && row.minWeightKg === min && row.maxWeightKg === max)?.costPrice ?? null;
  const selectClass = "mt-1 h-10 w-full rounded-control border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm";
  const reset = (nextCategory: CategoryId) => { setCategory(nextCategory); setSegment(""); setService(""); setLevel(""); setMatrixId(""); };

  if (!matrices.length) return null;
  return <section className="rounded-card border border-border bg-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">Structured rate viewer</h3><p className="mt-1 max-w-3xl text-xs text-ink-3">Select the business type, provider/category and service. Displayed rates are the {audience.toLowerCase()} selling schedule at 2x the adjusted courier cost.</p></div><span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-ink-2">{matrices.length} source schedules</span></div>
    <div className="mt-4 flex flex-wrap gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => reset(item)} className={`rounded-control border px-3 py-2 text-left text-sm ${category === item ? "border-accent bg-accent-soft text-ink" : "border-border bg-surface-2 text-ink-2"}`}><span className="font-medium">{categoryInfo[item].label}</span><span className="ml-2 text-xs text-ink-3">{categoryInfo[item].description}</span></button>)}</div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {category !== "B2B_ECOM" && segments.length > 1 && <label className="text-xs font-medium text-ink-2">Provider / category<select value={activeSegment} onChange={(event) => { setSegment(event.target.value); setService(""); setLevel(""); setMatrixId(""); }} style={{ colorScheme: "light" }} className={selectClass}>{segments.map((item) => <option className="bg-white text-slate-900" key={item} value={item}>{segmentLabel(item)}</option>)}</select></label>}
      <label className="text-xs font-medium text-ink-2">Service<select value={activeService} onChange={(event) => { setService(event.target.value); setLevel(""); setMatrixId(""); }} style={{ colorScheme: "light" }} className={selectClass}>{services.map((item) => <option className="bg-white text-slate-900" key={item} value={item}>{serviceLabel(item)}</option>)}</select></label>
      {category === "B2B_ECOM" && <label className="text-xs font-medium text-ink-2">NEL level<select value="NEL0" disabled style={{ colorScheme: "light" }} className={`${selectClass} cursor-not-allowed opacity-90`}><option className="bg-white text-slate-900" value="NEL0">NEL0 - Default</option></select></label>}
      {category !== "B2B_ECOM" && levels.length > 0 && <label className="text-xs font-medium text-ink-2">Level<select value={activeLevel} onChange={(event) => { setLevel(event.target.value); setMatrixId(""); }} style={{ colorScheme: "light" }} className={selectClass}>{levels.map((item) => <option className="bg-white text-slate-900" key={item}>{item}</option>)}</select></label>}
      {choices.length > 1 && <label className="text-xs font-medium text-ink-2">Schedule<select value={matrix?.id ?? ""} onChange={(event) => setMatrixId(event.target.value)} style={{ colorScheme: "light" }} className={selectClass}>{choices.map((item) => <option className="bg-white text-slate-900" key={item.id} value={item.id}>{item.name.replace("DTDC ", "")}</option>)}</select></label>}
    </div>
    {matrix && <div className="mt-4 overflow-hidden rounded-control border border-border"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2"><div><p className="text-sm font-semibold text-ink">{serviceLabel(matrix.serviceCode)}{matrix.levelCode ? ` - ${matrix.levelCode}` : ""}</p><p className="text-xs text-ink-3">{categoryInfo[category].label} - {segmentLabel(matrix.customerSegment)}</p></div><span className="text-xs text-ink-3">{lanes.length} destinations - {weights.length} weight slabs</span></div><div className="max-h-[32rem] overflow-auto"><table className="min-w-full text-sm"><thead className="sticky top-0 z-10 bg-surface-2 text-xs uppercase tracking-wide text-ink-3"><tr><th className="sticky left-0 z-20 min-w-44 bg-surface-2 px-3 py-3 text-left font-medium">Destination / zone</th>{weights.map((weight) => <th key={`${weight.min}-${weight.max}`} className="min-w-28 whitespace-nowrap px-3 py-3 text-right font-medium">{weightLabel(weight.min, weight.max)}</th>)}</tr></thead><tbody className="divide-y divide-border">{lanes.map((lane) => <tr key={lane} className="text-ink-2"><td className="sticky left-0 bg-surface px-3 py-2 font-medium">{label(lane)}</td>{weights.map((weight) => { const value = rate(lane, weight.min, weight.max); return <td key={`${lane}-${weight.min}-${weight.max}`} className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular">{value == null ? "-" : `Rs. ${(value * 2).toFixed(2)}`}</td>; })}</tr>)}</tbody></table></div></div>}
  </section>;
}
