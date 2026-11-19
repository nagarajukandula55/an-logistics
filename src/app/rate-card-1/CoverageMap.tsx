"use client";
/* ArcGIS is loaded from its official browser SDK at runtime. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

const PINCODE_BOUNDARY_URL = "https://livingatlas.esri.in/server1/rest/services/India/Pincode_Boundary_2025/MapServer/0";
const LOGO_URL = "/an-group-logistics.png";

type CoverageRecord = { pincode: string; state: string; indiaPostAvailable: boolean; pickupStatus: string };
type Filter = "all" | "dtdc" | "india-post";
type ArcgisModule = (...args: any[]) => void;

declare global {
  interface Window { require?: ArcgisModule; __anArcgisPromise?: Promise<any> }
}

function loadArcgis() {
  if (typeof window === "undefined") return Promise.reject(new Error("Map requires a browser"));
  if (window.__anArcgisPromise) return window.__anArcgisPromise;
  window.__anArcgisPromise = new Promise((resolve, reject) => {
    const start = () => {
      if (!window.require) return reject(new Error("ArcGIS JavaScript API did not load"));
      window.require(["esri/Map", "esri/views/MapView", "esri/layers/FeatureLayer", "esri/layers/GraphicsLayer", "esri/Graphic"], (...modules: any[]) => { const [Map, MapView, FeatureLayer, GraphicsLayer, Graphic] = modules; resolve({ Map, MapView, FeatureLayer, GraphicsLayer, Graphic }); });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-an-arcgis="true"]');
    if (existing) { const loadedRequire = (window as Window & { require?: ArcgisModule }).require; if (loadedRequire) start(); else existing.addEventListener("load", start, { once: true }); return; }
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://js.arcgis.com/4.31/esri/themes/dark/main.css"; document.head.appendChild(link);
    const script = document.createElement("script"); script.src = "https://js.arcgis.com/4.31/"; script.async = true; script.dataset.anArcgis = "true"; script.addEventListener("load", start, { once: true }); script.addEventListener("error", () => reject(new Error("Unable to load the official map service")), { once: true }); document.head.appendChild(script);
  });
  return window.__anArcgisPromise;
}

function chunks<T>(items: T[], size: number) { const result: T[][] = []; for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size)); return result; }
function escapeSql(value: string) { return value.replace(/'/g, "''"); }

export function CoverageMap({ records }: { records: CoverageRecord[] }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const boundaryRef = useRef<any>(null);
  const highlightRef = useRef<any>(null);
  const [state, setState] = useState("ALL INDIA");
  const [filter, setFilter] = useState<Filter>("dtdc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const states = useMemo(() => ["ALL INDIA", ...Array.from(new Set(records.map((record) => record.state))).sort()], [records]);
  const filteredRecords = useMemo(() => records.filter((record) => {
    if (state !== "ALL INDIA" && record.state !== state) return false;
    if (filter === "india-post") return record.indiaPostAvailable;
    if (filter === "dtdc") return record.pickupStatus.trim().toUpperCase() === "NORMAL PICK UP SERVICE AVAILABLE";
    return true;
  }), [filter, records, state]);

  useEffect(() => {
    let cancelled = false;
    loadArcgis().then(({ Map, MapView, FeatureLayer, GraphicsLayer, Graphic }) => {
      if (cancelled || !mapNode.current || viewRef.current) return;
      const map = new Map({ basemap: "dark-gray-vector" });
      const boundaries = new FeatureLayer({
        url: PINCODE_BOUNDARY_URL,
        title: "Official India PIN-code boundaries",
        opacity: 0.58,
        outFields: ["pin_code", "fname", "state"],
        renderer: { type: "simple", symbol: { type: "simple-fill", color: [16, 34, 45, 0.68], outline: { color: [92, 124, 139, 0.78], width: 0.45 } } },
        popupTemplate: { title: "PIN code {pin_code}", content: "{fname}<br>{state}" },
      });
      const highlights = new GraphicsLayer({ title: "Selected service coverage" });
      map.addMany([boundaries, highlights]);
      const view = new MapView({ container: mapNode.current, map, center: [78.96, 22.59], zoom: 4.25, constraints: { minZoom: 4, maxZoom: 12 }, popup: { dockEnabled: true, dockOptions: { position: "bottom-right", buttonEnabled: false } } });
      view.graphics.add(new Graphic({ geometry: { type: "point", longitude: 83.4, latitude: 18.1 }, symbol: { type: "picture-marker", url: LOGO_URL, width: "34px", height: "34px", yoffset: 17 }, popupTemplate: { title: "AN Logistics", content: "Coverage operations base" } }));
      viewRef.current = view; boundaryRef.current = boundaries; highlightRef.current = highlights; setLoading(false);
    }).catch((reason) => { if (!cancelled) { setLoading(false); setError(reason instanceof Error ? reason.message : "Map unavailable"); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const boundaryLayer = boundaryRef.current;
    const highlights = highlightRef.current;
    if (!boundaryLayer || !highlights) return;
    let cancelled = false;
    highlights.removeAll();
    boundaryLayer.definitionExpression = state === "ALL INDIA" ? "1=1" : `state = '${escapeSql(state)}'`;
    setError(null);
    setLoading(true);
    loadArcgis().then(({ Graphic }) => Promise.all(chunks(filteredRecords.map((record) => record.pincode), 80).map(async (pincodes) => {
      const where = `pin_code IN (${pincodes.map((pincode) => `'${escapeSql(pincode)}'`).join(",")})`;
      const result = await boundaryLayer.queryFeatures({ where, outFields: ["pin_code", "fname", "state"], returnGeometry: true });
      if (cancelled) return;
      for (const feature of result.features) highlights.add(new Graphic({ geometry: feature.geometry, attributes: feature.attributes, symbol: { type: "simple-fill", color: filter === "india-post" ? [245, 158, 11, 0.7] : [34, 197, 94, 0.62], outline: { color: [255, 255, 255, 0.85], width: 0.7 } }, popupTemplate: { title: "PIN code {pin_code}", content: "{fname}<br>{state}" } }));
    }))).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Coverage could not be loaded"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, filteredRecords, state]);

  const directCount = records.filter((record) => record.pickupStatus.trim().toUpperCase() === "NORMAL PICK UP SERVICE AVAILABLE" && (state === "ALL INDIA" || record.state === state)).length;
  const indiaPostCount = records.filter((record) => record.indiaPostAvailable && (state === "ALL INDIA" || record.state === state)).length;

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">State<select value={state} onChange={(event) => setState(event.target.value)} className="mt-2 block w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"><option value="ALL INDIA">All India</option>{states.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Coverage on map<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="mt-2 block w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"><option value="dtdc">DTDC direct service</option><option value="india-post">India Post</option><option value="all">All supplied pincodes</option></select></label>
      <div className="rounded-xl border border-border bg-canvas px-3 py-2 text-xs text-ink-2"><div>{filteredRecords.length.toLocaleString()} shown</div><div className="mt-1 text-ink-3">DTDC {directCount.toLocaleString()} · India Post {indiaPostCount.toLocaleString()}</div></div>
    </div>
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[#0b151c]"><div ref={mapNode} className="h-[560px] w-full" aria-label="Official India pincode coverage map" />{loading && <div className="absolute left-3 top-3 rounded-lg bg-black/70 px-3 py-2 text-xs text-white">Loading official map coverage…</div>}{error && <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-amber-400/40 bg-black/80 px-3 py-2 text-xs text-amber-200">{error}. The state counts remain available, but the official boundary service could not be displayed.</div>}<div className="absolute bottom-3 right-3 flex gap-3 rounded-lg bg-black/75 px-3 py-2 text-xs text-white"><span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-400" />DTDC direct</span><span><i className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-400" />India Post</span></div><div className="absolute left-3 bottom-3 rounded-lg bg-white p-1 shadow-lg"><Image src={LOGO_URL} alt="AN Logistics" width={36} height={36} className="h-9 w-9 object-contain" /></div></div>
    <p className="text-xs text-ink-3">The base map and PIN-code boundaries come from the official India PIN-code boundary service. “DTDC direct” means the supplied master marks “Normal Pick Up Service Available”.</p>
  </div>;
}
