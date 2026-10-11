"use client";

import { useRef, useState, useTransition } from "react";
import { createAgreementAction } from "@/lib/actions/agreements";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  sellRateCards: { id: string; name: string }[];
};

export function NewAgreementForm({ customers }: { customers: Customer[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [customerId, setCustomerId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await createAgreementAction({ ok: false }, formData);
      if (result.ok) {
        formRef.current?.reset();
        setCustomerId("");
        setSuccess(true);
      } else {
        setError(result.error ?? "Could not create agreement");
      }
    });
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <Card className="h-fit">
      <CardHeader>
        <h2 className="h-section">New agreement</h2>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <Field label="Customer" htmlFor="customerId" required>
            <Select
              id="customerId"
              name="customerId"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kind" htmlFor="kind" required>
            <Select id="kind" name="kind" defaultValue="B2C" required>
              <option value="B2B">B2B — business customer</option>
              <option value="B2C">B2C — individual customer</option>
            </Select>
          </Field>
          <Field label="Template version" htmlFor="templateVersion" required hint="e.g. v1, 2026-standard">
            <Input id="templateVersion" name="templateVersion" required />
          </Field>
          <Field label="Document URL" htmlFor="documentUrl" required hint="Filled agreement PDF, fetchable by the server">
            <Input id="documentUrl" name="documentUrl" type="url" required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Signer name" htmlFor="signerName" hint="Defaults to customer name">
              <Input id="signerName" name="signerName" defaultValue={selectedCustomer?.name ?? ""} />
            </Field>
            <Field label="Signer email" htmlFor="signerEmail" hint="Defaults to customer email">
              <Input id="signerEmail" name="signerEmail" type="email" defaultValue={selectedCustomer?.email ?? ""} />
            </Field>
          </div>
          <Field label="Sell rate card" htmlFor="sellRateCardId" hint="Activated for this customer once signed">
            <Select id="sellRateCardId" name="sellRateCardId" defaultValue="">
              <option value="">None</option>
              {selectedCustomer?.sellRateCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Renewal date" htmlFor="renewalDate" hint="Optional — drives the renewal reminder">
            <Input id="renewalDate" name="renewalDate" type="date" />
          </Field>
          {error && <p className="text-xs text-danger">{error}</p>}
          {success && <p className="text-xs text-success">Agreement created.</p>}
          <Button type="submit" loading={pending} className="w-full mt-1">
            Create agreement
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
