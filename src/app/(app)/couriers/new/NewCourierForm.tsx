"use client";

import { useActionState } from "react";
import { createCourierPartnerAction, type ActionState } from "@/lib/actions/couriers";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

const initialState: ActionState = { ok: false };

export function NewCourierForm() {
  const [state, formAction, pending] = useActionState(createCourierPartnerAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="h-section">Courier details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Courier name" htmlFor="name" required>
              <Input id="name" name="name" placeholder="e.g. Swift Express" required />
            </Field>
            <Field label="Legal name" htmlFor="legalName" hint="Optional">
              <Input id="legalName" name="legalName" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact name" htmlFor="contactName" required>
              <Input id="contactName" name="contactName" required />
            </Field>
            <Field label="Contact phone" htmlFor="contactPhone" required>
              <Input id="contactPhone" name="contactPhone" required />
            </Field>
          </div>
          <Field label="Contact email" htmlFor="contactEmail" hint="Optional">
            <Input id="contactEmail" name="contactEmail" type="email" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="h-section">Commercial terms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Integration type" htmlFor="integrationType">
              <Select id="integrationType" name="integrationType" defaultValue="MANUAL">
                <option value="MANUAL">Manual (phone / WhatsApp)</option>
                <option value="API">API</option>
              </Select>
            </Field>
            <Field label="Commission type" htmlFor="commissionType">
              <Select id="commissionType" name="commissionType" defaultValue="PERCENT">
                <option value="PERCENT">Percent</option>
                <option value="FLAT">Flat amount</option>
              </Select>
            </Field>
            <Field label="Commission value" htmlFor="commissionValue" required>
              <Input id="commissionValue" name="commissionValue" type="number" step="0.01" min="0" required />
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes" hint="Optional">
            <Textarea id="notes" name="notes" placeholder="Agreement notes, service coverage, etc." />
          </Field>
        </CardBody>
      </Card>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div>
        <Button type="submit" loading={pending}>
          Onboard courier
        </Button>
      </div>
    </form>
  );
}
