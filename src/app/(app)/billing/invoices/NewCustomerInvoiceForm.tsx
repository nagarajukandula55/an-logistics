"use client";
import { useActionState, useState } from "react";
import { generateCustomerInvoiceAction, type ActionState } from "@/lib/actions/billing";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const initialState: ActionState = { ok: false };
type OrderOption = { id: string; customerId: string; trackingCode: string; createdAt: Date; chargedAmount: number | null };

export function NewCustomerInvoiceForm({ customers, orders }: { customers: { id: string; name: string }[]; orders: OrderOption[] }) {
  const [state, formAction, pending] = useActionState(generateCustomerInvoiceAction, initialState);
  const [mode, setMode] = useState("MONTHLY");
  const [customerId, setCustomerId] = useState("");
  const customerOrders = orders.filter(order => order.customerId === customerId);
  return <Card className="h-fit"><CardHeader><h2 className="h-section">AN Logistics B2B invoice</h2></CardHeader><CardBody><p className="text-xs text-ink-2 mb-3">Generate a customer invoice per shipment, fortnightly, or monthly. The invoice is issued by AN Logistics, a unit of AN Group.</p><form action={formAction} className="flex flex-col gap-3"><Field label="Account" htmlFor="customerId" required><Select id="customerId" name="customerId" required value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="" disabled>Select an account</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Field label="Billing mode" htmlFor="billingMode" required><Select id="billingMode" name="billingMode" value={mode} onChange={e => setMode(e.target.value)}><option value="PER_SHIPMENT">Individual shipment invoice</option><option value="FORTNIGHTLY">Fortnightly billing</option><option value="MONTHLY">Monthly billing</option></Select></Field>{mode === "PER_SHIPMENT" ? <Field label="Delivered shipment" htmlFor="orderId" required><Select id="orderId" name="orderId" required defaultValue=""><option value="" disabled>Select a delivered shipment</option>{customerOrders.map(order => <option key={order.id} value={order.id}>{order.trackingCode} · ₹{(order.chargedAmount ?? 0).toFixed(2)} · {order.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</option>)}</Select></Field> : <><Field label="Period start" htmlFor="customerPeriodStart" required><Input id="customerPeriodStart" name="periodStart" type="date" required /></Field><Field label="Period end" htmlFor="customerPeriodEnd" required><Input id="customerPeriodEnd" name="periodEnd" type="date" required /></Field></>}{state.error && <p className="text-xs text-danger">{state.error}</p>}{state.ok && <p className="text-xs text-success">B2B invoice generated successfully.</p>}<Button type="submit" loading={pending} className="w-full mt-1">Generate invoice</Button></form></CardBody></Card>;
}
