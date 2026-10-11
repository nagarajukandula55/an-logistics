"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { sendAgreementForSignatureAction } from "@/lib/actions/agreements";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Send } from "lucide-react";

type RenewalAgreement = {
  id: string;
  documentUrl: string | null;
  renewalDate: Date;
  daysLeft: number;
  customer: { name: string };
};

function RenewalRow({ agreement }: { agreement: RenewalAgreement }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const { daysLeft } = agreement;

  function handleSend() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("agreementId", agreement.id);
      await sendAgreementForSignatureAction(formData);
      setSent(true);
    });
  }

  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <div>
        <p className="text-ink">{agreement.customer.name}</p>
        <p className="text-ink-3 tabular">
          {daysLeft < 0 ? `Expired ${format(agreement.renewalDate, "MMM d, yyyy")}` : `Due ${format(agreement.renewalDate, "MMM d, yyyy")}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={daysLeft < 0 ? "danger" : "warning"}>{daysLeft < 0 ? "Overdue" : `${daysLeft}d left`}</Badge>
        {sent ? (
          <span className="text-xs text-success">Sent</span>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={handleSend} loading={pending} disabled={!agreement.documentUrl}>
            <Send className="size-4" /> Send renewal
          </Button>
        )}
      </div>
    </li>
  );
}

export function AgreementRenewalsCard({ agreements }: { agreements: RenewalAgreement[] }) {
  if (agreements.length === 0) {
    return <p className="text-sm text-ink-3">No agreements expired or due for renewal in the next 30 days.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {agreements.map((a) => (
          <RenewalRow key={a.id} agreement={a} />
        ))}
      </ul>
      <Link href="/agreements" className="text-xs text-accent self-start">
        View all agreements →
      </Link>
    </div>
  );
}
