"use client";

import { useState, useTransition } from "react";
import { createOrUpdateAgreementAction } from "@/lib/actions/couriers";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge, enumLabel } from "@/components/ui/Badge";
import { format } from "date-fns";
import { Plus } from "lucide-react";

type Agreement = {
  id: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  commissionType: string;
  commissionValue: number;
  documentUrl: string | null;
  status: string;
  createdAt: Date;
};

const AGREEMENT_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  EXPIRED: "warning",
  TERMINATED: "danger",
};

export function AgreementPanel({ courierPartnerId, agreements }: { courierPartnerId: string; agreements: Agreement[] }) {
  const [showForm, setShowForm] = useState(agreements.length === 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("courierPartnerId", courierPartnerId);
    startTransition(async () => {
      try {
        await createOrUpdateAgreementAction(formData);
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save agreement");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {agreements.length > 0 && (
        <ul className="flex flex-col gap-3">
          {agreements.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-control border border-border px-3 py-2 text-sm">
              <div>
                <p className="text-ink">
                  {format(a.effectiveFrom, "MMM d, yyyy")} {a.effectiveTo ? `– ${format(a.effectiveTo, "MMM d, yyyy")}` : "– open"}
                </p>
                <p className="text-ink-3 tabular">
                  {a.commissionType === "PERCENT" ? `${a.commissionValue}%` : `₹${a.commissionValue.toFixed(2)} flat`}
                </p>
              </div>
              <Badge tone={AGREEMENT_STATUS_TONE[a.status] ?? "neutral"}>{enumLabel(a.status)}</Badge>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form action={handleSubmit} className="flex flex-col gap-3 rounded-control border border-border p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Effective from" htmlFor="effectiveFrom" required>
              <Input id="effectiveFrom" name="effectiveFrom" type="date" required />
            </Field>
            <Field label="Effective to" htmlFor="effectiveTo" hint="Optional">
              <Input id="effectiveTo" name="effectiveTo" type="date" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Commission type" htmlFor="commissionType">
              <Select id="commissionType" name="commissionType" defaultValue="PERCENT">
                <option value="PERCENT">Percent</option>
                <option value="FLAT">Flat amount</option>
              </Select>
            </Field>
            <Field label="Commission value" htmlFor="commissionValue" required>
              <Input id="commissionValue" name="commissionValue" type="number" step="0.01" min="0" required />
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue="DRAFT">
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="TERMINATED">Terminated</option>
              </Select>
            </Field>
          </div>
          <Field label="Document URL" htmlFor="documentUrl" hint="Optional link to the signed agreement">
            <Input id="documentUrl" name="documentUrl" type="url" />
          </Field>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={pending}>
              Save agreement
            </Button>
            {agreements.length > 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(true)} className="self-start">
          <Plus className="size-4" /> Add agreement
        </Button>
      )}
    </div>
  );
}
