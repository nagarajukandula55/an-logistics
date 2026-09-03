"use client";

import { useActionState, useState } from "react";
import {
  checkPublicServiceabilityAction,
  createPublicBookingAction,
  type CheckServiceabilityState,
  type CreateBookingState,
  type PublicQuote,
} from "@/lib/actions/public-booking";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

const serviceabilityInitial: CheckServiceabilityState = { ok: false };
const bookingInitial: CreateBookingState = { ok: false };

export function BookingFlow() {
  const [quoteState, checkAction, checking] = useActionState(checkPublicServiceabilityAction, serviceabilityInitial);
  const [bookState, bookAction, booking] = useActionState(createPublicBookingAction, bookingInitial);
  const [selected, setSelected] = useState<PublicQuote | null>(null);
  const [route, setRoute] = useState<{ pickupPincode: string; deliveryPincode: string; weightKg: string } | null>(null);

  if (bookState.ok && bookState.trackingCode) {
    return (
      <Card>
        <CardBody className="text-center flex flex-col gap-3">
          <p className="text-sm text-ink-2">Booked. Your tracking code:</p>
          <p className="h-section tabular">{bookState.trackingCode}</p>
          <Link href={`/track/${bookState.trackingCode}`} className="text-accent text-sm">
            Track this shipment →
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (!selected) {
    return (
      <Card>
        <CardBody>
          <form
            action={(fd) => {
              setRoute({
                pickupPincode: String(fd.get("pickupPincode") || ""),
                deliveryPincode: String(fd.get("deliveryPincode") || ""),
                weightKg: String(fd.get("weightKg") || ""),
              });
              checkAction(fd);
            }}
            className="flex flex-col gap-3"
          >
            <Field label="Pickup pincode" htmlFor="pickupPincode" required>
              <Input id="pickupPincode" name="pickupPincode" required maxLength={6} />
            </Field>
            <Field label="Delivery pincode" htmlFor="deliveryPincode" required>
              <Input id="deliveryPincode" name="deliveryPincode" required maxLength={6} />
            </Field>
            <Field label="Weight (kg)" htmlFor="weightKg" required>
              <Input id="weightKg" name="weightKg" type="number" step="0.1" min="0.1" required />
            </Field>
            {quoteState.error && <p className="text-xs text-danger">{quoteState.error}</p>}
            <Button type="submit" loading={checking} className="w-full mt-1">
              Check rates
            </Button>
          </form>

          {quoteState.ok && quoteState.quotes && (
            <div className="mt-6">
              {quoteState.quotes.length === 0 ? (
                <EmptyState kind="empty" title="Not serviceable" description="No courier — ours or a partner's — covers this route yet." />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {quoteState.quotes.map((q) => (
                    <li key={q.courierBranchId} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-ink font-medium">{q.courierName}</p>
                        <p className="text-xs text-ink-3">{q.etaDays ? `${q.etaDays} days` : "ETA unavailable"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="tabular text-ink">₹{q.rate.toFixed(2)}</p>
                        <Button type="button" size="sm" onClick={() => setSelected(q)}>
                          Select
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <form action={bookAction} className="flex flex-col gap-3">
          <input type="hidden" name="courierPartnerId" value={selected.courierPartnerId} />
          <input type="hidden" name="courierBranchId" value={selected.courierBranchId} />
          {selected.providerCourierId && <input type="hidden" name="providerCourierId" value={selected.providerCourierId} />}
          <input type="hidden" name="pickupPincode" value={route?.pickupPincode ?? ""} />
          <input type="hidden" name="deliveryPincode" value={route?.deliveryPincode ?? ""} />
          <input type="hidden" name="weightKg" value={route?.weightKg ?? ""} />

          <div className="rounded-control border border-border bg-surface-2 p-3 flex items-center justify-between text-sm mb-1">
            <span className="text-ink">{selected.courierName}</span>
            <span className="tabular text-ink">₹{selected.rate.toFixed(2)}</span>
          </div>

          <Field label="Your name" htmlFor="customerName" required>
            <Input id="customerName" name="customerName" required />
          </Field>
          <Field label="Your phone" htmlFor="customerPhone" required>
            <Input id="customerPhone" name="customerPhone" required />
          </Field>
          <Field label="Pickup address" htmlFor="pickupAddress" required>
            <Input id="pickupAddress" name="pickupAddress" required />
          </Field>
          <Field label="Recipient name" htmlFor="deliveryContactName" required>
            <Input id="deliveryContactName" name="deliveryContactName" required />
          </Field>
          <Field label="Recipient phone" htmlFor="deliveryContactPhone" required>
            <Input id="deliveryContactPhone" name="deliveryContactPhone" required />
          </Field>
          <Field label="Delivery address" htmlFor="deliveryAddress" required>
            <Input id="deliveryAddress" name="deliveryAddress" required />
          </Field>
          <Field label="Amount to charge (optional)" htmlFor="chargedAmount">
            <Input id="chargedAmount" name="chargedAmount" type="number" step="0.01" min="0" />
          </Field>

          {bookState.error && <p className="text-xs text-danger">{bookState.error}</p>}
          <div className="flex gap-2 mt-1">
            <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
              Back
            </Button>
            <Button type="submit" loading={booking} className="flex-1">
              Confirm booking
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
