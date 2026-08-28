"use client";

import { useState, useTransition } from "react";
import { capturePodAction, advanceOrderStatusAction } from "@/lib/actions/orders";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function PodPanel({ orderId }: { orderId: string }) {
  const [signedByName, setSignedByName] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [failing, startFailing] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDeliver() {
    if (!signedByName.trim()) {
      setError("Signee name is required");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("signedByName", signedByName.trim());
    fd.set("notes", notes.trim());
    startTransition(async () => {
      try {
        await capturePodAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not capture proof of delivery");
      }
    });
  }

  function handleFail() {
    setError(null);
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("status", "FAILED");
    fd.set("note", "Delivery attempt failed");
    startFailing(async () => {
      try {
        await advanceOrderStatusAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update status");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Signed by" htmlFor="signedByName" required>
        <Input id="signedByName" value={signedByName} onChange={(e) => setSignedByName(e.target.value)} placeholder="Recipient name" />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional delivery notes" />
      </Field>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button onClick={handleDeliver} loading={pending} className="w-full">
        Mark delivered
      </Button>
      <Button onClick={handleFail} loading={failing} variant="danger" className="w-full">
        Mark delivery failed
      </Button>
    </div>
  );
}
