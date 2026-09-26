import type { CourierPartner } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/crypto";
import { dtdcRequest, type DtdcCredentials } from "./dtdc-client";
import type {
  CourierProvider,
  QuoteInput,
  QuoteResult,
  ServiceabilityResult,
  CreateShipmentInput,
  CreateShipmentResult,
  TrackingResult,
} from "./types";

// DTDC runs its partner API on the "Shipsy" platform. The API server is a
// fixed host, https://app.shipsy.in, confirmed live in the API Playground's
// EXAMPLE/CURL tabs — not a per-account host, so this can be a sensible
// default rather than something DTDC has to issue per customer.
// Endpoint paths and payload shape below are confirmed against the
// playground's EXAMPLE tab only for Softdata Upload (create shipment).
// Serviceability / tracking / cancel paths follow the same
// `/api/client/integration/consignment/...` naming convention shown in the
// playground's endpoint list, but their request/response schemas have NOT
// been confirmed yet — check each one's own EXAMPLE tab once credentials
// are in hand, and adjust field names/paths here as needed.
// CourierApiConfig.apiKeyEncrypted stores the encrypted JSON blob
// {"apiKey":...,"customerCode":...,"hubCode":...}; baseUrl is stored
// plaintext on the same row (defaults to https://app.shipsy.in in the API
// config UI).
async function getCredentials(partner: CourierPartner): Promise<DtdcCredentials> {
  const apiConfig = await prisma.courierApiConfig.findUnique({ where: { courierPartnerId: partner.id } });
  if (!apiConfig?.apiKeyEncrypted || !apiConfig.baseUrl) {
    throw new Error(`DTDC is not fully configured for partner ${partner.name}`);
  }
  const { apiKey, customerCode, hubCode } = JSON.parse(decryptApiKey(apiConfig.apiKeyEncrypted));
  return { baseUrl: apiConfig.baseUrl, apiKey, customerCode, hubCode };
}

// Serviceability's request body is (near) identical to Softdata Upload's —
// same origin_details/destination_details/pieces_detail shape, same
// required fields (customer_code, service_type_id, origin/destination
// name+phone+address_line_1+pincode). Shared here so checkServiceability
// and getQuote (and createShipment) don't each re-derive the branch lookup
// and placeholder fields separately.
async function buildServiceabilityPayload(
  partner: CourierPartner,
  creds: DtdcCredentials,
  originPincode: string,
  destinationPincode: string,
  weightKg?: number
) {
  const branch = await prisma.courierBranch.findFirst({
    where: { courierPartnerId: partner.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    customer_code: creds.customerCode,
    hub_code: creds.hubCode,
    service_type_id: "", // TODO: DTDC-issued service type for this account, e.g. "PREMIUM"
    consignment_type: "forward",
    movement_type: "forward",
    action_type: "pickupandelivery",
    weight: weightKg != null ? String(weightKg) : undefined,
    origin_details: {
      name: branch?.name || partner.name,
      phone: branch?.contactPhone || partner.contactPhone,
      address_line_1: branch?.address || "",
      city: branch?.city || "",
      pincode: originPincode,
    },
    destination_details: {
      // No real consignee contact at serviceability-check time (the
      // interface only passes a pincode) — DTDC requires name/phone/
      // address_line_1 as non-empty strings, so these are placeholders,
      // not real destination-party data. Fine for a pure "is this pincode
      // servicable" check; revisit if DTDC's validation rejects blanks.
      name: "Recipient",
      phone: "0000000000",
      address_line_1: "NA",
      pincode: destinationPincode,
    },
    pieces_detail: [
      {
        description: "Shipment",
        weight: weightKg != null ? String(weightKg) : "0.5",
      },
    ],
  };
}

export const dtdcProvider: CourierProvider = {
  async checkServiceability(partner: CourierPartner, pincode: string): Promise<ServiceabilityResult> {
    const creds = await getCredentials(partner);
    // Request shape confirmed against DTDC's Consignment Serviceability
    // SCHEMA (2026-09-26) — same origin/destination/pieces_detail shape as
    // Softdata Upload. Response shape is NOT confirmed yet (no response
    // schema seen), so the fields read below are still a guess.
    const data = await dtdcRequest(creds, "/api/client/integration/consignment/serviceability", {
      method: "POST",
      body: JSON.stringify(await buildServiceabilityPayload(partner, creds, pincode, pincode)),
    });
    return { serviceable: !!(data?.serviceable ?? data?.is_serviceable ?? data?.data?.serviceable) };
  },

  async getQuote(partner: CourierPartner, input: QuoteInput): Promise<QuoteResult | null> {
    const creds = await getCredentials(partner);
    // TODO(confirm): DTDC's serviceability endpoint may not return a price
    // at all (rate cards for direct DTDC tie-ups are often agreed
    // out-of-band, unlike Shiprocket's aggregator model) — if so, quoting
    // for a DTDC API partner should fall back to a RateCard the same way a
    // MANUAL partner does, and this method should be revisited once the
    // real response shape is known.
    const data = await dtdcRequest(creds, "/api/client/integration/consignment/serviceability", {
      method: "POST",
      body: JSON.stringify(
        await buildServiceabilityPayload(partner, creds, input.pickupPincode, input.deliveryPincode, input.weightKg)
      ),
    });
    if (!data?.serviceable && !data?.is_serviceable) return null;
    const price = data?.price ?? data?.rate ?? data?.data?.price;
    if (price == null) return null;
    return {
      price: Number(price) || 0,
      etaDays: data?.eta_days ?? data?.data?.eta_days ?? undefined,
    };
  },

  async createShipment(partner: CourierPartner, input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const creds = await getCredentials(partner);

    // Full field set confirmed against DTDC's Softdata Upload SCHEMA
    // (2026-09-26). Required (*) fields: customer_code, service_type_id,
    // origin_details{name,phone,address_line_1,pincode},
    // destination_details{name,phone,address_line_1,pincode}, pieces_detail[].
    //
    // origin_details needs a pickup contact + address + pincode, but
    // CourierBranch (src/lib/actions/couriers.ts) only stores
    // name/address/city/contactPhone — no pincode field. Falls back to the
    // partner's first active branch for name/address/city/phone, and
    // input.pickupPincode (the order's own pickup pincode) to fill the
    // required pincode. If a partner has multiple branches, this always
    // uses the first active one — fine for a single-warehouse setup, but
    // revisit (pass the actual dispatch branch through) once a partner has
    // more than one.
    const branch = await prisma.courierBranch.findFirst({
      where: { courierPartnerId: partner.id, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const payload = {
      reference_number: input.orderId,
      customer_code: creds.customerCode,
      customer_reference_number: input.orderId,
      hub_code: creds.hubCode,
      service_type_id: "", // TODO: DTDC-issued service type for this account, e.g. "PREMIUM"
      consignment_type: "forward",
      movement_type: "forward",
      // "pickupandelivery" (not the example's "single_pickup") since a
      // logistics order needs DTDC to both collect from origin and deliver
      // to destination in one booking — reconfirm once a live booking
      // succeeds or fails on this value.
      action_type: "pickupandelivery",
      load_type: "NON-DOCUMENT",
      description: input.packageDescription || "Shipment",
      notes: "",
      cod_amount: String(input.codAmount ?? 0),
      cod_collection_mode: input.codAmount ? "cash" : "",
      declared_value: String(input.codAmount ?? 0),
      declared_value_without_tax: String(input.codAmount ?? 0),
      weight: String(input.weightKg),
      weight_unit: "kg",
      origin_details: {
        name: branch?.name || partner.name,
        phone: branch?.contactPhone || partner.contactPhone,
        address_line_1: branch?.address || "",
        city: branch?.city || "",
        pincode: input.pickupPincode,
      },
      destination_details: {
        name: input.deliveryContactName,
        phone: input.deliveryContactPhone,
        address_line_1: input.deliveryAddress,
        city: input.deliveryCity || "",
        state: input.deliveryState || "",
        pincode: input.deliveryPincode,
      },
      pieces_detail: [
        {
          description: input.packageDescription || "Shipment",
          declared_value: String(input.codAmount ?? 0),
          cod_amount: String(input.codAmount ?? 0),
          weight: String(input.weightKg),
          weight_unit: "kg",
        },
      ],
    };

    const data = await dtdcRequest(creds, "/api/client/integration/consignment/upload/softdata/v2", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const awb = data?.awb_number || data?.reference_number || data?.data?.awb_number;
    if (!awb) throw new Error(JSON.stringify(data));

    // Label Generation (Link) — request/response confirmed (2026-09-26):
    // GET .../shippinglabel/url?reference_number=<awb>, returns
    // {success, reference_number, label_url}. Non-fatal if it fails: the
    // shipment itself was already booked successfully above, a missing
    // label is a lesser problem than losing the booking.
    let labelUrl: string | undefined;
    try {
      const labelQuery = new URLSearchParams({ reference_number: String(awb) });
      const labelData = await dtdcRequest(creds, `/api/client/integration/consignment/shippinglabel/url?${labelQuery}`);
      labelUrl = labelData?.label_url || undefined;
    } catch {
      labelUrl = undefined;
    }

    return { providerRef: String(awb), labelUrl };
  },

  async trackShipment(partner: CourierPartner, providerRef: string): Promise<TrackingResult> {
    const creds = await getCredentials(partner);
    // Path, method (GET) and query params confirmed against DTDC's
    // "Consignment Tracking" SCHEMA (2026-09-26): a genuine single-AWB
    // lookup by reference_number, unlike "Fetch Consignments" (a
    // multi-result filter query — kept available via fetchConsignments
    // below for bulk/status-list use cases, but not used here since this
    // is the simpler, purpose-built endpoint for tracking one shipment).
    // Response shape confirmed against the "Client Tracking Consignment
    // Response" SCHEMA (2026-09-26): flat (not nested under `data`), with a
    // top-level `status*` string plus a full `events[]` history. The
    // per-event vocabulary (`type`/`status_external`/`execution_status`) is
    // more granular than the overall `status` — using the overall status
    // here to match DTDC_STATUS_MAP's coarse PICKED UP/IN TRANSIT/DELIVERED
    // style entries in the tracking-update webhook route; the raw payload
    // (incl. events[]) is still returned in full via `raw` for anything
    // needing finer detail later.
    const query = new URLSearchParams({
      reference_number: providerRef,
      get_raven_link: "true",
    });
    const data = await dtdcRequest(creds, `/api/client/integration/consignment/track?${query}`);
    return {
      status: data?.status || "UNKNOWN",
      raw: data,
    };
  },

  async cancelShipment(partner: CourierPartner, providerRef: string): Promise<{ success: boolean }> {
    const creds = await getCredentials(partner);
    // Confirmed (2026-09-26): dedicated Cancel Consignment endpoint,
    // POST .../consignment/cancellation/v2, body {reference_number,
    // cancellation_reason}, response {"status": "OK"}. (DTDC's generic
    // "Consignment Status Update" event endpoint also supports a `cancel`
    // event, but this dedicated endpoint is the one actually named "Cancel
    // Consignment" in the playground, so it's the intended path.)
    const data = await dtdcRequest(creds, "/api/client/integration/consignment/cancellation/v2", {
      method: "POST",
      body: JSON.stringify({
        reference_number: providerRef,
        cancellation_reason: "Cancelled via an-logistics",
      }),
    });
    return { success: data?.status === "OK" };
  },
};
