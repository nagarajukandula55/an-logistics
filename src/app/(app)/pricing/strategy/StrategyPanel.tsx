"use client";

import { useTransition, useState } from "react";
import { createRateStrategyAction } from "@/lib/actions/rate-strategies";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

export function StrategyPanel({ couriers }: { couriers: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function submit(formData: FormData) {
    setError(null); setMessage(null);
    startTransition(async () => { try { await createRateStrategyAction(formData); setMessage("Strategy saved."); } catch (e) { setError(e instanceof Error ? e.message : "Could not save strategy"); } });
  }
  return <form action={submit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <Field label="Courier" htmlFor="strategy-courier"><Select id="strategy-courier" name="courierPartnerId" required><option value="">Select courier</option>{couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
    <Field label="Audience" htmlFor="strategy-audience"><Select id="strategy-audience" name="audience"><option value="DEFAULT">Default</option><option value="CLIENT">Client</option><option value="STAFF">Staff</option><option value="COLLABORATOR">Collaborator</option></Select></Field>
    <Field label="Strategy name" htmlFor="strategy-name"><Input id="strategy-name" name="name" placeholder="Low-volume NEL0 protection" required /></Field>
    <Field label="Effective from" htmlFor="strategy-date"><Input id="strategy-date" name="effectiveFrom" type="date" required /></Field>
    <Field label="Minimum monthly volume" htmlFor="strategy-min"><Input id="strategy-min" name="volumeMinMonthly" type="number" min="0" placeholder="0" /></Field>
    <Field label="Maximum monthly volume" htmlFor="strategy-max"><Input id="strategy-max" name="volumeMaxMonthly" type="number" min="0" placeholder="5000" /></Field>
    <Field label="Markup %" htmlFor="strategy-markup" hint="100% = 2x cost"><Input id="strategy-markup" name="markupPercent" type="number" min="0" step="0.1" defaultValue="100" required /></Field>
    <Field label="Minimum margin %" htmlFor="strategy-margin"><Input id="strategy-margin" name="minimumMarginPercent" type="number" min="0" max="99" step="0.1" defaultValue="50" /></Field>
    <Field label="Handling fee" htmlFor="strategy-fee"><Input id="strategy-fee" name="handlingFee" type="number" min="0" step="0.01" defaultValue="0" required /></Field>
    <Field label="Rounding unit" htmlFor="strategy-rounding"><Input id="strategy-rounding" name="roundingUnit" type="number" min="0.01" step="0.01" defaultValue="1" required /></Field>
    <div className="md:col-span-2 lg:col-span-4"><Field label="Notes" htmlFor="strategy-notes"><Input id="strategy-notes" name="notes" placeholder="Use NEL0 cost matrix for low-volume partners" /></Field></div>
    <div className="md:col-span-2 lg:col-span-4 flex items-center gap-3"><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save strategy"}</Button>{message && <span className="text-sm text-emerald-700">{message}</span>}{error && <span className="text-sm text-red-700">{error}</span>}</div>
  </form>;
}
