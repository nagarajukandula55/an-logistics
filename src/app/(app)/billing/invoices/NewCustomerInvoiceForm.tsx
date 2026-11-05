"use client";
import { useActionState } from "react";
import { generateCustomerInvoiceAction, type ActionState } from "@/lib/actions/billing";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const initialState: ActionState = { ok: false };
export function NewCustomerInvoiceForm({ customers }: { customers: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(generateCustomerInvoiceAction, initialState);
  return <Card className="h-fit"><CardHeader><h2 className="h-section">Customer price invoice</h2></CardHeader><CardBody><p className="text-xs text-ink-2 mb-3">For clients and resellers. Reseller margin is included in the customer price invoice; wallet settlement remains at the agreed platform price.</p><form action={formAction} className="flex flex-col gap-3"><Field label="Account" htmlFor="customerId" required><Select id="customerId" name="customerId" required defaultValue=""><option value="" disabled>Select an account</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Field label="Period start" htmlFor="customerPeriodStart" required><Input id="customerPeriodStart" name="periodStart" type="date" required /></Field><Field label="Period end" htmlFor="customerPeriodEnd" required><Input id="customerPeriodEnd" name="periodEnd" type="date" required /></Field>{state.error && <p className="text-xs text-danger">{state.error}</p>}{state.ok && <p className="text-xs text-success">Customer price invoice generated.</p>}<Button type="submit" loading={pending} className="w-full mt-1">Generate customer invoice</Button></form></CardBody></Card>;
}
