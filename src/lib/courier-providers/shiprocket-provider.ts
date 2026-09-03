import type { CourierPartner } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/crypto";
import { shiprocketRequest, type ShiprocketCredentials } from "./shiprocket-client";
import type {
  CourierProvider,
  QuoteInput,
  QuoteResult,
  QuoteOption,
  ServiceabilityResult,
  CreateShipmentInput,
  CreateShipmentResult,
  TrackingResult,
} from "./types";

// CourierApiConfig.apiKeyEncrypted stores the encrypted JSON blob
// {"email":...,"password":...} for Shiprocket; baseUrl is stored plaintext
// on the same row since it isn't sensitive. Reading credentials per-partner
// (rather than a single global env var, as angroup does today) is what
// lets multiple Shiprocket-backed partners coexist — e.g. our own account
// and a client tenant's own Shiprocket account.
async function getCredentials(partner: CourierPartner): Promise<ShiprocketCredentials> {
  const apiConfig = await prisma.courierApiConfig.findUnique({ where: { courierPartnerId: partner.id } });
  if (!apiConfig?.apiKeyEncrypted || !apiConfig.baseUrl) {
    throw new Error(`Shiprocket is not fully configured for partner ${partner.name}`);
  }
  const { email, password } = JSON.parse(decryptApiKey(apiConfig.apiKeyEncrypted));
  return { baseUrl: apiConfig.baseUrl, email, password };
}

export const shiprocketProvider: CourierProvider = {
  async checkServiceability(partner: CourierPartner, pincode: string): Promise<ServiceabilityResult> {
    const creds = await getCredentials(partner);
    const data = await shiprocketRequest(
      creds,
      `/courier/serviceability/?pickup_postcode=${pincode}&delivery_postcode=${pincode}&cod=0&weight=0.5`
    );
    const available = data?.data?.available_courier_companies ?? [];
    return { serviceable: available.length > 0 };
  },

  async getQuote(partner: CourierPartner, input: QuoteInput): Promise<QuoteResult | null> {
    const creds = await getCredentials(partner);
    const data = await shiprocketRequest(
      creds,
      `/courier/serviceability/?pickup_postcode=${input.pickupPincode}` +
        `&delivery_postcode=${input.deliveryPincode}&cod=0&weight=${input.weightKg}`
    );
    const available = data?.data?.available_courier_companies ?? [];
    if (available.length === 0) return null;

    // Cheapest option — the caller (getQuotesForOrder) is what ranks
    // partners against each other; within a single Shiprocket-backed
    // partner, surface its best price.
    const cheapest = available.reduce((best: any, c: any) =>
      !best || Number(c.freight_charge) < Number(best.freight_charge) ? c : best
    );

    return {
      price: Number(cheapest.freight_charge) || 0,
      etaDays: cheapest.estimated_delivery_days ?? undefined,
      providerCourierId: String(cheapest.courier_company_id),
    };
  },

  async getQuotes(partner: CourierPartner, input: QuoteInput): Promise<QuoteOption[]> {
    const creds = await getCredentials(partner);
    const data = await shiprocketRequest(
      creds,
      `/courier/serviceability/?pickup_postcode=${input.pickupPincode}` +
        `&delivery_postcode=${input.deliveryPincode}&cod=0&weight=${input.weightKg}`
    );
    const available = data?.data?.available_courier_companies ?? [];

    return available
      .map((c: any) => ({
        price: Number(c.freight_charge) || 0,
        etaDays: c.estimated_delivery_days ?? undefined,
        providerCourierId: String(c.courier_company_id),
        label: c.courier_name,
      }))
      .sort((a: QuoteOption, b: QuoteOption) => a.price - b.price);
  },

  async createShipment(partner: CourierPartner, input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const creds = await getCredentials(partner);

    if (!input.providerCourierId) {
      throw new Error("providerCourierId is required to book a Shiprocket shipment");
    }

    const payload = {
      order_id: input.orderId,
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: "Primary",
      billing_customer_name: input.deliveryContactName,
      billing_last_name: "",
      billing_address: input.deliveryAddress,
      billing_city: input.deliveryCity || "",
      billing_pincode: input.deliveryPincode,
      billing_state: input.deliveryState || "",
      billing_country: "India",
      billing_phone: input.deliveryContactPhone,
      shipping_is_billing: true,
      order_items: [
        {
          name: input.packageDescription || "Shipment",
          sku: input.orderId,
          units: 1,
          selling_price: input.codAmount ?? 0,
        },
      ],
      payment_method: input.codAmount ? "COD" : "Prepaid",
      sub_total: input.codAmount ?? 0,
      length: 10,
      breadth: 10,
      height: 10,
      weight: input.weightKg,
    };

    const createOrder = await shiprocketRequest(creds, "/orders/create/adhoc", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const shipmentId =
      createOrder?.shipment_id || createOrder?.shipmentId || createOrder?.shipment_details?.shipment_id;
    if (!shipmentId) throw new Error(JSON.stringify(createOrder));

    const awbResponse = await shiprocketRequest(creds, "/courier/assign/awb", {
      method: "POST",
      body: JSON.stringify({ shipment_id: shipmentId, courier_id: Number(input.providerCourierId) }),
    });

    const awb = awbResponse?.response?.data?.awb_code || awbResponse?.awb_code;
    if (!awb) throw new Error(JSON.stringify(awbResponse));

    const labelResponse = await shiprocketRequest(creds, "/courier/generate/label", {
      method: "POST",
      body: JSON.stringify({ shipment_id: [shipmentId] }),
    });

    return {
      providerRef: String(awb),
      labelUrl: labelResponse?.label_url || labelResponse?.data?.label_url || undefined,
    };
  },

  async trackShipment(partner: CourierPartner, providerRef: string): Promise<TrackingResult> {
    const creds = await getCredentials(partner);
    const response = await shiprocketRequest(creds, `/courier/track/awb/${providerRef}`);
    const trackingData = response?.tracking_data;
    return {
      status: trackingData?.shipment_status || trackingData?.current_status || "UNKNOWN",
      raw: response,
    };
  },

  async cancelShipment(partner: CourierPartner, providerRef: string): Promise<{ success: boolean }> {
    const creds = await getCredentials(partner);
    // Shiprocket cancels by shipment/order id, not AWB — callers that only
    // have the AWB should track first to resolve the underlying order id;
    // kept simple here since MANUAL/API partner cancel flows differ enough
    // that a shared abstraction isn't worth it yet.
    const response = await shiprocketRequest(creds, "/orders/cancel", {
      method: "POST",
      body: JSON.stringify({ ids: [Number(providerRef)] }),
    });
    return { success: !!(response?.message || response?.status_code === 200) };
  },
};
