"use client";

import { useMemo, useState } from "react";

type StateSummary = { name: string; pincodes: number };

const positions: Record<string, [number, number]> = {
  "JAMMU AND KASHMIR": [188, 72], "HIMACHAL PRADESH": [225, 112], PUNJAB: [166, 139], CHANDIGARH: [194, 153], HARYANA: [207, 174], DELHI: [230, 194],
  RAJASTHAN: [130, 229], "UTTAR PRADESH": [273, 244], UTTARAKHAND: [315, 169], BIHAR: [367, 275], SIKKIM: [430, 245],
  ASSAM: [470, 280], "WEST BENGAL": [419, 334], GUJARAT: [93, 336], "MADHYA PRADESH": [218, 334], JHARKHAND: [363, 337],
  CHHATTISGARH: [305, 405], ORISSA: [392, 405], MAHARASHTRA: [188, 449], GOA: [185, 560], KARNATAKA: [220, 515],
  TELANGANA: [283, 480], "ANDHRA PRADESH": [310, 545], "TAMIL NADU": [291, 622], KERALA: [220, 620],
  MEGHALAYA: [454, 290], MIZORAM: [475, 388], TRIPURA: [445, 375], "PONDICHERY": [310, 603], "ANDAMAN & NICOBAR": [450, 630],
};

export function CoverageMap({ states }: { states: StateSummary[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(...states.map((state) => state.pincodes), 1);
  const stateMap = useMemo(() => new Map(states.map((state) => [state.name, state])), [states]);
  const selectedState = selected ? stateMap.get(selected) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <div className="overflow-hidden rounded-2xl border border-border bg-[#0d151b] p-3">
        <svg viewBox="0 0 560 680" className="h-[520px] w-full" role="img" aria-label="Pincode coverage overview by state">
          <path d="M220 28 300 52 342 118 400 162 468 240 535 300 500 370 450 420 404 470 350 535 318 650 264 616 230 557 173 536 127 464 82 395 64 311 105 248 140 185 174 105Z" fill="#18252d" stroke="#536873" strokeWidth="3" />
          {states.map((state) => {
            const point = positions[state.name];
            if (!point) return null;
            const radius = 7 + Math.sqrt(state.pincodes / max) * 17;
            return <g key={state.name} onClick={() => setSelected(state.name)} className="cursor-pointer">
              <circle cx={point[0]} cy={point[1]} r={radius} fill={selected === state.name ? "#fb923c" : "#38bdf8"} opacity=".78" stroke="#e0f2fe" strokeWidth="1.5" />
              <text x={point[0]} y={point[1] + 4} textAnchor="middle" fontSize="9" fill="#071016" fontWeight="700">{state.pincodes}</text>
            </g>;
          })}
        </svg>
        <p className="px-2 pb-1 text-xs text-ink-3">State bubbles show the number of serviceable pincodes in the supplied master. Select a state for details.</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-ink-3">Selected coverage</p>
        {selectedState ? <div className="mt-4 space-y-3"><h3 className="text-xl font-semibold text-ink">{selectedState.name}</h3><p className="text-sm text-ink-2">{selectedState.pincodes.toLocaleString()} pincodes in the current master.</p><button type="button" onClick={() => setSelected(null)} className="text-sm text-accent">Clear selection</button></div> : <p className="mt-4 text-sm text-ink-2">Click a state bubble to inspect coverage. Pincode-level lookup is available below.</p>}
        <div className="mt-6 grid max-h-72 grid-cols-2 gap-2 overflow-auto pr-1">{states.map((state) => <button key={state.name} type="button" onClick={() => setSelected(state.name)} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-2 text-left text-xs text-ink-2 hover:border-accent"><span className="truncate">{state.name}</span><span className="ml-2 font-semibold text-ink">{state.pincodes.toLocaleString()}</span></button>)}</div>
      </div>
    </div>
  );
}
