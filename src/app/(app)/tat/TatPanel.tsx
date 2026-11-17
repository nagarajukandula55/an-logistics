"use client";

import { useState, useTransition } from "react";
import { lookupTatAction, uploadTatWorkbookAction } from "@/lib/actions/tat";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

export function TatLookup() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ found: boolean; tatDays?: number; originCity?: string | null; destinationCity?: string | null; serviceCode?: string | null; matrixName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return <Card><CardHeader><h2 className="h-section">Check delivery TAT</h2><p className="text-sm text-ink-2">Enter the shipment route to plan dispatch and customer commitments.</p></CardHeader><CardBody><form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); setError(null); const form = new FormData(event.currentTarget); startTransition(async () => { try { setResult(await lookupTatAction(form)); } catch (e) { setError(e instanceof Error ? e.message : "Could not check TAT"); } }); }}><Field label="Origin pincode" htmlFor="tat-origin"><Input id="tat-origin" name="originPincode" inputMode="numeric" maxLength={6} placeholder="Optional" /></Field><Field label="Destination pincode" htmlFor="tat-destination"><Input id="tat-destination" name="destinationPincode" inputMode="numeric" maxLength={6} required /></Field><Field label="Service" htmlFor="tat-service"><Input id="tat-service" name="serviceCode" placeholder="Optional: 7V / 7D" /></Field><div className="sm:col-span-3"><Button type="submit" loading={pending}>{pending ? "Checking..." : "Check TAT"}</Button></div></form>{error && <p className="mt-3 text-sm text-danger">{error}</p>}{result?.found && <div className="mt-5 rounded-card border border-success/30 bg-success-soft p-4"><p className="text-sm text-ink-2">Indicative delivery time</p><p className="mt-1 text-2xl font-semibold text-ink">{result.tatDays} working day{result.tatDays === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-ink-3">{result.originCity || "Origin"} → {result.destinationCity || "Destination"}{result.serviceCode ? ` · ${result.serviceCode}` : ""} · {result.matrixName}</p></div>}{result && !result.found && <p className="mt-4 text-sm text-ink-2">No TAT was found for this route. Contact our team for confirmation.</p>}</CardBody></Card>;
}

export function TatUpload() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return <Card><CardHeader><h2 className="h-section">Upload pincode TAT workbook</h2><p className="text-sm text-ink-2">Use columns such as Destination Pincode, Origin Pincode, TAT Days, Origin City, Destination City and Service Code.</p></CardHeader><CardBody><form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); setMessage(null); setError(null); const form = new FormData(event.currentTarget); startTransition(async () => { try { const result = await uploadTatWorkbookAction(form); setMessage(`${result.count} TAT rows imported.`); } catch (e) { setError(e instanceof Error ? e.message : "Could not import workbook"); } }); }}><Field label="Schedule name" htmlFor="tat-name"><Input id="tat-name" name="name" required placeholder="Domestic TAT - November 2026" /></Field><Field label="Effective from" htmlFor="tat-effective"><Input id="tat-effective" name="effectiveFrom" type="date" required /></Field><Field label="Excel workbook" htmlFor="tat-file"><Input id="tat-file" name="file" type="file" accept=".xlsx" required /></Field><div className="sm:col-span-3"><Button type="submit" loading={pending}>{pending ? "Importing..." : "Import TAT workbook"}</Button></div></form>{message && <p className="mt-3 text-sm text-success">{message}</p>}{error && <p className="mt-3 text-sm text-danger">{error}</p>}</CardBody></Card>;
}
