"use client";

import { useState, useTransition } from "react";
import { createQuotationAction, sendQuotationAction } from "@/lib/actions/quotations";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

type Band = { zone: string; minWeightKg: string; maxWeightKg: string; price: string };
const emptyBand = (): Band => ({ zone: "LOCAL", minWeightKg: "0", maxWeightKg: "1", price: "" });

export function QuotationsPanel({ quotations, applications, couriers, templates, rateCards }: { quotations: { id: string; quoteNumber: string; title: string; status: string; sentAt: Date | null; validUntil: Date | null; customerName: string; recipientEmail: string | null; courierName: string }[]; applications: { id: string; name: string; company: string | null; email: string }[]; couriers: { id: string; name: string }[]; templates: { id: string; name: string; version: string; courierPartnerId: string | null }[]; rateCards: { id: string; name: string; courierPartnerId: string; slabs: { zone: string; minWeightKg: number; maxWeightKg: number; price: number }[] }[] }) {
  const [applicationId, setApplicationId] = useState("");
  const [courierPartnerId, setCourierPartnerId] = useState(couriers[0]?.id ?? "");
  const [bands, setBands] = useState<Band[]>([emptyBand()]);
  const [title, setTitle] = useState("Courier shipping quotation");
  const [validUntil, setValidUntil] = useState("");
  const [documentTemplateId, setDocumentTemplateId] = useState(templates.find(t => t.courierPartnerId === courierPartnerId)?.id ?? templates.find(t => !t.courierPartnerId)?.id ?? "");
  const [rateCardId, setRateCardId] = useState(rateCards.find(c => c.courierPartnerId === courierPartnerId)?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState("Rates are exclusive of applicable GST and statutory surcharges. Final serviceability and additional charges are governed by the signed agreement.");
  function applyCourierDefaults(nextCourierPartnerId: string) {
    const card = rateCards.find(c => c.courierPartnerId === nextCourierPartnerId);
    setRateCardId(card?.id ?? "");
    setBands(card?.slabs.map(s => ({ zone: s.zone, minWeightKg: String(s.minWeightKg), maxWeightKg: String(s.maxWeightKg), price: String(s.price) })) ?? [emptyBand()]);
    setDocumentTemplateId(templates.find(t => t.courierPartnerId === nextCourierPartnerId)?.id ?? templates.find(t => !t.courierPartnerId)?.id ?? "");
  }

  function create() {
    setError(null); setMessage(null);
    const fd = new FormData();
    fd.set("applicationId", applicationId); fd.set("courierPartnerId", courierPartnerId); fd.set("title", title); fd.set("terms", terms); fd.set("templateSource", "AN_LOGISTICS"); fd.set("documentTemplateId", documentTemplateId); fd.set("rateCardId", rateCardId); if (validUntil) fd.set("validUntil", validUntil);
    fd.set("ratesJson", JSON.stringify(bands.map(b => ({ zone: b.zone, minWeightKg: Number(b.minWeightKg), maxWeightKg: Number(b.maxWeightKg), price: Number(b.price) }))));
    startTransition(async () => { try { await createQuotationAction(fd); setMessage("Quotation draft created."); } catch (e) { setError(e instanceof Error ? e.message : "Could not create quotation"); } });
  }

  return <div className="flex flex-col gap-5">
    <div className="rounded-control border border-border p-4">
      <h3 className="font-semibold text-ink">Prepare quotation draft</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Applicant" htmlFor="quotation-application"><Select id="quotation-application" value={applicationId} onChange={e => setApplicationId(e.target.value)}><option value="">Select applicant</option>{applications.map(a => <option key={a.id} value={a.id}>{a.company || a.name} — {a.email}</option>)}</Select></Field>
        <Field label="Courier" htmlFor="quotation-courier"><Select id="quotation-courier" value={courierPartnerId} onChange={e => { setCourierPartnerId(e.target.value); applyCourierDefaults(e.target.value); }}>{couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Quotation title" htmlFor="quotation-title"><Input id="quotation-title" value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="HTML format" htmlFor="quotation-template"><Select id="quotation-template" value={documentTemplateId} onChange={e => setDocumentTemplateId(e.target.value)}><option value="">Built-in format</option>{templates.filter(t => !t.courierPartnerId || t.courierPartnerId === courierPartnerId).map(t => <option key={t.id} value={t.id}>{t.name} / {t.version}</option>)}</Select></Field>
        <Field label="Rate card" htmlFor="quotation-rate-card"><Select id="quotation-rate-card" value={rateCardId} onChange={e => { setRateCardId(e.target.value); const card = rateCards.find(c => c.id === e.target.value); if (card) setBands(card.slabs.map(s => ({ zone: s.zone, minWeightKg: String(s.minWeightKg), maxWeightKg: String(s.maxWeightKg), price: String(s.price) }))); }}><option value="">Manual rates</option>{rateCards.filter(c => c.courierPartnerId === courierPartnerId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Valid until" htmlFor="quotation-valid"><Input id="quotation-valid" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></Field>
      </div>
      <Field label="Commercial terms" htmlFor="quotation-terms"><textarea id="quotation-terms" value={terms} onChange={e => setTerms(e.target.value)} rows={4} className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" /></Field>
      <p className="mt-3 text-sm font-medium text-ink-2">Rate bands</p>
      <div className="mt-2 flex flex-col gap-2">{bands.map((b, i) => <div key={i} className="grid grid-cols-4 gap-2"><Input aria-label="Zone" value={b.zone} onChange={e => setBands(prev => prev.map((x, j) => j === i ? { ...x, zone: e.target.value } : x))} /><Input aria-label="From kg" type="number" value={b.minWeightKg} onChange={e => setBands(prev => prev.map((x, j) => j === i ? { ...x, minWeightKg: e.target.value } : x))} /><Input aria-label="To kg" type="number" value={b.maxWeightKg} onChange={e => setBands(prev => prev.map((x, j) => j === i ? { ...x, maxWeightKg: e.target.value } : x))} /><Input aria-label="Price" type="number" value={b.price} onChange={e => setBands(prev => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} /></div>)}</div>
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => setBands(prev => [...prev, emptyBand()])}>Add band</Button><Button type="button" loading={pending} disabled={!applicationId || !courierPartnerId} onClick={create}>Create draft</Button></div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}{message && <p className="mt-2 text-sm text-success">{message}</p>}
    </div>
    <ul className="flex flex-col gap-3">{quotations.map(q => <li key={q.id} className="rounded-control border border-border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-ink">{q.quoteNumber} — {q.customerName}</p><p className="text-ink-3">{q.courierName} · {q.status} · {q.recipientEmail || "No email"}</p></div><div className="flex gap-2"><a className="rounded-control border border-border px-3 py-2 text-accent" href={`/api/quotations/${q.id}`} target="_blank" rel="noreferrer">Preview</a>{q.status === "DRAFT" && <SendButton id={q.id} />}</div></div></li>)}</ul>
  </div>;
}

function SendButton({ id }: { id: string }) { const [pending, startTransition] = useTransition(); const [error, setError] = useState<string | null>(null); return <span className="flex items-center gap-2"><Button type="button" size="sm" loading={pending} onClick={() => startTransition(async () => { try { await sendQuotationAction(id); } catch (e) { setError(e instanceof Error ? e.message : "Could not send"); } })}>Send quotation</Button>{error && <span className="text-xs text-danger">{error}</span>}</span>; }
