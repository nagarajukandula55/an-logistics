# AN Logistics

Operations console for AN Logistics, a courier aggregator marketplace: order
intake, dispatch to either your own fleet (driver + vehicle) or a third-party
courier partner, delivery tracking, and courier-partner onboarding — plus a
public no-auth tracking page for a shipment's tracking code.

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind v4)
- PostgreSQL via Prisma 6
- Auth.js v5 (Credentials provider, JWT sessions, Prisma adapter)
- Server Actions for all writes (no separate REST layer)

## Setup

1. Copy the env file and fill in a real Postgres connection string (Neon,
   Supabase, or any Postgres instance) and an auth secret:

   ```bash
   cp .env.example .env
   # then edit .env — set DATABASE_URL, and AUTH_SECRET (openssl rand -base64 32)
   ```

2. Install dependencies (already done if you cloned this repo as-is):

   ```bash
   npm install
   ```

3. Create the schema in your database:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Seed one admin user so you can log in:

   ```bash
   npx prisma db seed
   ```

   This creates `admin@an-logistics.com` / `ChangeMe123!` unless you set
   `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in your environment first. Sign
   in and treat that password as temporary — there's no in-app change-password
   flow yet, so update it directly in the database (or via a script) if you
   keep the seeded account.

5. Run the app:

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`, sign in, and start creating orders.

## Scope

**In this slice:** order intake (now including optional pickup/delivery
pincodes), dispatch to either your own fleet (assign driver + vehicle) or a
courier partner, delivery lifecycle status updates (`ASSIGNED → PICKED_UP →
IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED/FAILED`), proof-of-delivery capture,
fleet setup (drivers, vehicles), and a public `/track/[code]` page — the one
customer-facing surface right now.

### Courier aggregator marketplace

The platform is a courier aggregator: courier partners onboard onto the
platform, and each order can be fulfilled either by your own fleet
(`Order.fulfillmentType = SELF_FLEET`, the original model, unchanged) or by a
courier partner (`COURIER_PARTNER`). This slice adds:

- **Courier partner onboarding** (`/couriers`, `/couriers/new`) — partner
  profile, contact details, integration type (manual/API), and default
  commission (percent or flat).
- **Partner lifecycle** — `PENDING → ACTIVE ⇄ SUSPENDED → TERMINATED`,
  changed from the partner detail page (`/couriers/[id]`).
- **Branches and service areas** — each partner can have multiple branches,
  each covering one or more pincodes (`ServiceArea`), used to route orders.
- **Commission agreements** — versioned `CourierAgreement` records per
  partner; creating a new `ACTIVE` agreement automatically expires the prior
  one, so exactly one is authoritative at a time. Falls back to the
  partner's default commission when there's no active agreement.
- **API config** — provider/base URL/webhook fields per partner, clearly
  labeled manual-only until marked active with a non-"manual" provider.
- **Dispatch routing with live quote comparison** — on an order's detail
  page, if it has a `deliveryPincode`, the dispatcher sees a table of every
  ACTIVE courier partner with a branch covering that pincode, each row
  showing the pincode-derived zone, quoted price, computed platform fee, and
  ETA (when the provider returns one), with a per-row Assign action. This is
  additive — the self-fleet flow is unchanged when no courier is chosen.
- **Rate cards** (`/couriers/[id]`) — each courier partner can define
  versioned `RateCard`s made of `RateCardSlab` rows (zone + weight band +
  price). Creating a new rate card automatically deactivates the partner's
  prior active one, mirroring the agreement supersede pattern. Zones are
  free text (e.g. `LOCAL`/`REGIONAL`/`NATIONAL`) so partners can define their
  own; the platform derives a zone for a given shipment with a deterministic
  pincode-prefix heuristic (`src/lib/zone.ts`): same first 3 digits of
  pickup/delivery pincode → `LOCAL`, same first 2 digits only → `REGIONAL`,
  otherwise `NATIONAL`. This is a real, deliberate approximation (common in
  Indian logistics zoning), not a placeholder — real distance/geocoding-based
  zoning is not built.
- **Pluggable courier-provider adapter** (`src/lib/courier-providers/`) — a
  `CourierProvider` interface (`checkServiceability`, `getQuote`) that both
  serviceability checks and quote generation go through. `MANUAL` partners
  are served by `manual-provider.ts`, which answers from our own
  `ServiceArea` and `RateCard` data (no external calls). Adding a real
  per-courier adapter later (Delhivery, DTDC, etc.) is a new file
  implementing `CourierProvider`, wired into `registry.ts` by
  `CourierApiConfig.provider` — no other code changes needed.

**Planned next phase (explicitly out of scope for this slice):**
- Customer-facing booking/tracking portal beyond the existing `/track/[code]`
  page. The schema already models `Customer` and `User.role = CUSTOMER` as
  first-class, so this can be built without a schema rewrite.
- Real HTTP integration with courier partner APIs — `CourierApiConfig`
  fields are captured, and `getCourierProvider()` resolves an `API`-type
  partner to a stub whose methods throw
  `"Real API integration not yet implemented for provider: <name>"`. This is
  the intended final behavior for this slice, not a TODO left broken; the
  quote-comparison table shows those partners as "no rate card configured"
  rather than failing.
- Payout / settlement / invoicing / wallets for courier partners.
- Fully automatic, no-human order-to-courier assignment (routing today
  surfaces serviceable branches for a human dispatcher to pick from;
  `Order.assignmentMethod` is modeled with an `AUTO` value for this future
  work but only `MANUAL` is ever written today).

**Known gaps:**
- No password-reset / change-password flow (seeded admin password must be
  rotated manually against the database for now).
- No file upload for proof-of-delivery photos (`ProofOfDelivery.photoUrl` is
  modeled but not yet wired to any upload UI).
- No pagination on the orders list (capped at the 100 most recent).
- Driver/vehicle records currently can't be edited or deactivated from the UI
  — only created.
- `CourierApiConfig.apiKeyEncrypted` is stored as plain text, not actually
  encrypted — needs real encryption-at-rest before any real API key is put
  in it.
- Platform fee (`Order.platformFeeAmount`) recorded at assignment time is
  still computed against `codAmount` as a stand-in for real order/shipment
  value, and is left `null` when an order has no COD amount rather than
  being fabricated. The quote-comparison table's platform fee, by contrast,
  is computed against the courier's quoted rate-card price. Reconciling
  these two into one order-value model is a planned follow-up.
- A courier partner with no active `RateCard`, or one whose slabs don't
  cover the shipment's zone/weight, shows as "no rate card configured" in
  the quote table rather than being omitted — a real "no quote" state.
- Older orders (and any order created without a delivery pincode) have no
  `deliveryPincode`, so courier routing can't suggest branches for them —
  the dispatch panel shows an empty state in that case rather than erroring.
