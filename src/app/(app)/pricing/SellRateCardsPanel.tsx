"use client";

import { useState, useTransition } from "react";
import { createSellRateCardAction, finalizeSellRateCardAction, updateSellRateCardAction } from "@/lib/actions/pricing";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";

type Slab = {
  id: string;
  zone: string;
  minWeightKg: number;
  maxWeightKg: number;
  price: number;
  isActive: boolean;
};

type SellRateCard = {
  id: string;
  name: string;
  isActive: boolean;
  effectiveFrom: Date;
  minMarginPercent: number | null;
  isFinalized: boolean;
  finalizedAt: Date | null;
  slabs: Slab[];
  courierPartnerId?: string | null;
};

type DraftSlab = { zone: string; minWeightKg: string; maxWeightKg: string; price: string };

function emptyDraftSlab(): DraftSlab {
  return { zone: "", minWeightKg: "", maxWeightKg: "", price: "" };
}

function EditRateCardForm({ card, audience, courierPartnerId, tenantId, customerId, onDone }: { card: SellRateCard; audience: "DEFAULT" | "STAFF" | "COLLABORATOR" | "CLIENT"; courierPartnerId?: string | null; tenantId?: string | null; customerId?: string | null; onDone: () => void }) {
  const [name, setName] = useState(card.name);
  const [effectiveFrom, setEffectiveFrom] = useState(format(card.effectiveFrom, "yyyy-MM-dd"));
  const [minMarginPercent, setMinMarginPercent] = useState(card.minMarginPercent == null ? "" : String(card.minMarginPercent));
  const [slabs, setSlabs] = useState<DraftSlab[]>(card.slabs.map((s) => ({ zone: s.zone, minWeightKg: String(s.minWeightKg), maxWeightKg: String(s.maxWeightKg), price: String(s.price) })));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("cardId", card.id); fd.set("audience", audience); fd.set("name", name); fd.set("effectiveFrom", effectiveFrom); fd.set("slabsJson", JSON.stringify(slabs.map((s) => ({ zone: s.zone.trim(), minWeightKg: Number(s.minWeightKg), maxWeightKg: Number(s.maxWeightKg), price: Number(s.price) }))));
    if (courierPartnerId) fd.set("courierPartnerId", courierPartnerId); if (tenantId) fd.set("tenantId", tenantId); if (customerId) fd.set("customerId", customerId); if (minMarginPercent) fd.set("minMarginPercent", minMarginPercent);
    startTransition(async () => { try { await updateSellRateCardAction(fd); onDone(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update rate card"); } });
  }
  return <div className="mt-3 rounded-control border border-accent/30 bg-accent-soft p-3"><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Field label="Rate card name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Effective from"><Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></Field><Field label="Minimum margin %"><Input type="number" value={minMarginPercent} onChange={(e) => setMinMarginPercent(e.target.value)} /></Field></div><div className="mt-2 flex flex-col gap-2">{slabs.map((s, i) => <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2"><Input aria-label="Zone" value={s.zone} onChange={(e) => setSlabs((p) => p.map((x, j) => j === i ? { ...x, zone: e.target.value } : x))} /><Input aria-label="From kg" type="number" value={s.minWeightKg} onChange={(e) => setSlabs((p) => p.map((x, j) => j === i ? { ...x, minWeightKg: e.target.value } : x))} /><Input aria-label="To kg" type="number" value={s.maxWeightKg} onChange={(e) => setSlabs((p) => p.map((x, j) => j === i ? { ...x, maxWeightKg: e.target.value } : x))} /><Input aria-label="Price" type="number" value={s.price} onChange={(e) => setSlabs((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} /><Button type="button" size="sm" variant="ghost" onClick={() => setSlabs((p) => p.filter((_, j) => j !== i))} disabled={slabs.length === 1}><Trash2 className="size-4" /></Button></div>)}</div><div className="mt-2 flex gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => setSlabs((p) => [...p, emptyDraftSlab()])}><Plus className="size-4" /> Add slab</Button><Button type="button" size="sm" loading={pending} onClick={save}>Save draft</Button><Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button></div>{error && <p className="mt-2 text-xs text-danger">{error}</p>}</div>;
}

function FinalizeButton({ id }: { id: string }) { const [pending, startTransition] = useTransition(); const [error, setError] = useState<string | null>(null); return <span><Button type="button" size="sm" loading={pending} onClick={() => startTransition(async () => { try { await finalizeSellRateCardAction(id); } catch (e) { setError(e instanceof Error ? e.message : "Could not finalize rate card"); } })}><CheckCircle2 className="size-4" /> Finalize rates</Button>{error && <span className="ml-2 text-xs text-danger">{error}</span>}</span>; }

// tenantId undefined/null = the default price list (normal/marketplace
// bookings); set it to scope this panel to one commercial CLIENT tenant's
// own negotiated rates instead.
export function SellRateCardsPanel({ audience = "DEFAULT", courierPartnerId, tenantId, customerId, cards, couriers = [], showCourierSelector = false, canEdit = false }: { audience?: "DEFAULT" | "STAFF" | "COLLABORATOR" | "CLIENT"; courierPartnerId?: string | null; tenantId?: string | null; customerId?: string | null; cards: SellRateCard[]; couriers?: { id: string; name: string }[]; showCourierSelector?: boolean; canEdit?: boolean }) {
  const [showForm, setShowForm] = useState(cards.length === 0);
  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [minMarginPercent, setMinMarginPercent] = useState("");
  const [slabs, setSlabs] = useState<DraftSlab[]>([emptyDraftSlab()]);
  const [selectedCourierId, setSelectedCourierId] = useState(courierPartnerId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

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
    for (const s of slabs) {
      if (!s.zone.trim() || s.minWeightKg === "" || s.maxWeightKg === "" || s.price === "") {
        setError("Fill in every slab field");
        return;
      }
    }

    const fd = new FormData();
    fd.set("audience", audience);
    if (selectedCourierId) fd.set("courierPartnerId", selectedCourierId);
    if (tenantId) fd.set("tenantId", tenantId);
    if (customerId) fd.set("customerId", customerId);
    fd.set("name", name.trim());
    fd.set("effectiveFrom", effectiveFrom);
    if (minMarginPercent.trim()) fd.set("minMarginPercent", minMarginPercent.trim());
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
        await createSellRateCardAction(fd);
        setShowForm(false);
        setName("");
        setEffectiveFrom("");
        setMinMarginPercent("");
        setSlabs([emptyDraftSlab()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save rate card");
      }
    });
  }

  const visibleCards = showCourierSelector ? cards.filter((card) => (card.courierPartnerId ?? "") === selectedCourierId) : cards;

  return (
    <div className="flex flex-col gap-4">
      {showCourierSelector && (
        <Field label="Courier" htmlFor="src-courier">
          <select id="src-courier" value={selectedCourierId} onChange={(e) => setSelectedCourierId(e.target.value)} className="h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-ink">
            <option value="">Global / all couriers fallback</option>
            {couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
          </select>
        </Field>
      )}
      {visibleCards.length > 0 && (
        <ul className="flex flex-col gap-3">
          {visibleCards.map((card) => (
            <li key={card.id} className="rounded-control border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink">{card.name}</p>
                  <p className="text-ink-3 tabular">
                    Effective {format(card.effectiveFrom, "MMM d, yyyy")}
                    {card.minMarginPercent != null && ` · ${card.minMarginPercent}% margin floor`}
                  </p>
                </div>
                <div className="flex items-center gap-2"><Badge tone={card.isFinalized ? "success" : "warning"}>{card.isFinalized ? "Finalized" : "Draft"}</Badge><Badge tone={card.isActive ? "success" : "neutral"}>{card.isActive ? "Active" : "Past"}</Badge></div>
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
              {canEdit && !card.isFinalized && <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => setEditingCardId(editingCardId === card.id ? null : card.id)}><Pencil className="size-4" /> Edit rates</Button><FinalizeButton id={card.id} /></div>}
              {editingCardId === card.id && <EditRateCardForm card={card} audience={audience} courierPartnerId={courierPartnerId} tenantId={tenantId} customerId={customerId} onDone={() => setEditingCardId(null)} />}
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-control border border-border p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Rate card name" htmlFor="src-name" required>
              <Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Effective from" htmlFor="src-effectiveFrom" required>
              <Input id="src-effectiveFrom" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            </Field>
            <Field label="Min margin %" htmlFor="src-minMargin" hint="Optional floor check">
              <Input
                id="src-minMargin"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={minMarginPercent}
                onChange={(e) => setMinMarginPercent(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink-2">Slabs</p>
            {slabs.map((slab, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                <Field label="Zone" htmlFor={`src-slab-zone-${i}`}>
                  <Input
                    id={`src-slab-zone-${i}`}
                    value={slab.zone}
                    onChange={(e) => updateSlab(i, { zone: e.target.value })}
                    placeholder="LOCAL"
                  />
                </Field>
                <Field label="Min kg" htmlFor={`src-slab-min-${i}`}>
                  <Input
                    id={`src-slab-min-${i}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={slab.minWeightKg}
                    onChange={(e) => updateSlab(i, { minWeightKg: e.target.value })}
                  />
                </Field>
                <Field label="Max kg" htmlFor={`src-slab-max-${i}`}>
                  <Input
                    id={`src-slab-max-${i}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={slab.maxWeightKg}
                    onChange={(e) => updateSlab(i, { maxWeightKg: e.target.value })}
                  />
                </Field>
                <Field label="Price" htmlFor={`src-slab-price-${i}`}>
                  <Input
                    id={`src-slab-price-${i}`}
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
            {visibleCards.length > 0 && (
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
