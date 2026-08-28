# AN Logistics

Internal operations console for AN Logistics: order intake, dispatch (driver +
vehicle assignment), and delivery tracking, including a public no-auth
tracking page for a shipment's tracking code.

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

**In this slice:** order intake, dispatch (assign driver + vehicle to an
order), delivery lifecycle status updates (`ASSIGNED → PICKED_UP →
IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED/FAILED`), proof-of-delivery capture,
fleet setup (drivers, vehicles), and a public `/track/[code]` page — the one
customer-facing surface right now.

**Planned next:** a customer self-service portal. The schema already models
`Customer` and `User.role = CUSTOMER` as first-class, so that portal can be
built without a schema rewrite — it just needs its own routes, auth flow, and
an order-creation/tracking UI scoped to a logged-in customer's own orders.

**Known gaps:**
- No password-reset / change-password flow (seeded admin password must be
  rotated manually against the database for now).
- No file upload for proof-of-delivery photos (`ProofOfDelivery.photoUrl` is
  modeled but not yet wired to any upload UI).
- No pagination on the orders list (capped at the 100 most recent).
- Driver/vehicle records currently can't be edited or deactivated from the UI
  — only created.
