"use client";

import { useState } from "react";

export function PincodeInput({ value, name, placeholder, onChange, onResolved }: { value: string; name: string; placeholder?: string; onChange: (value: string) => void; onResolved: (result: { state: string; district?: string; city: string; locality?: string }) => void }) {
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  async function handleChange(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, 6);
    onChange(next);
    setNotFound(false);
    if (next.length !== 6) return;
    setLooking(true);
    try {
      const response = await fetch(`/api/pincode/${next}`);
      const result = await response.json();
      if (result.found && result.city) onResolved(result);
      else setNotFound(true);
    } catch { setNotFound(true); }
    finally { setLooking(false); }
  }
  return <div><input name={name} value={value} onChange={(event) => void handleChange(event.target.value)} placeholder={placeholder || "6-digit pincode"} maxLength={6} inputMode="numeric" required className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent" />{looking && <p className="mt-1 text-xs text-ink-3">Finding city from pincode…</p>}{notFound && !looking && <p className="mt-1 text-xs text-amber-600">Pincode not found. Please enter the city manually.</p>}</div>;
}
