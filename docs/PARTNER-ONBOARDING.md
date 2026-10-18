# Partner onboarding implementation

## Operator workflow

1. Share `/`. Applications are collected at `/signup`; old `/portal/signup` and `/book` links redirect there. Public signup does not create users. The old anonymous booking action is disabled.
2. In **Telegram**, enable **New partner application**, enter your operations chat ID, and configure `TELEGRAM_BOT_TOKEN`. Notification failures do not discard applications; the onboarding inbox remains the source of truth. Notifications are currently best effort, without a retry queue.
3. An **INTERNAL tenant ADMIN** opens **Onboarding**, contacts the applicant, and saves the stage and notes. This creates an inactive customer record. Existing customer accounts are not retroactively put through onboarding.
4. Save a template version with your reviewed clauses. The template library is intentionally generic: customer services, reseller, courier-partner, NDA, data-processing, confidentiality, addendum, rate-card, settlement, referral and other agreement types can each have their own version. Payment terms remain blank until agreed in discussions and are recorded per counterparty in the signed version. The issuance workflow currently binds documents to shipping customers; it does not replace the separate courier-side commercial agreement workflow.
5. Prepare a partner agreement from a saved template. Customize its clauses and INR rate bands, confirm legal review, and set the effective date. Terms and rates are copied to the agreement; its customer rate card starts inactive.
6. Open the agreement preview. Export the reviewed terms and rate schedule to PDF, including the Zoho signature text tags. Upload it to approved private document storage and enter its HTTPS URL in **Agreements → Edit**. Confirm that the PDF matches the recorded agreement. `AGREEMENT_DOCUMENT_HOSTS` must allow the storage hostname. PDF generation/upload is a manual step in this release.
7. **Send for e-sign** uploads and submits the PDF through Zoho's separate create/submit endpoints. Remote IDs are saved before submission. **Resume / check send** reuses an existing envelope. A timed-out upload without a stored remote ID stays in SENDING for operator reconciliation; never blindly create a duplicate. Do not manually reset this state without checking Zoho.
8. Configure the completion webhook. The server checks the shared webhook secret and independently confirms completion with Zoho before activating the agreed rates. Duplicate callbacks do not repeat rate activation. Sent/signed documents are immutable; amendments require a new agreement.
9. Back in **Onboarding**, allocate one or more active couriers and create the login. Activation requires a signed rate-card agreement and happens in a serializable transaction. The email is the login ID. The temporary password is displayed once to the admin for secure delivery; a first-login password change is required. This implementation does not automatically email credentials.
10. Customers use their assigned couriers and agreed rate card. Booking captures sender/recipient contacts and addresses, pincodes, cities/states, weight, dimensions, contents, declared value, preferred pickup date, invoice/e-way-bill references and a goods declaration. The present form is for a single prepaid package. COD, multiple pieces, insurance and restricted goods require operations coordination.

## Database rollout

Migration: `prisma/migrations/20261018000000_partner_onboarding/migration.sql`.
It adds application/template/allocation tables, agreement snapshots, a SENDING state, a Telegram event and booking details/idempotency columns. It does not delete existing records.

The configured database is remote. The migration was generated, not applied. Back up the intended database and run `npx prisma migrate deploy` in the appropriate environment before deploying the new application. Run `npx prisma generate` during installation/build.

## Required configuration and acceptance checks

- Operator identity is currently set to AN Group, GSTIN 37EOZPK9605G1Z5, 1203, opposite Ice Factory, Bondapalle, Gotalm, Vizianagaram, with connectwithangroup@gmail.com for contact. Confirm the exact registered-address spelling and publish a dedicated grievance/retention policy before marketing the public form. The starter clauses are a drafting aid, not a legally certified set of agreements.
- Configure an approved PDF storage host, Zoho OAuth credentials/data centre, production API entitlement, webhook secret, and the email provider for signed copies. Verify a real create → submit → signed webhook → customer-rate activation round trip using appropriate test recipients. Do not use Zoho test envelopes as enforceable contracts.
- Configure DTDC credentials, customer code, hub and **service type issued for your account**, and enable the API configuration only after acceptance testing. Re-enter all DTDC credential fields when changing the service code. Never substitute the COD amount for declared goods value.
- Verify DTDC account-specific serviceability, response schema, AWB, label and pickup behaviour. Some original adapter endpoints remain based on incomplete provider documentation. The code does not claim that an AWB guarantees a physical pickup or the preferred pickup date. Invoice/e-way-bill references and preferred pickup date are stored for operations; their DTDC field mapping still needs account documentation.
- API timeout/uncertain booking outcomes remain visible as `RECONCILIATION_REQUIRED`; inspect the provider by the stable order reference before retrying. The same form request cannot create another order. A new form/browser session gets a new key, so operations must also check for duplicate commercial shipments.
- Current pricing is a flat INR amount per zone/weight band. Zones still use the project's pincode-prefix approximation. Automated volumetric billing, GST/surcharges, COD/RTO fees, customer/reseller commission settlement, credit limits and payment collection are **not implemented by this change**. Record and reconcile those commercially before enabling services that depend on them. Existing courier commissions are still used for platform fees.
- Add deployment-level abuse/rate limits for the public application form. It currently validates input, records contact consent, rejects the honeypot and deduplicates email addresses, but does not provide a distributed abuse-control service.
- Template and application lists show recent records (applications are limited to 200); full search/pagination, detailed immutable admin audit history, automated KYC and document uploads remain follow-up work.
- Record rejection/withdrawal and deletion/retention procedures operationally. A full consent-rights and retention automation system is not included.

## Legal review references

- [India Code — Information Technology Act, 2000](https://www.indiacode.nic.in/indiacode/handle/123456789/1999?locale=en): electronic contracting recognition does not establish that every agreement, signature method or stamp-duty treatment is valid for every transaction.
- [Zoho create and submit workflow](https://www.zoho.com/sign/api/getting-started-with-zoho-sign-api.html).
- [Zoho signature text tags](https://help.zoho.com/portal/en/kb/zoho-sign/user-guide/sending-a-document/articles/automatic-field-addition-in-zoho-sign).

Indian counsel should confirm the parties, authority, commercial schedules, applicable state stamp duty, execution method, liability/insurance, consumer rights, taxes, data protection, dispute provisions and any courier/franchise-specific obligations. Do not present the starter as government-approved or use unfilled bracketed terms.

## Verification

Run `node --test tests/onboarding.test.cjs` for isolated server-action tests covering consent/phone validation, application notifications without user creation, signed-agreement activation gates, immutable signed documents, webhook idempotency, signed-rate fallback protection, weight boundaries, courier allocation, duplicate booking and DTDC sender/value/dimension mapping.

Tests isolate external systems and do not send messages or create shipments. Live end-to-end acceptance still needs a migrated test database and provider credentials.
