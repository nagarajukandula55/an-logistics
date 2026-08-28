"use client";

import { useActionState, useState, useTransition } from "react";
import { createOrderAction, createCustomerAction, type CreateOrderState } from "@/lib/actions/orders";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Plus, X } from "lucide-react";
import { PINCODE_REGEX } from "@/lib/validation";

type CustomerOption = { id: string; name: string; phone: string | null };

const initialState: CreateOrderState = { ok: false };

export function NewOrderForm({ customers: initialCustomers }: { customers: CustomerOption[] }) {
  const [state, formAction, pending] = useActionState(createOrderAction, initialState);
  const [customers, setCustomers] = useState(initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomers[0]?.id ?? "");
  const [showNewCustomer, setShowNewCustomer] = useState(initialCustomers.length === 0);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [creatingCustomer, startCreatingCustomer] = useTransition();
  const [customerError, setCustomerError] = useState<string | null>(null);

  const errors = state.errors ?? {};
  const [pickupPincodeError, setPickupPincodeError] = useState<string | null>(null);
  const [deliveryPincodeError, setDeliveryPincodeError] = useState<string | null>(null);

  function validatePincodeOnBlur(value: string, setter: (msg: string | null) => void) {
    setter(value && !PINCODE_REGEX.test(value) ? "Enter a valid 6-digit pincode" : null);
  }

  function handleCreateCustomer() {
    if (!newCustomerName.trim()) {
      setCustomerError("Customer name is required");
      return;
    }
    setCustomerError(null);
    const fd = new FormData();
    fd.set("name", newCustomerName.trim());
    fd.set("phone", newCustomerPhone.trim());
    startCreatingCustomer(async () => {
      try {
        const customer = await createCustomerAction(fd);
        setCustomers((prev) => [...prev, customer]);
        setSelectedCustomerId(customer.id);
        setShowNewCustomer(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
      } catch (err) {
        setCustomerError(err instanceof Error ? err.message : "Could not create customer");
      }
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="h-section">Customer</h2>

          {!showNewCustomer ? (
            <div className="flex items-end gap-2">
              <Field label="Customer" htmlFor="customerId" required className="flex-1">
                <Select
                  id="customerId"
                  name="customerId"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  invalid={!!errors.customerId}
                >
                  {customers.length === 0 && <option value="">No customers yet</option>}
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `· ${c.phone}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="button" variant="secondary" onClick={() => setShowNewCustomer(true)}>
                <Plus className="size-4" /> New
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-control border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">New customer</p>
                {customers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(false)}
                    className="text-ink-3 hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Field label="Name" required>
                <Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Customer or business name" />
              </Field>
              <Field label="Phone">
                <Input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="+91…" />
              </Field>
              {customerError && <p className="text-xs text-danger">{customerError}</p>}
              <Button type="button" size="sm" onClick={handleCreateCustomer} loading={creatingCustomer}>
                Save customer
              </Button>
              <input type="hidden" name="customerId" value={selectedCustomerId} />
            </div>
          )}
          {errors.customerId && <p className="text-xs text-danger">{errors.customerId[0]}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="h-section">Pickup</h2>
          <Field label="Pickup address" htmlFor="pickupAddress" required error={errors.pickupAddress?.[0]}>
            <Textarea id="pickupAddress" name="pickupAddress" required invalid={!!errors.pickupAddress} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact name" htmlFor="pickupContactName" required error={errors.pickupContactName?.[0]}>
              <Input id="pickupContactName" name="pickupContactName" required invalid={!!errors.pickupContactName} />
            </Field>
            <Field label="Contact phone" htmlFor="pickupContactPhone" required error={errors.pickupContactPhone?.[0]}>
              <Input id="pickupContactPhone" name="pickupContactPhone" required invalid={!!errors.pickupContactPhone} />
            </Field>
          </div>
          <Field
            label="Pickup pincode"
            htmlFor="pickupPincode"
            hint="Optional"
            error={pickupPincodeError ?? errors.pickupPincode?.[0]}
          >
            <Input
              id="pickupPincode"
              name="pickupPincode"
              invalid={!!pickupPincodeError || !!errors.pickupPincode}
              onBlur={(e) => validatePincodeOnBlur(e.target.value, setPickupPincodeError)}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="h-section">Delivery</h2>
          <Field label="Delivery address" htmlFor="deliveryAddress" required error={errors.deliveryAddress?.[0]}>
            <Textarea id="deliveryAddress" name="deliveryAddress" required invalid={!!errors.deliveryAddress} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact name" htmlFor="deliveryContactName" required error={errors.deliveryContactName?.[0]}>
              <Input id="deliveryContactName" name="deliveryContactName" required invalid={!!errors.deliveryContactName} />
            </Field>
            <Field label="Contact phone" htmlFor="deliveryContactPhone" required error={errors.deliveryContactPhone?.[0]}>
              <Input id="deliveryContactPhone" name="deliveryContactPhone" required invalid={!!errors.deliveryContactPhone} />
            </Field>
          </div>
          <Field
            label="Delivery pincode"
            htmlFor="deliveryPincode"
            hint="Used to find serviceable courier partner branches"
            error={deliveryPincodeError ?? errors.deliveryPincode?.[0]}
          >
            <Input
              id="deliveryPincode"
              name="deliveryPincode"
              invalid={!!deliveryPincodeError || !!errors.deliveryPincode}
              onBlur={(e) => validatePincodeOnBlur(e.target.value, setDeliveryPincodeError)}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="h-section">Package</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Weight (kg)" htmlFor="weightKg" error={errors.weightKg?.[0]}>
              <Input id="weightKg" name="weightKg" type="number" step="0.1" min="0" />
            </Field>
            <Field label="COD amount" htmlFor="codAmount" error={errors.codAmount?.[0]} hint="Leave blank if not cash-on-delivery">
              <Input id="codAmount" name="codAmount" type="number" step="0.01" min="0" />
            </Field>
          </div>
          <Field label="Package description" htmlFor="packageDescription">
            <Textarea id="packageDescription" name="packageDescription" placeholder="e.g. 2 boxes, electronics" />
          </Field>
        </CardBody>
      </Card>

      {state.message && <p className="text-sm text-danger">{state.message}</p>}

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!selectedCustomerId}>
          Create order
        </Button>
      </div>
    </form>
  );
}
