"use client";
import { useActionState, useState } from "react";
import { activatePartnerAction, createTemplateAction, prepareAgreementAction, reviewApplicationAction, type OnboardingState } from "@/lib/actions/onboarding";
import { starterTerms } from "@/lib/agreement-starter";
import { Button } from "@/components/ui/Button";
const input = "w-full rounded-lg border border-border bg-surface p-2 text-sm";
function Result({ state }: {
    state: OnboardingState;
}) { return <p role={state.error ? "alert" : "status"} className={state.error ? "text-danger text-sm" : "text-success text-sm break-words"}>{state.error || state.message}</p>; }
export function ReviewForm({ id, notes, status }: {
    id: string;
    notes: string;
    status: string;
}) {
    const [s, a, p] = useActionState(reviewApplicationAction, { ok: false });
    return <form action={a} className="space-y-3"><input type="hidden" name="id" value={id}/><label className="block text-sm">Stage<select name="status" defaultValue={status === "NEW" ? "CONTACTED" : status} className={input}>{["CONTACTED", "NEGOTIATING", "AGREEMENT", "REJECTED"].map(v => <option key={v}>{v}</option>)}</select></label><label className="block text-sm">Contact history and internal notes<textarea name="notes" defaultValue={notes} className={input} rows={3}/></label><Button loading={p}>Save review</Button><Result state={s}/></form>;
}
export function ActivateForm({ id, couriers }: {
    id: string;
    couriers: {
        id: string;
        name: string;
    }[];
}) {
    const [s, a, p] = useActionState(activatePartnerAction, { ok: false });
    return <form action={a} className="space-y-3"><input type="hidden" name="id" value={id}/><p className="font-medium">Allocate couriers & activate</p><p className="text-sm text-ink-2">Requires a signed agreement. Login uses the applicant’s email.</p>{couriers.map(c => <label key={c.id} className="flex gap-2 text-sm"><input name="courierIds" type="checkbox" value={c.id}/>{c.name}</label>)}<Button loading={p} disabled={!couriers.length}>Create login after signing</Button><Result state={s}/></form>;
}
export function TemplateForm() { const [s, a, p] = useActionState(createTemplateAction, { ok: false }); return <form action={a} className="space-y-3"><h2 className="h-section">Agreement template library</h2><p className="text-sm text-ink-2">Create a new version for each change. Starter clauses require Indian legal review and completed commercial particulars.</p><label className="block text-sm">Template name<input name="name" required className={input} placeholder="Business shipping agreement"/></label><label className="block text-sm">Category<input name="category" required className={input} placeholder="B2B, individual, reseller, courier, NDA, addendum…"/></label><label className="block text-sm">Version<input name="version" required className={input} placeholder="1.0"/></label><label className="block text-sm">Editable clauses<textarea name="terms" defaultValue={starterTerms} rows={14} className={input}/></label><Button loading={p}>Save template version</Button><Result state={s}/></form>; }
export function PrepareForm({ applications, templates }: {
    applications: {
        id: string;
        name: string;
    }[];
    templates: {
        id: string;
        name: string;
        version: string;
        terms: string;
    }[];
}) {
    const [s, a, p] = useActionState(prepareAgreementAction, { ok: false });
    const [selected, setSelected] = useState(templates[0]?.id || "");
    const [terms, setTerms] = useState(templates[0]?.terms || "");
    const [slabs, setSlabs] = useState([{ zone: "LOCAL", minWeightKg: 0, maxWeightKg: 1, price: 0 }]);
    return <form action={a} className="space-y-3"><h2 className="h-section">Prepare a partner agreement</h2><label className="block text-sm">Reviewed applicant<select name="applicationId" required className={input}><option value="">Select applicant</option>{applications.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label className="block text-sm">Template version<select name="templateId" value={selected} required className={input} onChange={e => { setSelected(e.target.value); setTerms(templates.find(t => t.id === e.target.value)?.terms || ""); }}><option value="">Select template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name} / {t.version}</option>)}</select></label><label className="block text-sm">Agreement title<input name="title" required className={input}/></label><label className="block text-sm">Partner-specific terms<textarea name="terms" value={terms} onChange={e => setTerms(e.target.value)} rows={12} className={input}/></label><label className="block text-sm">Rate effective date<input name="effectiveFrom" type="date" required className={input}/></label><p className="text-sm font-medium">Rate card · INR per shipment in each weight band</p><p className="text-xs text-ink-2">Record taxes and extra charges in the terms. Automated pricing currently uses these flat weight bands only.</p>{slabs.map((row, i) => <div key={i} className="grid grid-cols-4 gap-2">{Object.keys(row).map(key => <label key={key} className="text-xs">{({ zone: "Zone", minWeightKg: "From kg", maxWeightKg: "To kg", price: "INR" })[key]}{key === "zone" ? <select aria-label="Zone" className={input} value={row.zone} onChange={e => setSlabs(slabs.map((s, j) => i === j ? { ...s, zone: e.target.value } : s))}>{["LOCAL", "REGIONAL", "NATIONAL"].map(z => <option key={z}>{z}</option>)}</select> : <input className={input} type="number" step="0.01" min="0" required value={row[key as keyof typeof row]} onChange={e => setSlabs(slabs.map((s, j) => i === j ? { ...s, [key]: Number(e.target.value) } : s))}/>}</label>)}</div>)}<input type="hidden" name="slabsJson" value={JSON.stringify(slabs)}/><div className="flex gap-3"><Button type="button" variant="secondary" onClick={() => setSlabs([...slabs, { zone: "NATIONAL", minWeightKg: 0, maxWeightKg: 1, price: 0 }])}>Add band</Button>{slabs.length > 1 && <Button type="button" variant="secondary" onClick={() => setSlabs(slabs.slice(0, -1))}>Remove last</Button>}</div><label className="flex gap-2 text-sm"><input type="checkbox" name="legalReviewed" required/>I confirm legal review, completed particulars, applicable stamp duty and the agreed commercial schedule.</label><Button loading={p} disabled={!templates.length || !applications.length}>Create agreement draft</Button><Result state={s}/></form>;
}
