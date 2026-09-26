import { OrderStatus } from "@prisma/client";

// Single source of truth for "DTDC status string -> our OrderStatus",
// shared by two different callers that see DTDC's status vocabulary in two
// different shapes:
//  - the inbound Consignment Status Webhook (tracking-update/route.ts),
//    whose `type` field is a lowercase snake_case event name confirmed
//    against DTDC's real schema (e.g. "delivered", "rto_initiated")
//  - the polling reconciliation job (api/cron/sync-tracking/route.ts),
//    which reads the Consignment Tracking GET endpoint's `status` field —
//    also confirmed to exist, but DTDC's schema didn't enumerate its actual
//    string values, so its real casing/wording (e.g. "Delivered" vs
//    "DELIVERED" vs "delivered") is still a guess.
// Normalizing (lowercase, collapse whitespace/underscores) before matching
// means both callers tolerate either vocabulary without needing their own
// separate map — but the mapping itself should be corrected once real
// tracking `status` values are actually seen from a live shipment.
const NORMALIZED_STATUS_MAP: Record<string, OrderStatus> = {
  "pickup completed": OrderStatus.PICKED_UP,
  "handover courier partner": OrderStatus.PICKED_UP,
  "picked up": OrderStatus.PICKED_UP,
  "intransittohub": OrderStatus.IN_TRANSIT,
  "in transit": OrderStatus.IN_TRANSIT,
  "inscan at hub": OrderStatus.IN_TRANSIT,
  "outscan at hub": OrderStatus.IN_TRANSIT,
  "reachedathub": OrderStatus.IN_TRANSIT,
  "reached at hub": OrderStatus.IN_TRANSIT,
  accept: OrderStatus.OUT_FOR_DELIVERY, // DTDC's doc: "accept - When the consignment is out for delivery"
  "out for delivery": OrderStatus.OUT_FOR_DELIVERY,
  delivered: OrderStatus.DELIVERED,
  cancelled: OrderStatus.CANCELLED,
  canceled: OrderStatus.CANCELLED,
  rto: OrderStatus.FAILED,
  "rto initiated": OrderStatus.FAILED,
  "rto delivered": OrderStatus.FAILED,
  attempted: OrderStatus.FAILED,
  "not picked up": OrderStatus.FAILED,
  "pickup failed": OrderStatus.FAILED,
};

export function mapDtdcStatus(raw: string | null | undefined): OrderStatus | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim().replace(/_/g, " ").replace(/\s+/g, " ");
  return NORMALIZED_STATUS_MAP[normalized] ?? null;
}
