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

function displayZone(zone: string) {
  return zone.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function displayWeight(min: number, max: number) {
  const formatKg = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return max >= 1000 ? `${formatKg(min)} kg and above` : `${formatKg(min)}–${formatKg(max)} kg`;
}

function displayCardName(name: string) {
  return name
    .replace(/\s+-\s+2x adjusted cost/i, "")
    .replace(/\s+all services/i, "")
    .trim() || "Rate card";
}

function RateSlabTable({ slabs }: { slabs: Slab[] }) {
  const [query, setQuery] = useState("");
  const [weightFilter, setWeightFilter] = useState("ALL");
  const grouped = new Map<string, { min: number; max: number; rows: Slab[] }>();
  for (const slab of slabs) {
    const key = `${slab.minWeightKg}|${slab.maxWeightKg}`;
    const existing = grouped.get(key);
    if (existing) existing.rows.push(slab);
    else grouped.set(key, { min: slab.minWeightKg, max: slab.maxWeightKg, rows: [slab] });
  }
  const groups = [...grouped.values()].sort((a, b) => a.min - b.min);
  const matches = (zone: string) => displayZone(zone).toLowerCase().includes(query.trim().toLowerCase());
  return <div className="mt-4 flex flex-col gap-4">
    <div className="grid gap-3 rounded-control border border-border bg-surface-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <Field label="Search zone"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search City, Region, Andhra Pradesh..." /></Field>
      <Field label="Weight slab"><select value={weightFilter} onChange={(event) => setWeightFilter(event.target.value)} className="h-10 rounded-control border border-border bg-surface px-3 text-sm text-ink"><option value="ALL">All weight slabs</option>{groups.map((group) => <option key={`${group.min}-${group.max}`} value={`${group.min}|${group.max}`}>{displayWeight(group.min, group.max)}</option>)}</select></Field>
    </div>
    {groups.filter((group) => weightFilter === "ALL" || weightFilter === `${group.min}|${group.max}`).map((group) => {
      const rows = group.rows.filter((slab) => matches(slab.zone)).sort((a, b) => a.zone.localeCompare(b.zone));
      if (rows.length === 0) return null;
      const zones = [...new Set(rows.map((row) => row.zone))].sort((a, b) => a.localeCompare(b));
      return <div key={`${group.min}-${group.max}`} className="overflow-hidden rounded-control border border-border">
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-2"><span className="text-sm font-semibold text-ink">Weight: {displayWeight(group.min, group.max)}</span><span className="text-xs text-ink-3">{rows.length} zones</span></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-3"><tr><th className="sticky left-0 bg-surface px-3 py-2 font-medium">Weight slab</th>{zones.map((zone) => <th key={zone} className="whitespace-nowrap px-3 py-2 text-right font-medium">{displayZone(zone)}</th>)}</tr></thead>
          <tbody className="divide-y divide-border"><tr className="text-ink-2"><td className="sticky left-0 bg-surface px-3 py-2 font-medium">{displayWeight(group.min, group.max)}</td>{zones.map((zone) => { const slab = rows.find((item) => item.zone === zone); return <td key={zone} className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular">{slab ? `Rs. ${slab.price.toFixed(2)}` : "—"}</td>; })}</tr></tbody>
        </table></div>
      </div>;
    })}
  </div>;
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
                  <p className="text-ink">{displayCardName(card.name)}</p>
                  <p className="text-xs text-ink-2">Selling price by destination zone and chargeable weight</p>
                  <p className="text-ink-3 tabular">
                    Effective {format(card.effectiveFrom, "MMM d, yyyy")}
                    {card.minMarginPercent != null && ` · ${card.minMarginPercent}% margin floor`}
                  </p>
                </div>
                <div className="flex items-center gap-2"><Badge tone={card.isFinalized ? "success" : "warning"}>{card.isFinalized ? "Finalized" : "Draft"}</Badge><Badge tone={card.isActive ? "success" : "neutral"}>{card.isActive ? "Active" : "Past"}</Badge></div>
              </div>
              {card.slabs.length > 0 && (card.name.toLowerCase().includes("all services") ? <div className="mt-4 rounded-control border border-accent/20 bg-accent-soft px-3 py-2 text-xs text-ink-2">Detailed rates are shown in the structured viewer above. Select E-commerce, Domestic TS, or Reverse pickup, then choose the service and weight columns you need.</div> : <RateSlabTable slabs={card.slabs} />)}
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
