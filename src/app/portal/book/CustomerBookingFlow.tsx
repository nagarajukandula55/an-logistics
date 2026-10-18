"use client";

import { useActionState, useState } from "react";
import {

  type CheckServiceabilityState,
  type PublicQuote,
} from "@/lib/actions/public-booking";
import { checkCustomerServiceabilityAction } from "@/lib/actions/customer-quotes";
import { createCustomerBookingAction, type CreateCustomerBookingState } from "@/lib/actions/customer-booking";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

const serviceabilityInitial: CheckServiceabilityState = { ok: false };
const bookingInitial: CreateCustomerBookingState = { ok: false };

// Logged-in counterpart to src/app/book/BookingFlow.tsx — quoting is
// identical (checkPublicServiceabilityAction is stateless/anonymous either
// way), but skips asking for the booker's own name/phone since that's
// already known from their account, and posts to
// createCustomerBookingAction instead of the anonymous booking action.
export function CustomerBookingFlow() {
  const [quoteState, checkAction, checking] = useActionState(checkCustomerServiceabilityAction, serviceabilityInitial);
  const [bookState, bookAction, booking] = useActionState(createCustomerBookingAction, bookingInitial);
  const [bookingKey,setBookingKey]=useState("");
  const [selected, setSelected] = useState<PublicQuote | null>(null);
  const [route, setRoute] = useState<{ pickupPincode: string; deliveryPincode: string; weightKg: string } | null>(null);

  if (bookState.ok && bookState.trackingCode) {
    return (
      <Card>
        <CardBody className="text-center flex flex-col gap-3">
          <p className="text-sm text-ink-2">{bookState.message}</p>
          {bookState.providerRef && <p className="font-semibold">Courier docket: {bookState.providerRef}</p>}
          <p className="text-sm text-ink-2">Your AN Logistics tracking code:</p>
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
                        <Button type="button" size="sm" onClick={() => {setBookingKey(crypto.randomUUID());setSelected(q)}}>
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
          <input type="hidden" name="bookingKey" value={bookingKey}/>
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

          <p className="text-sm text-ink-2">Single-package booking. Contact operations for multi-piece, COD, restricted goods or insurance requirements.</p>
          {[["pickupContactName","Pickup contact","text"],["pickupContactPhone","Pickup mobile","tel"],["pickupCity","Pickup city","text"],["pickupState","Pickup state","text"],["deliveryCity","Delivery city","text"],["deliveryState","Delivery state","text"],["lengthCm","Length (cm)","number"],["widthCm","Width (cm)","number"],["heightCm","Height (cm)","number"],["declaredValue","Declared goods value (INR)","number"],["packageDescription","Package contents","text"],["pickupDate","Preferred pickup date","date"]].map(([name,label,type])=><Field key={name} label={label} htmlFor={name}><Input id={name} name={name} type={type} required min={type==="number"?"0":undefined} step={type==="number"?"0.01":undefined}/></Field>)}
          <Field label="Invoice number (if applicable)" htmlFor="invoiceNumber"><Input name="invoiceNumber" id="invoiceNumber"/></Field>
          <Field label="E-way bill (if applicable)" htmlFor="ewayBill"><Input name="ewayBill" id="ewayBill" maxLength={12}/></Field>
          <label className="flex gap-2 text-sm"><input type="checkbox" name="goodsConsent" required/>I declare accurate contents and value, suitable packaging, no prohibited goods, and the required transport documents.</label>
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
