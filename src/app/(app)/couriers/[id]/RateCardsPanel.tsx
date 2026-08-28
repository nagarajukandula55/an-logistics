"use client";

import { useState, useTransition } from "react";
import { createRateCardAction } from "@/lib/actions/couriers";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

type Slab = {
  id: string;
  zone: string;
  minWeightKg: number;
  maxWeightKg: number;
  price: number;
  isActive: boolean;
};

type RateCard = {
  id: string;
  name: string;
  isActive: boolean;
  effectiveFrom: Date;
  slabs: Slab[];
};

type DraftSlab = { zone: string; minWeightKg: string; maxWeightKg: string; price: string };

function emptyDraftSlab(): DraftSlab {
  return { zone: "", minWeightKg: "", maxWeightKg: "", price: "" };
}

export function RateCardsPanel({ courierPartnerId, rateCards }: { courierPartnerId: string; rateCards: RateCard[] }) {
  const [showForm, setShowForm] = useState(rateCards.length === 0);
  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [slabs, setSlabs] = useState<DraftSlab[]>([emptyDraftSlab()]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateSlab(index: number, patch: Partial<DraftSlab>) {
    setSlabs((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSlab(index: number) {
    setSlabs((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Rate card name is required");
      return;
    }
    if (!effectiveFrom) {
      setError("Effective-from date is required");
      return;
    }
    if (slabs.length === 0) {
      setError("Add at least one slab");
      return;
    }
    for (const s of slabs) {
      if (!s.zone.trim() || s.minWeightKg === "" || s.maxWeightKg === "" || s.price === "") {
        setError("Fill in every slab field");
        return;
      }
    }

    const fd = new FormData();
    fd.set("courierPartnerId", courierPartnerId);
    fd.set("name", name.trim());
    fd.set("effectiveFrom", effectiveFrom);
    fd.set(
      "slabsJson",
      JSON.stringify(
        slabs.map((s) => ({
          zone: s.zone.trim(),
          minWeightKg: Number(s.minWeightKg),
          maxWeightKg: Number(s.maxWeightKg),
          price: Number(s.price),
        }))
      )
    );

    startTransition(async () => {
      try {
        await createRateCardAction(fd);
        setShowForm(false);
        setName("");
        setEffectiveFrom("");
        setSlabs([emptyDraftSlab()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save rate card");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {rateCards.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rateCards.map((card) => (
            <li key={card.id} className="rounded-control border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink">{card.name}</p>
                  <p className="text-ink-3 tabular">Effective {format(card.effectiveFrom, "MMM d, yyyy")}</p>
                </div>
                <Badge tone={card.isActive ? "success" : "neutral"}>{card.isActive ? "Active" : "Past"}</Badge>
              </div>
              {card.slabs.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {card.slabs.map((slab) => (
                    <li key={slab.id} className="rounded-control bg-surface-2 px-2 py-1 text-xs text-ink-2 tabular">
                      {slab.zone}: {slab.minWeightKg}–{slab.maxWeightKg}kg · ₹{slab.price.toFixed(2)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-control border border-border p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Rate card name" htmlFor="rc-name" required>
              <Input id="rc-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Effective from" htmlFor="rc-effectiveFrom" required>
              <Input id="rc-effectiveFrom" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink-2">Slabs</p>
            {slabs.map((slab, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                <Field label="Zone" htmlFor={`slab-zone-${i}`}>
                  <Input
                    id={`slab-zone-${i}`}
                    value={slab.zone}
                    onChange={(e) => updateSlab(i, { zone: e.target.value })}
                    placeholder="LOCAL"
                  />
                </Field>
                <Field label="Min kg" htmlFor={`slab-min-${i}`}>
                  <Input
                    id={`slab-min-${i}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={slab.minWeightKg}
                    onChange={(e) => updateSlab(i, { minWeightKg: e.target.value })}
                  />
                </Field>
                <Field label="Max kg" htmlFor={`slab-max-${i}`}>
                  <Input
                    id={`slab-max-${i}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={slab.maxWeightKg}
                    onChange={(e) => updateSlab(i, { maxWeightKg: e.target.value })}
                  />
                </Field>
                <Field label="Price" htmlFor={`slab-price-${i}`}>
                  <Input
                    id={`slab-price-${i}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={slab.price}
                    onChange={(e) => updateSlab(i, { price: e.target.value })}
                  />
                </Field>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeSlab(i)} disabled={slabs.length === 1}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={() => setSlabs((prev) => [...prev, emptyDraftSlab()])} className="self-start">
              <Plus className="size-4" /> Add slab
            </Button>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" loading={pending} onClick={handleSubmit}>
              Save rate card
            </Button>
            {rateCards.length > 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(true)} className="self-start">
          <Plus className="size-4" /> Add rate card
        </Button>
      )}
    </div>
  );
}
