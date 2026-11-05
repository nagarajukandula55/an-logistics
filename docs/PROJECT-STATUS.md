# AN Logistics — current project status

Reviewed: 5 November 2026. Source baseline: `622d141`.

## Overall assessment

The core operations platform and approval-gated customer shipping workflow are implemented. Production readiness remains unverified: local code checks do not establish that database migrations, deployment configuration or external integrations are working in the live environment.

The current commercial model now distinguishes onboarded **Clients** (ship their own goods) from **Resellers** (purchase shipping capacity for resale). Both use customer-specific agreed rate cards and must maintain wallet funds. A booking debits the agreed rate plus the account's GST percentage in one database transaction before the shipment is created.

The reliability and mobile pass added serializable wallet booking transactions, retry-safe contention handling, standard browser security headers, a horizontally scrollable mobile portal navigation, and stacked small-screen quote fields.

Role surfaces are separated: internal Admin/operations users use the protected operations console, customer users are redirected to the portal, and the portal identifies Client versus Reseller/Agent workspaces with the relevant rate and margin context. Courier connectivity is documented as one outbound adapter plus one authenticated inbound webhook contract in [COURIER-INTEGRATION.md](COURIER-INTEGRATION.md).

The supplied DTDC policy pack is catalogued in [DTDC-POLICY-REFERENCE.md](DTDC-POLICY-REFERENCE.md). DTDC channel-partner rules are retained as reference and are not automatically applied to AN Logistics pricing or customer terms.

## Implemented in the repository

| Area | Current scope |
| --- | --- |
| Operations | Dashboard, orders, fleet dispatch, courier assignment, lifecycle updates, proof-of-delivery details and public tracking |
| Accounts | Tenant management, roles, API keys, customer portal and mandatory temporary-password changes |
| Partner onboarding | Public applications, admin review, versioned agreement templates, signed-agreement activation gates and courier allocation |
| Agreements | Zoho Sign workflow, completion webhook, document access and renewal-reminder endpoint |
| Shipping | Manual-provider and DTDC adapters, serviceability/rates, customer booking, shipment APIs, cancellation and tracking reconciliation |
| Pricing | Courier and customer rate cards; volumetric/chargeable-weight calculation using a default divisor of 5000 |
| Billing | Invoices, settlements, customer wallet ledger, and optional external accounting/wallet sync |
| Notifications | Tenant webhooks, customer/operations Telegram flows and email integration |
| Package measurement | Image capture UI and forwarding endpoint; automatic measurement requires an external service |
| Quotations | Database migration, draft creation action and branded HTML renderer; no callers of the quotation actions were found in the application UI |
| Operations agents | Authenticated `/api/agents/ops` endpoint with onboarding, pricing, wallet, shipment, tracking, billing and notifications agents; every run is persisted in `AgentRun` |

These entries describe source implementation, not live acceptance results.

## Verification from this review

- Onboarding tests: **10 passed, 0 failed** (`node --test tests/onboarding.test.cjs`). Persistence and providers are mocked; these are not database or external-service acceptance tests.
- TypeScript: **passed** (`npx tsc --noEmit`).
- Lint: **failed — 11 errors and 1 warning** (`npm run lint`). Two application errors concern an unescaped apostrophe in `CourierAssignPanel.tsx` and synchronous state updates inside an effect in `NewOrderForm.tsx`. Nine errors concern CommonJS imports/module naming in the isolated test harness. The warning is an unused operations-notification import in tracking reconciliation.
- Production build: **failed in this environment** (`npm run build`). Prisma Client generation succeeded, then Turbopack crashed while processing `globals.css`: its Node child process exited before connection. This does not establish a CSS source defect; reproduce in the deployment/build environment before diagnosing the cause. Production compilation remains unverified.
- Maintenance warnings: Next.js deprecates the `middleware.ts` convention in favour of `proxy.ts`; Prisma warns that `package.json#prisma` configuration will be removed in Prisma 7.
- No database migrations, seed operations, real bookings, messages or signing requests were intentionally executed during the review.

## Remaining work and release checks

1. **Confirm deployment and database state.** Migration files exist through the quotation workflow migration. Their application to the target database was not checked. Use the production-readiness checklist before rollout.
2. **Scheduled jobs are opt-in.** No Vercel cron schedules are configured. Tracking reconciliation, agreement renewals and agent monitoring remain protected endpoints for a future external scheduler or manual operations use.
3. **Accept external integrations.** Verify DTDC account-specific service codes, serviceability, booking, labels, cancellation and tracking; Zoho signing and rate activation; email; Telegram; and any accounting/wallet connections in a controlled environment.
4. **Complete the quotation operator workflow.** Wire the existing actions and renderer into a usable review/export flow and verify validation and numbering under concurrent creation.
5. **Complete operational gaps.** Agreement PDF export/upload is manual. Public signup needs deployment-level abuse controls. Self-service password recovery, proof-of-delivery photo upload and broader admin audit/search capabilities remain follow-up items.
6. **Confirm commercial coverage.** Pincode-prefix zoning is approximate. Existing billing and wallet modules should not be treated as proof that every booking path handles taxes, surcharges, COD/RTO, refunds, credit and reseller settlement end to end.
7. **Expand acceptance coverage.** Current automated tests focus on onboarding and selected booking safeguards. Browser workflows, real database transactions and provider failures still need acceptance testing.

## Documentation notes

The README's historical scope predates the portal, DTDC adapter, billing, wallets and volumetric-weight implementation. Use this report for the current inventory, [partner onboarding](PARTNER-ONBOARDING.md) for operating details, [environment setup](ENVIRONMENT-SETUP.md) for configuration and [production readiness](PRODUCTION-READINESS.md) for release checks. Statements in older documents about migration application and missing features are historical, not independently verified current deployment facts.
