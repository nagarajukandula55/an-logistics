"use client";

import { useMemo, useState } from "react";

type RateRow = {
  lane: string;
  minWeightKg: number;
  maxWeightKg: number;
  costPrice: number;
};

type RateMatrix = {
  id: string;
  name: string;
  matrixType: string;
  serviceCode: string;
  levelCode: string | null;
  customerSegment: string;
  sourceSheet: string | null;
  effectiveFrom: Date | string;
  rows: RateRow[];
};

const categoryInfo: Record<string, { label: string; description: string }> = {
  CPDP_ECOM: { label: "E-commerce", description: "CPDP online-shipping rates, with service and NEL level selection." },
  DOMESTIC_TS_BASE: { label: "Branch", description: "Branch tariff schedules for the Vijayawada/Vizag base." },
  MLB_REVERSE: { label: "Reverse pickup (MLB)", description: "Multilocation reverse-pickup schedules from the MLB workbook." },
};

const serviceLabels: Record<string, string> = {
  "7V": "7V — E-commerce Premium",
  "7X": "7X — E-commerce Priority",
  "7D": "7D — E-commerce Ground Express",
  "7G": "7G — E-commerce Ground Cargo",
  EXPRESS_A: "Express A",
  EXPRESS_B: "Express B",
  EXPRESS_C: "Express C",
  FREEDOM_EXPRESS: "Freedom Express",
  EXPRESS: "Express",
  AIR_CARGO: "Air Cargo",
  SURFACE_CARGO: "Surface Cargo",
  PEP_BLUE: "PEP — Blue CP",
  PEC_BLUE: "PEC — Blue CP",
  PRIORITY: "Priority",
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function weightLabel(min: number, max: number) {
  const format = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return max >= 1000 ? `${format(min)} kg+` : `${format(min)}–${format(max)} kg`;
}

export function RateScheduleViewer({ matrices, audience }: { matrices: RateMatrix[]; audience: "DEFAULT" | "STAFF" | "COLLABORATOR" }) {
  const categories = useMemo(() => [...new Set(matrices.map((matrix) => matrix.matrixType))], [matrices]);
  const [category, setCategory] = useState(categories[0] ?? "");
  const categoryMatrices = matrices.filter((matrix) => matrix.matrixType === category);
  const segments = [...new Set(categoryMatrices.map((matrix) => matrix.customerSegment))];
  const [segment, setSegment] = useState("");
  const activeSegment = segments.includes(segment) ? segment : segments[0] ?? "";
  const segmentMatrices = categoryMatrices.filter((matrix) => matrix.customerSegment === activeSegment);
  const services = [...new Set(segmentMatrices.map((matrix) => matrix.serviceCode))];
  const [service, setService] = useState("");
  const activeService = services.includes(service) ? service : services[0] ?? "";
  const serviceMatrices = segmentMatrices.filter((matrix) => matrix.serviceCode === activeService);
  const levels = [...new Set(serviceMatrices.map((matrix) => matrix.levelCode).filter(Boolean) as string[])];
  const [level, setLevel] = useState("");
  const activeLevel = levels.includes(level) ? level : levels[0] ?? "";
  const choices = serviceMatrices.filter((matrix) => !activeLevel || matrix.levelCode === activeLevel);
  const [matrixId, setMatrixId] = useState("");
  const matrix = choices.find((item) => item.id === matrixId) ?? choices[0];

  const weights = useMemo(() => {
    if (!matrix) return [];
    return [...new Map(matrix.rows.map((row) => [`${row.minWeightKg}|${row.maxWeightKg}`, { min: row.minWeightKg, max: row.maxWeightKg }])).values()].sort((a, b) => a.min - b.min);
  }, [matrix]);
  const lanes = useMemo(() => [...new Set((matrix?.rows ?? []).map((row) => row.lane))].sort(), [matrix]);
  const rate = (lane: string, min: number, max: number) => matrix?.rows.find((row) => row.lane === lane && row.minWeightKg === min && row.maxWeightKg === max)?.costPrice ?? null;

  if (!matrices.length) return null;
  return <section className="rounded-card border border-border bg-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-ink">Structured rate viewer</h3>
        <p className="mt-1 max-w-3xl text-xs text-ink-3">Select one category and one service. Rates shown are the {audience.toLowerCase()} selling schedule at 2× the adjusted courier cost.</p>
      </div>
      <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-ink-2">{matrices.length} source schedules</span>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <div className="md:col-span-3 flex flex-wrap gap-2">
        {categories.map((item) => <button key={item} type="button" onClick={() => { setCategory(item); setSegment(""); setService(""); setLevel(""); setMatrixId(""); }} className={`rounded-control border px-3 py-2 text-left text-sm ${category === item ? "border-accent bg-accent-soft text-ink" : "border-border bg-surface-2 text-ink-2"}`}><span className="font-medium">{categoryInfo[item]?.label ?? label(item)}</span><span className="ml-2 text-xs text-ink-3">{categoryInfo[item]?.description}</span></button>)}
      </div>
      {segments.length > 1 && <label className="text-xs font-medium text-ink-2">Rate type<select value={activeSegment} onChange={(event) => { setSegment(event.target.value); setService(""); setLevel(""); setMatrixId(""); }} className="mt-1 h-10 w-full rounded-control border border-border bg-surface-2 px-3 text-sm text-ink">{segments.map((item) => <option key={item} value={item}>{item === "DOX" ? "Dox" : item === "NON_DOX" ? "Non-dox" : item === "NON_ECOM" && category === "MLB_REVERSE" ? "MLB standard" : item === "NON_ECOM" ? "Standard non-e-commerce" : label(item)}</option>)}</select></label>}
      <label className="text-xs font-medium text-ink-2">Service<select value={activeService} onChange={(event) => { setService(event.target.value); setLevel(""); setMatrixId(""); }} className="mt-1 h-10 w-full rounded-control border border-border bg-surface-2 px-3 text-sm text-ink">{services.map((item) => <option key={item} value={item}>{serviceLabels[item] ?? label(item)}</option>)}</select></label>
      {levels.length > 0 && <label className="text-xs font-medium text-ink-2">NEL level<select value={activeLevel} onChange={(event) => { setLevel(event.target.value); setMatrixId(""); }} className="mt-1 h-10 w-full rounded-control border border-border bg-surface-2 px-3 text-sm text-ink">{levels.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
      {choices.length > 1 && <label className="text-xs font-medium text-ink-2">Source schedule<select value={matrix?.id ?? ""} onChange={(event) => setMatrixId(event.target.value)} className="mt-1 h-10 w-full rounded-control border border-border bg-surface-2 px-3 text-sm text-ink">{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    </div>
    {matrix && <div className="mt-4 overflow-hidden rounded-control border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2"><div><p className="text-sm font-semibold text-ink">{serviceLabels[matrix.serviceCode] ?? label(matrix.serviceCode)}{matrix.levelCode ? ` · ${matrix.levelCode}` : ""}</p><p className="text-xs text-ink-3">{matrix.name} · {matrix.customerSegment === "DOX" ? "Dox" : matrix.customerSegment === "NON_DOX" ? "Non-dox" : matrix.customerSegment === "ECOM" ? "E-commerce" : category === "MLB_REVERSE" ? "MLB standard" : "Standard non-e-commerce"}</p></div><span className="text-xs text-ink-3">{lanes.length} destinations · {weights.length} weight slabs</span></div>
      <div className="max-h-[32rem] overflow-auto"><table className="min-w-full text-sm"><thead className="sticky top-0 z-10 bg-surface-2 text-xs uppercase tracking-wide text-ink-3"><tr><th className="sticky left-0 z-20 min-w-44 bg-surface-2 px-3 py-3 text-left font-medium">Destination / zone</th>{weights.map((weight) => <th key={`${weight.min}-${weight.max}`} className="min-w-28 whitespace-nowrap px-3 py-3 text-right font-medium">{weightLabel(weight.min, weight.max)}</th>)}</tr></thead><tbody className="divide-y divide-border">{lanes.map((lane) => <tr key={lane} className="text-ink-2"><td className="sticky left-0 bg-surface px-3 py-2 font-medium">{label(lane)}</td>{weights.map((weight) => { const value = rate(lane, weight.min, weight.max); return <td key={`${lane}-${weight.min}-${weight.max}`} className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular">{value == null ? "—" : `Rs. ${(value * 2).toFixed(2)}`}</td>; })}</tr>)}</tbody></table></div>
    </div>}
  </section>;
}
