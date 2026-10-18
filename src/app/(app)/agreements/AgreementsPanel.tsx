"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  sendAgreementForSignatureAction,
  voidAgreementAction,
  updateAgreementAction,
} from "@/lib/actions/agreements";
import { Button } from "@/components/ui/Button";
import { Badge, enumLabel } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { FileText, Send, Ban, Pencil } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  sellRateCards: { id: string; name: string }[];
};

type Agreement = {
  id: string;
  kind: string;
  status: string;
  templateVersion: string;
  documentUrl: string | null;
  externalEnvelopeId: string | null;
  signerName: string | null;
  signerEmail: string | null;
  sentAt: Date | null;
  signedAt: Date | null;
  renewalDate: Date | null;
  renewalDaysLeft: number | null;
  createdAt: Date;
  customer: { id: string; name: string; email: string | null };
  sellRateCard: { id: string; name: string } | null;
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  SENDING: "warning",
  SENT: "warning",
  SIGNED: "success",
  VOID: "danger",
};

function RenewalBadge({ renewalDate, renewalDaysLeft }: { renewalDate: Date | null; renewalDaysLeft: number | null }) {
  if (!renewalDate || renewalDaysLeft === null) return null;
  const tone = renewalDaysLeft < 0 ? "danger" : renewalDaysLeft <= 30 ? "warning" : "neutral";
  return (
    <Badge tone={tone}>
      {renewalDaysLeft < 0 ? "Renewal overdue" : `Renews ${format(renewalDate, "MMM d, yyyy")}`}
    </Badge>
  );
}

const editInitialState = { ok: false, error: undefined as string | undefined };

function EditAgreementForm({
  agreement,
  customer,
  onDone,
}: {
  agreement: Agreement;
  customer: Customer | undefined;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateAgreementAction, editInitialState);

  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-control border border-border p-3">
      <input type="hidden" name="agreementId" value={agreement.id} />
      <Field label="Kind" htmlFor={`kind-${agreement.id}`} required>
        <Select id={`kind-${agreement.id}`} name="kind" defaultValue={agreement.kind} required>
          <option value="B2B">B2B — business customer</option>
          <option value="B2C">B2C — individual customer</option>
        </Select>
      </Field>
      <Field label="Template version" htmlFor={`templateVersion-${agreement.id}`} required>
        <Input id={`templateVersion-${agreement.id}`} name="templateVersion" required defaultValue={agreement.templateVersion} placeholder="e.g. v1, 2026-standard" />
      </Field>
      <Field label="Document URL" htmlFor={`documentUrl-${agreement.id}`} required>
        <Input id={`documentUrl-${agreement.id}`} name="documentUrl" type="url" required defaultValue={agreement.documentUrl ?? ""} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Signer name" htmlFor={`signerName-${agreement.id}`}>
          <Input id={`signerName-${agreement.id}`} name="signerName" defaultValue={agreement.signerName ?? ""} />
        </Field>
        <Field label="Signer email" htmlFor={`signerEmail-${agreement.id}`}>
          <Input id={`signerEmail-${agreement.id}`} name="signerEmail" type="email" defaultValue={agreement.signerEmail ?? ""} />
        </Field>
      </div>
      <Field
        label="Sell rate card"
        htmlFor={`sellRateCardId-${agreement.id}`}
        hint={agreement.status === "SIGNED" ? "Changing this re-activates the new card for the customer immediately" : "Activated for this customer once signed"}
      >
        <Select id={`sellRateCardId-${agreement.id}`} name="sellRateCardId" defaultValue={agreement.sellRateCard?.id ?? ""}>
          <option value="">None</option>
          {customer?.sellRateCards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Renewal date" htmlFor={`renewalDate-${agreement.id}`} hint="Optional — drives the renewal reminder">
        <Input
          id={`renewalDate-${agreement.id}`}
          name="renewalDate"
          type="date"
          defaultValue={agreement.renewalDate ? format(agreement.renewalDate, "yyyy-MM-dd") : ""}
        />
      </Field>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="documentMatches" required/>I verified that the PDF includes the complete reviewed terms, exact rate schedule and signature text tag.</label>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Save changes
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AgreementRow({ agreement, customer }: { agreement: Agreement; customer: Customer | undefined }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  function handleSend() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("agreementId", agreement.id);
        await sendAgreementForSignatureAction(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send for signature");
      }
    });
  }

  function handleVoid() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("agreementId", agreement.id);
        await voidAgreementAction(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not void agreement");
      }
    });
  }

  if (editing) {
    return <EditAgreementForm agreement={agreement} customer={customer} onDone={() => setEditing(false)} />;
  }

  return (
    <li className="flex flex-col gap-2 rounded-control border border-border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-ink font-medium">{agreement.customer.name}</p>
          <p className="text-ink-3 tabular">
            {enumLabel(agreement.kind)} · {agreement.signerEmail ?? agreement.customer.email ?? "no email on file"}
            {agreement.sellRateCard ? ` · ${agreement.sellRateCard.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RenewalBadge renewalDate={agreement.renewalDate} renewalDaysLeft={agreement.renewalDaysLeft} />
          <Badge tone={STATUS_TONE[agreement.status] ?? "neutral"}>{enumLabel(agreement.status)}</Badge>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <a className="text-sm text-accent p-2" href={`/agreements/${agreement.id}/preview`}>Preview terms & rates</a>
        {agreement.status === "DRAFT" && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        )}
        {(agreement.status === "DRAFT" || agreement.status === "SENDING") && (
          <Button type="button" size="sm" onClick={handleSend} loading={pending}>
            <Send className="size-4" /> {agreement.status === "SENDING" ? "Resume / check send" : "Send for e-sign"}
          </Button>
        )}
        {agreement.externalEnvelopeId && (
          <a href={`/api/agreements/${agreement.id}/document`} target="_blank" rel="noreferrer">
            <Button type="button" size="sm" variant="secondary">
              <FileText className="size-4" /> View document
            </Button>
          </a>
        )}
        {(agreement.status === "DRAFT") && (
          <Button type="button" size="sm" variant="secondary" onClick={handleVoid} loading={pending}>
            <Ban className="size-4" /> Void
          </Button>
        )}
      </div>
    </li>
  );
}

export function AgreementsPanel({ agreements, customers }: { agreements: Agreement[]; customers: Customer[] }) {
  if (agreements.length === 0) {
    return <EmptyState kind="empty" title="No agreements yet" description="Create one from the form on the right." />;
  }

  const customerById = new Map(customers.map((c) => [c.id, c]));

  return (
    <ul className="flex flex-col gap-3">
      {agreements.map((a) => (
        <AgreementRow key={a.id} agreement={a} customer={customerById.get(a.customer.id)} />
      ))}
    </ul>
  );
}
