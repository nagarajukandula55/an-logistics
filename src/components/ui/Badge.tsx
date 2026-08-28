import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-ink-2",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-control px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

// Maps Prisma's OrderStatus enum to a Badge tone + label. Kept here (not in
// the Prisma layer) so the UI can evolve independently of the schema.
const ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  CREATED: "neutral",
  ASSIGNED: "info",
  PICKED_UP: "info",
  IN_TRANSIT: "warning",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  FAILED: "danger",
  CANCELLED: "danger",
};

export function orderStatusTone(status: string): BadgeTone {
  return ORDER_STATUS_TONE[status] ?? "neutral";
}

export function orderStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

const DRIVER_VEHICLE_TONE: Record<string, BadgeTone> = {
  AVAILABLE: "success",
  ON_TRIP: "warning",
  OFF_DUTY: "neutral",
  MAINTENANCE: "danger",
  INACTIVE: "neutral",
};

export function fleetStatusTone(status: string): BadgeTone {
  return DRIVER_VEHICLE_TONE[status] ?? "neutral";
}
