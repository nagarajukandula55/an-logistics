# Courier integration contract

Courier integrations use one small two-way contract.

## Outbound from AN Logistics

The courier adapter receives a shipment through the configured provider implementation. A new provider only needs to implement the `CourierProvider` interface in `src/lib/courier-providers/`:

- `checkServiceability(partner, deliveryPincode)`
- `getQuote(partner, shipment)`
- `createShipment(partner, shipment)` when the provider supports booking
- `getTrackingStatus(partner, providerRef)` for reconciliation

The platform sends the courier the shipment address, contacts, declared value, chargeable weight, dimensions, package description and optional COD value. The provider returns a stable reference and optional label URL.

## Inbound to AN Logistics

POST status events to:

```text
/api/webhooks/tracking-update
```

Authenticate with the shared `x-api-key` header using `DTDC_WEBHOOK_SECRET`. The minimum payload is:

```json
{
  "courier_partner_reference_number": "AWB123",
  "type": "delivered"
}
```

The route maps provider statuses to the platform lifecycle, ignores unknown sub-statuses safely, is idempotent for repeated statuses, and notifies the tenant, customer and operations channels.

## Calling AN Logistics from a client or reseller system

Use the tenant API key and the existing endpoints:

- `POST /api/v1/rates` with `rates:read`
- `POST /api/v1/shipments` with `orders:create`
- `GET /api/v1/shipments/:trackingCode` with `orders:read`
- `POST /api/v1/shipments/:trackingCode/cancel` with `orders:create`

This keeps integration to a quote → book → track → cancel flow. API keys are scoped per tenant and stored as hashes.
