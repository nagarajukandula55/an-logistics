"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const INDIA_BOUNDS = { west: 68, east: 98, south: 6, north: 38 };
const INDIA_OUTLINE: Array<[number, number]> = [[68.1, 23.8], [68.8, 24.8], [70, 25.5], [71.5, 26.4], [73, 27.5], [74.6, 29], [76, 30.3], [77.4, 31.2], [78.7, 32.4], [80, 33.2], [81.4, 34], [83, 34.7], [84.5, 35.1], [86, 34.6], [87.4, 34], [88.6, 32.9], [89.8, 31.8], [90.8, 30.5], [91.7, 29.1], [92.5, 28.2], [93.8, 27.3], [95.2, 27.1], [96.4, 28], [97.4, 27.1], [97.8, 25.7], [97.1, 24.5], [96, 23.5], [95, 22.7], [94, 21.7], [93, 22.1], [92, 23.1], [91, 23], [90.3, 22], [89.2, 22.3], [88.3, 22], [87.4, 21.5], [86.5, 20.8], [85.8, 19.6], [85.2, 18.4], [84.6, 17.2], [83.9, 16], [83.3, 14.7], [82.7, 13.5], [82, 12.1], [81.2, 10.8], [80.4, 9.6], [79.6, 8.6], [78.6, 7.9], [77.5, 7.2], [76.5, 7.7], [75.6, 8.8], [74.9, 10], [74.3, 11.4], [73.8, 12.8], [73.3, 14.2], [72.8, 15.6], [72.2, 17.1], [71.5, 18.6], [70.8, 20], [70.1, 21.3], [69.4, 22.6], [68.6, 23.4]];

type CoverageRecord = [state: string, indiaPostAvailable: boolean, dtdcDirect: boolean, latitude: number | null, longitude: number | null];
type Filter = "all" | "dtdc" | "india-post";

export function CoverageMap({ records }: { records: CoverageRecord[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState("ALL INDIA");
  const [filter, setFilter] = useState<Filter>("dtdc");

  const states = useMemo(() => ["ALL INDIA", ...Array.from(new Set(records.map((record) => record[0]))).sort()], [records]);
  const filteredRecords = useMemo(() => records.filter((record) => {
    if (state !== "ALL INDIA" && record[0] !== state) return false;
    if (filter === "india-post") return record[1];
    if (filter === "dtdc") return record[2];
    return true;
  }), [filter, records, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const draw = () => {
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#e4edf0";
      context.fillRect(0, 0, width, height);
      context.beginPath();
      INDIA_OUTLINE.forEach(([longitude, latitude], index) => {
        const x = ((longitude - INDIA_BOUNDS.west) / (INDIA_BOUNDS.east - INDIA_BOUNDS.west)) * width;
        const y = (1 - (latitude - INDIA_BOUNDS.south) / (INDIA_BOUNDS.north - INDIA_BOUNDS.south)) * height;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.closePath();
      context.fillStyle = "#cbd9dd";
      context.fill();
      context.strokeStyle = "#647b84";
      context.lineWidth = 2;
      context.stroke();
      const color = filter === "india-post" ? "#f59e0b" : filter === "dtdc" ? "#22c55e" : "#38bdf8";
      context.fillStyle = color;
      context.globalAlpha = 0.84;
      for (const record of filteredRecords) {
        if (record[3] === null || record[4] === null) continue;
        const x = ((record[4] - INDIA_BOUNDS.west) / (INDIA_BOUNDS.east - INDIA_BOUNDS.west)) * width;
        const y = (1 - (record[3] - INDIA_BOUNDS.south) / (INDIA_BOUNDS.north - INDIA_BOUNDS.south)) * height;
        if (x < -3 || x > width + 3 || y < -3 || y > height + 3) continue;
        context.beginPath();
        context.arc(x, y, width < 600 ? 1.7 : 2.15, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [filter, filteredRecords]);

  const directCount = records.filter((record) => record[2] && (state === "ALL INDIA" || record[0] === state)).length;
  const indiaPostCount = records.filter((record) => record[1] && (state === "ALL INDIA" || record[0] === state)).length;
  const mappedCount = filteredRecords.filter((record) => record[3] !== null && record[4] !== null).length;

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">State<select value={state} onChange={(event) => setState(event.target.value)} style={{ colorScheme: "light" }} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900 shadow-sm"><option className="bg-white text-slate-900" value="ALL INDIA">All India</option>{states.slice(1).map((item) => <option className="bg-white text-slate-900" key={item}>{item}</option>)}</select></label>
      <label className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Coverage on map<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} style={{ colorScheme: "light" }} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900 shadow-sm"><option className="bg-white text-slate-900" value="dtdc">DTDC direct service</option><option className="bg-white text-slate-900" value="india-post">India Post</option><option className="bg-white text-slate-900" value="all">All supplied pincodes</option></select></label>
      <div className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs text-ink-2"><div>{filteredRecords.length.toLocaleString()} pincodes shown</div><div className="mt-1 text-ink-3">{mappedCount.toLocaleString()} mapped - DTDC {directCount.toLocaleString()} - India Post {indiaPostCount.toLocaleString()}</div></div>
    </div>
    <div ref={frameRef} className="relative aspect-[1200/760] overflow-hidden rounded-2xl border border-border bg-[#dce5e9] shadow-inner">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Pincode coverage markers" />
      <div className="absolute bottom-3 right-3 flex gap-3 rounded-lg bg-slate-950/80 px-3 py-2 text-xs text-white shadow"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />DTDC direct</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />India Post</span></div>
    </div>
    <p className="text-xs text-ink-3">Markers are plotted from the official pincode coordinates in the supplied master. The India outline and coverage markers are drawn locally in one canvas for fast filtering.</p>
  </div>;
}
