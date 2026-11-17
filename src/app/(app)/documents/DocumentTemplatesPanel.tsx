"use client";

import { useState, useTransition } from "react";
import { saveDocumentTemplateAction } from "@/lib/actions/document-templates";
import { Button } from "@/components/ui/Button";

const starter = `<!doctype html><html><head><meta charset="utf-8"><title>{{DOCUMENT_TITLE}}</title><style>body{font-family:Arial;color:#172d28;margin:32px}h1{color:#bb582f}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8ded2;padding:8px;text-align:left}</style></head><body><h1>{{BRAND_NAME}}</h1><p>Document: {{DOCUMENT_TITLE}}</p><p>Customer: {{CUSTOMER_NAME}}</p><p>Courier: {{COURIER_NAME}}</p><p>Reference: {{REFERENCE_NUMBER}}</p><p>Valid/effective date: {{VALID_UNTIL}}</p><h2>Rates</h2>{{RATE_TABLE}}<h2>Terms</h2>{{TERMS}}<p>Authorised signatory: ____________________</p><p>Customer acceptance: ____________________</p></body></html>`;

type Template = { id: string; name: string; version: string; kind: "QUOTATION" | "AGREEMENT"; courierPartnerId: string | null; courierPartner: { name: string } | null; html: string; isActive: boolean };
export function DocumentTemplatesPanel({ templates, couriers }: { templates: Template[]; couriers: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<Template | null>(null);
  const [html, setHtml] = useState(starter);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  function submit(formData: FormData) { setError(null); setMessage(null); startTransition(async () => { const result = await saveDocumentTemplateAction(formData); if (result.ok) { setMessage("Template saved."); setEditing(null); } else setError(result.error ?? "Could not save template"); }); }
  return <div className="flex flex-col gap-5">
    <form action={submit} className="grid gap-3 rounded-control border border-border p-4 lg:grid-cols-2">
      <input type="hidden" name="id" value={editing?.id ?? ""} />
      <label className="text-sm">Name<input name="name" required defaultValue={editing?.name ?? "Master shipping document"} className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2" /></label>
      <label className="text-sm">Version<input name="version" required defaultValue={editing?.version ?? "1.0"} className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2" /></label>
      <label className="text-sm">Document type<select name="kind" defaultValue={editing?.kind ?? "QUOTATION"} className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3"><option value="QUOTATION">Quotation</option><option value="AGREEMENT">Agreement</option></select></label>
      <label className="text-sm">Assign courier<select name="courierPartnerId" defaultValue={editing?.courierPartnerId ?? ""} className="mt-1 h-10 w-full rounded-control border border-border bg-surface px-3"><option value="">Global fallback</option>{couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm lg:col-span-2">Import sample HTML<input type="file" accept=".html,text/html" className="mt-1 block text-sm" onChange={e => { const file = e.target.files?.[0]; if (file) file.text().then(setHtml); }} /></label>
      <label className="text-sm lg:col-span-2">HTML template<textarea name="html" required value={html} onChange={e => setHtml(e.target.value)} rows={18} className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 font-mono text-xs" /></label>
      <div className="flex gap-2"><Button type="submit" loading={pending}>{editing ? "Update template" : "Save template"}</Button>{editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setHtml(starter); }}>New template</Button>}</div>
      {error && <p className="text-sm text-danger">{error}</p>}{message && <p className="text-sm text-success">{message}</p>}
    </form>
    <div className="grid gap-3">{templates.map(t => <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border p-3 text-sm"><div><p className="font-medium text-ink">{t.name} / {t.version}</p><p className="text-ink-3">{t.kind} · {t.courierPartner?.name ?? "Global fallback"} · {t.isActive ? "Active" : "Inactive"}</p></div><Button type="button" size="sm" variant="secondary" onClick={() => { setEditing(t); setHtml(t.html); }}>Edit HTML</Button></div>)}</div>
  </div>;
}
