# DTDC policy and operations reference pack

Reviewed from the additional PDFs supplied on 5 November 2026. These are DTDC documents. They are retained as reference material for the AN Logistics DTDC project and are not automatically treated as AN Logistics policy, customer terms, or pricing rules.

## Commercial and channel-partner policies

| Source | Topic | Useful implementation signal |
| --- | --- | --- |
| Royalty_Charges_Partners | Freedom royalty | A 5% royalty is described for outstation/rural Freedom sales; the base excludes risk surcharge and GST and covers domestic services. This belongs in a DTDC CP settlement module only after the applicable CP agreement is confirmed. |
| CPDP-Rate-Policy | CPDP rates | Discounted CPDP rates, TS revenue, customer billing validation and rate governance. Do not silently apply this to AN customer rate cards. |
| CPDP_Audit_Policy | Audit | Customer invoices and GSTR-1 may be required to validate customer rates and billing; differences may produce debit-note or royalty adjustments. This supports an audit evidence checklist. |
| CPDP-Policy-Minimum-CP-TS-Revenue | Minimum revenue | Minimum monthly CP TS revenue requirements are described for CPDP codes. This belongs in a monitoring alert, not shipment pricing. |
| SFMF_New-_Policy | Incentives | SF/MF fixed and variable payout concepts. These are partner incentive rules, not customer invoice rules. |
| Non_Branding_Surcharge_Policy | Branding | Non-branding/rebranding surcharge and channel-partner outlet requirements. Needs a confirmed applicability flag before any charge is added. |
| CP_COD_Remittance_Policy | COD remittance | COD outstanding thresholds, D+1 remittance expectations and escalating booking/FDM restrictions. This is a strong candidate for a COD compliance dashboard. |
| CP-Closure-Policy | Closure | Voluntary, absconding, legal, automatic and termination closure workflows with retention interviews and approvals. This supports a partner offboarding workflow. |

## Operations and booking

| Source | Topic | Useful implementation signal |
| --- | --- | --- |
| Pickup_PPN_Guidelines | Paid pickup network | Daily pickup assignment, acceptance, failed pickup and cancellation monitoring through the DTDC dashboard. Supports pickup exception statuses and operations queues. |
| EComm_Ops_Policy | E-commerce delivery | Same-day/24–48 hour first attempt expectations, same-day delivery/non-delivery updates, final NDR by the sixth day and return-to-branch handling. These should become configurable SLA alerts, not hardcoded assumptions for every service. |
| Ops_Threshold_Policy | PDN payout thresholds | PDN payout and operational threshold rules. Requires complete table extraction and a confirmed service mapping before automation. |
| PDN_Policy_2024 | PDN changes | Day-0 NDR timing, Day-1 delivery deduction changes and prepaid PDN handling for e-commerce RTOs. Candidate for a policy version and audit calculator. |
| Digital-CN-Expiry-Policy | Digital CN | Transition to digital CN and booking/document expiry behavior. Candidate for document expiry reminders and booking validation. |
| Sender-onboarding-booking-flow-Phase-2 | International booking | EFR/PUDO international flow, shipment type, purpose, documents and customs data. This should be a separate international booking flow from domestic booking. |

## Security, continuity and capability material

| Source | Topic | Handling |
| --- | --- | --- |
| Disaster-Recovery-Policy-DTDC-Express-Limited | DTDC business continuity | Corporate DTDC internal/proprietary material. Use only as a reference for AN Logistics continuity planning; do not reproduce its internal controls as if they were AN controls. |
| ISMS-Information-Security-policy-and-objectives-DTDC-Express-Limited | DTDC information security | Corporate DTDC policy. It supports security-control ideas but does not certify AN Logistics. |
| DTDC-Express-Limited-27001-2025 | ISO certificate | Evidence about DTDC's certification scope and validity, not AN Logistics certification. Do not display it as an AN credential. |
| DTDC-WorldWyde-Capability-Deck_2026 | International capability | Product/capability overview; useful for future international service selection. |
| DTDC-WorldWyde-International-Tech-Enhancements | International technology | EFR and international documentation/visibility improvements; candidate input for a later international module. |
| Channel_Partners_Retail-Guidelines-2023 | Outlet branding | DTDC channel-partner outlet branding guidance. This must not overwrite AN Logistics branding or letterhead. |

## Image-only/template files

`A4-Table-Top-1.pdf`, `A4-Table-Top-2.pdf`, `A3-Table-Top-1.pdf`, `A3-Table-Top-2.pdf` and `GPI-Letter-Format-1.pdf` have little or no extractable text. Their visual tables and letter layout should be reviewed page-by-page before rate values or form fields are transcribed into the application.

## What is and is not implemented

Already represented in the application: DTDC rate/quotation concepts, GST, volumetric weight, RTO notes, reseller/client pricing separation, customer invoices, courier booking/tracking/cancellation, authenticated tracking webhook, and document templates.

Not automatically applied from this pack: royalty, CPDP debit notes, minimum CP revenue enforcement, PDN deductions, COD blocking, branding surcharges, closure approvals, outlet branding, international customs flow, or DTDC corporate security claims. These require the applicable AN/DTDC agreement, complete rate tables, effective dates and an explicit implementation decision.

## Recommended next implementation order

1. Add versioned DTDC policy records with effective dates and applicability by service/partner.
2. Add a COD compliance dashboard with thresholds and manual override/audit notes.
3. Add pickup/NDR/PDN exception queues and configurable SLA alerts.
4. Add CP audit evidence fields for invoice, GSTR-1, rate approval and debit-note reconciliation.
5. Add a separate international sender/customs booking flow after the API and document requirements are confirmed.
