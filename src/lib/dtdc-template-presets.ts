/**
 * Source-backed DTDC starter formats.
 *
 * These are deliberately courier-scoped. They are editable in Document Studio
 * before being used for a customer quotation or agreement.
 */
export const DTDC_REFERENCE_TERMS = `GST at 18% applies to the agreed freight and applicable charges.
Fuel surcharge and other service surcharges apply as per the selected DTDC rate schedule and its effective date.
Volumetric weight is calculated using the applicable service divisor: air L x B x H in centimetres / 5000; surface L x B x H in centimetres / 4750.
COD, RTO, insurance or risk surcharge, pickup, ODA, special destination and other applicable charges are billed as per the selected DTDC schedule.
Payment is due within the customer-specific credit period stated in the quotation or agreement. Rates remain subject to the signed commercial schedule.`;

const sharedStyles = `
  @page{size:A4;margin:18mm}
  body{font-family:Arial,sans-serif;color:#172d28;margin:0;line-height:1.45}
  header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #bb582f;padding-bottom:18px;margin-bottom:24px}
  h1{color:#bb582f;margin:0 0 5px;font-size:24px}
  h2{margin:24px 0 8px;font-size:18px}
  h3{margin:18px 0 6px;font-size:14px}
  .muted{color:#52645f;font-size:12px}
  .box{background:#f7f5ef;border:1px solid #d8ded2;padding:14px;margin:14px 0}
  table{width:100%;border-collapse:collapse;margin:14px 0 22px}
  th,td{border:1px solid #d8ded2;padding:8px;text-align:left}
  th{background:#e4e9db}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:55px}
  .signature{border-top:1px solid #172d28;padding-top:8px;min-height:55px}
`;

export const DTDC_QUOTATION_TEMPLATE = `<!doctype html><html><head><meta charset="utf-8"><title>{{DOCUMENT_TITLE}}</title><style>${sharedStyles}</style></head><body>
<header><div><h1>{{BRAND_NAME}}</h1><div>Courier and cargo services</div><div class="muted">DTDC service schedule</div></div><div><strong>QUOTATION</strong><br>{{REFERENCE_NUMBER}}<br>{{VALID_UNTIL}}</div></header>
<h2>{{CUSTOMER_NAME}}</h2><p>Courier partner: <strong>{{COURIER_NAME}}</strong></p>
<h2>Commercial rate schedule</h2>{{RATE_TABLE}}
<div class="box"><h3>Terms and conditions</h3>{{TERMS}}</div>
<div class="signatures"><div class="signature">For AN Logistics<br>Authorised signatory</div><div class="signature">Customer acceptance<br>Name, designation and date</div></div>
<p class="muted">This quotation is a commercial draft until accepted and converted into a final agreement.</p></body></html>`;

export const DTDC_AGREEMENT_TEMPLATE = `<!doctype html><html><head><meta charset="utf-8"><title>{{DOCUMENT_TITLE}}</title><style>${sharedStyles}</style></head><body>
<header><div><h1>{{BRAND_NAME}}</h1><div>Domestic and international courier and cargo services</div><div class="muted">DTDC commercial agreement schedule</div></div><div><strong>AGREEMENT</strong><br>{{REFERENCE_NUMBER}}<br>Effective: {{EFFECTIVE_DATE}}</div></header>
<h2>Parties</h2><p>Customer: <strong>{{CUSTOMER_NAME}}</strong></p><p>Courier partner: <strong>{{COURIER_NAME}}</strong></p>
<h2>Commercial rate schedule</h2>{{RATE_TABLE}}
<div class="box"><h3>Terms and conditions</h3>{{TERMS}}</div>
<div class="signatures"><div class="signature">For AN Logistics<br>Authorised signatory</div><div class="signature">Customer signature and stamp<br>Name, designation and date</div></div>
<p class="muted">The signed agreement and its attached rate schedule take precedence over this draft.</p></body></html>`;
