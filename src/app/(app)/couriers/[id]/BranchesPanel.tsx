"use client";

import { useState, useTransition } from "react";
import {
  createCourierBranchAction,
  createServiceAreaAction,
  setCourierBranchActiveAction,
} from "@/lib/actions/couriers";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Plus } from "lucide-react";

type ServiceArea = { id: string; pincode: string; city: string | null };
type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
  contactPhone: string;
  isActive: boolean;
  serviceAreas: ServiceArea[];
};

export function BranchesPanel({ courierPartnerId, branches }: { courierPartnerId: string; branches: Branch[] }) {
  const [showBranchForm, setShowBranchForm] = useState(branches.length === 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAddBranch(formData: FormData) {
    setError(null);
    formData.set("courierPartnerId", courierPartnerId);
    startTransition(async () => {
      try {
        await createCourierBranchAction(formData);
        setShowBranchForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add branch");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {branches.length === 0 && !showBranchForm && <p className="text-sm text-ink-3">No branches yet.</p>}

      {branches.map((branch) => (
        <BranchRow key={branch.id} courierPartnerId={courierPartnerId} branch={branch} />
      ))}

      {showBranchForm ? (
        <form action={handleAddBranch} className="flex flex-col gap-3 rounded-control border border-border p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Branch name" htmlFor="name" required>
              <Input id="name" name="name" required />
            </Field>
            <Field label="City" htmlFor="city" required>
              <Input id="city" name="city" required />
            </Field>
          </div>
          <Field label="Address" htmlFor="address" required>
            <Input id="address" name="address" required />
          </Field>
          <Field label="Contact phone" htmlFor="contactPhone" required>
            <Input id="contactPhone" name="contactPhone" required />
          </Field>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={pending}>
              Add branch
            </Button>
            {branches.length > 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowBranchForm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowBranchForm(true)} className="self-start">
          <Plus className="size-4" /> Add branch
        </Button>
      )}
    </div>
  );
}

function BranchRow({ courierPartnerId, branch }: { courierPartnerId: string; branch: Branch }) {
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAddArea(formData: FormData) {
    setError(null);
    formData.set("courierBranchId", branch.id);
    formData.set("courierPartnerId", courierPartnerId);
    startTransition(async () => {
      try {
        await createServiceAreaAction(formData);
        setShowAreaForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add service area");
      }
    });
  }

  function handleToggleActive() {
    const fd = new FormData();
    fd.set("branchId", branch.id);
    fd.set("courierPartnerId", courierPartnerId);
    fd.set("isActive", String(!branch.isActive));
    startToggle(async () => {
      await setCourierBranchActiveAction(fd);
    });
  }

  return (
    <div className="rounded-control border border-border p-3 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            {branch.name} <span className="text-ink-3 font-normal">· {branch.city}</span>
          </p>
          <p className="text-xs text-ink-3">{branch.address}</p>
          <p className="text-xs text-ink-3">{branch.contactPhone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={branch.isActive ? "success" : "neutral"}>{branch.isActive ? "Active" : "Inactive"}</Badge>
          <Button type="button" size="sm" variant="secondary" loading={togglePending} onClick={handleToggleActive}>
            {branch.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {branch.serviceAreas.map((area) => (
          <Badge key={area.id} tone="info">
            {area.pincode}
            {area.city ? ` · ${area.city}` : ""}
          </Badge>
        ))}
        {branch.serviceAreas.length === 0 && <span className="text-xs text-ink-3">No service areas yet.</span>}
      </div>

      {showAreaForm ? (
        <form action={handleAddArea} className="flex items-end gap-2">
          <Field label="Pincode" htmlFor={`pincode-${branch.id}`} required className="w-32">
            <Input id={`pincode-${branch.id}`} name="pincode" required />
          </Field>
          <Field label="City" htmlFor={`areaCity-${branch.id}`} hint="Optional" className="flex-1">
            <Input id={`areaCity-${branch.id}`} name="city" />
          </Field>
          <Button type="submit" size="sm" loading={pending}>
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowAreaForm(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowAreaForm(true)} className="self-start">
          <Plus className="size-4" /> Add service area
        </Button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
