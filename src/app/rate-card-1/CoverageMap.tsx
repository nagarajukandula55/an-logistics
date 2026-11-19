"use client";

import { useEffect, useMemo, useRef, useState } from "react";
// Boundary geometry is bundled from vardhan-maps' generated India state data;
// it is rendered locally so the page never calls a map API.
import indiaStates from "./india-states.high";

const INDIA_BOUNDS = { west: 67, east: 99, south: 5, north: 38 };

type GeoFeature = {
  properties?: { name?: string };
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

const INDIA_STATE_FEATURES = (indiaStates as unknown as { features: GeoFeature[] }).features;

type CoverageRecord = [state: string, indiaPostAvailable: boolean, dtdcDirect: boolean, latitude: number | null, longitude: number | null];
type Filter = "all" | "dtdc" | "india-post";

export function CoverageMap({ records }: { records: CoverageRecord[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState("ALL INDIA");
  const [filter, setFilter] = useState<Filter>("dtdc");
  const [zoom, setZoom] = useState(1);

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
      const project = ([longitude, latitude]: number[]) => {
        const baseX = ((longitude - INDIA_BOUNDS.west) / (INDIA_BOUNDS.east - INDIA_BOUNDS.west)) * width;
        const baseY = (1 - (latitude - INDIA_BOUNDS.south) / (INDIA_BOUNDS.north - INDIA_BOUNDS.south)) * height;
        return [width / 2 + (baseX - width / 2) * zoom, height / 2 + (baseY - height / 2) * zoom] as const;
      };
      const drawRing = (ring: number[][]) => {
        ring.forEach((coordinate, index) => {
          const [x, y] = project(coordinate);
          if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
        context.closePath();
      };
      for (const feature of INDIA_STATE_FEATURES) {
        const geometry = feature.geometry;
        if (!geometry) continue;
        context.beginPath();
        if (geometry.type === "Polygon") {
          for (const ring of geometry.coordinates as number[][][]) drawRing(ring);
        } else {
          for (const polygon of geometry.coordinates as number[][][][]) {
            for (const ring of polygon) drawRing(ring);
          }
        }
        const selected = state !== "ALL INDIA" && feature.properties?.name?.toUpperCase() === state;
        context.fillStyle = selected ? "#b7d3dc" : "#cbd9dd";
        context.fill("evenodd");
        context.strokeStyle = selected ? "#1683a3" : "#647b84";
        context.lineWidth = selected ? 2.2 : 1;
        context.stroke();
      }
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
  }, [filter, filteredRecords, state, zoom]);

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
      <div className="absolute left-3 top-3 flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm" aria-label="Map zoom controls">
        <button type="button" onClick={() => setZoom((value) => Math.min(4, Number((value + 0.5).toFixed(1))))} className="h-9 w-9 border-r border-slate-200 text-lg font-semibold text-slate-800 hover:bg-slate-100" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.5).toFixed(1))))} className="h-9 w-9 border-r border-slate-200 text-lg font-semibold text-slate-800 hover:bg-slate-100" aria-label="Zoom out">−</button>
        <button type="button" onClick={() => setZoom(1)} className="px-3 text-xs font-medium text-slate-800 hover:bg-slate-100" aria-label="Reset map zoom">Reset</button>
      </div>
      <div className="absolute bottom-3 right-3 flex gap-3 rounded-lg bg-slate-950/80 px-3 py-2 text-xs text-white shadow"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />DTDC direct</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />India Post</span></div>
    </div>
    <p className="text-xs text-ink-3">Markers use the supplied official pincode coordinates. India state boundaries are bundled locally and rendered in one canvas, so the map does not call an external map API.</p>
  </div>;
}
