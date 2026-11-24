"use client";

import { useState, useTransition } from "react";
import { completeManualCourierBookingAction } from "@/lib/actions/orders";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function ManualBookingPanel({ orderId, currentState }: { orderId: string; currentState: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (currentState === "CONFIRMED" && !error) return null;

  function submit(formData: FormData) {
    setError(null);
    setMessage(null);
    formData.set("orderId", orderId);
    startTransition(async () => {
      try {
        await completeManualCourierBookingAction(formData);
        setMessage("Manual booking recorded. The partner can now open or print the document from the portal.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not record manual booking");
      }
    });
  }

  return (
    <div className="rounded-control border border-border bg-surface-2 p-3">
      <p className="text-sm font-medium text-ink">Complete manual courier booking</p>
      <p className="mt-1 text-xs text-ink-2">Use this until the courier API is available. Paste the docket number and a secure print-document URL.</p>
      <form action={submit} className="mt-3 flex flex-col gap-3">
        <Field label="Courier docket / booking number" htmlFor="manual-provider-ref" required>
          <Input id="manual-provider-ref" name="providerRef" required />
        </Field>
        <Field label="Document URL" htmlFor="manual-label-url" hint="Optional PDF or label link visible to the partner">
          <Input id="manual-label-url" name="labelUrl" type="url" placeholder="https://..." />
        </Field>
        <Field label="Operations note" htmlFor="manual-booking-note">
          <Input id="manual-booking-note" name="note" placeholder="Booked through DTDC branch" />
        </Field>
        {error && <p className="text-xs text-danger">{error}</p>}
        {message && <p className="text-xs text-success">{message}</p>}
        <Button type="submit" loading={pending}>Save booking and notify</Button>
      </form>
    </div>
  );
}
