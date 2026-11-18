import type { Customer, Invoice, InvoiceLineItem, Order, PartnerApplication, Tenant } from "@prisma/client";
import { COMPANY_PROFILE } from "@/lib/company-profile";

type InvoiceWithDetails = Invoice & {
  tenant: Tenant;
  customer: (Customer & { onboardingApplication: PartnerApplication | null }) | null;
  lineItems: (InvoiceLineItem & { order: Order | null })[];
};

function money(value: number) { return `₹${value.toFixed(2)}`; }
function date(value: Date | null | undefined) {
  return value?.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) ?? "—";
}

export function InvoiceDocument({ invoice }: { invoice: InvoiceWithDetails }) {
  const recipient = invoice.customer;
  const recipientName = recipient?.billingName || recipient?.name || invoice.tenant.name;
  const recipientEmail = recipient?.billingEmail || recipient?.email || invoice.tenant.billingEmail;
  const recipientAddress = recipient?.billingAddress || recipient?.address || invoice.tenant.billingAddress;
  const recipientGstin = recipient?.gstin || recipient?.onboardingApplication?.gstin || invoice.tenant.gstin;

  return <div className="mx-auto max-w-4xl bg-white p-8 text-black print:max-w-none print:p-0">
    <div className="flex items-start justify-between gap-8 border-b-2 border-slate-900 pb-6">
      <div><h1 className="text-2xl font-bold">{COMPANY_PROFILE.invoiceName}</h1><p className="mt-1 text-sm text-slate-600">Courier booking and logistics services</p><p className="mt-3 whitespace-pre-line text-sm text-slate-700">{COMPANY_PROFILE.address}</p><p className="text-sm text-slate-700">GSTIN: {COMPANY_PROFILE.gstin}</p><p className="text-sm text-slate-700">{COMPANY_PROFILE.email} · {COMPANY_PROFILE.phone}</p></div>
      <div className="text-right"><h2 className="text-2xl font-semibold uppercase tracking-wide">Tax Invoice</h2><p className="mt-3 text-sm"><b>Invoice no:</b> {invoice.invoiceNumber}</p><p className="text-sm"><b>Invoice date:</b> {date(invoice.issuedAt || invoice.createdAt)}</p>{invoice.dueAt && <p className="text-sm"><b>Due date:</b> {date(invoice.dueAt)}</p>}<p className="text-sm"><b>Status:</b> {invoice.status}</p></div>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-8 text-sm"><div><p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Bill to</p><p className="font-semibold">{recipientName}</p>{recipientAddress && <p className="whitespace-pre-line text-slate-700">{recipientAddress}</p>}{recipientEmail && <p className="text-slate-700">{recipientEmail}</p>}{recipientGstin && <p className="text-slate-700">GSTIN: {recipientGstin}</p>}</div><div className="text-right"><p><b>Billing period:</b> {date(invoice.periodStart)} – {date(invoice.periodEnd)}</p><p><b>Account:</b> B2B customer account</p><p><b>Currency:</b> INR</p></div></div>
    <table className="mt-8 w-full border-collapse text-sm"><thead><tr className="border-y border-slate-300 text-left"><th className="py-3 pr-3">Description</th><th className="py-3 px-3">Shipment / docket</th><th className="py-3 px-3 text-right">Qty</th><th className="py-3 px-3 text-right">Rate</th><th className="py-3 pl-3 text-right">Amount</th></tr></thead><tbody>{invoice.lineItems.map((item) => <tr key={item.id} className="border-b border-slate-200 align-top"><td className="py-3 pr-3">{item.description}</td><td className="py-3 px-3 text-slate-700">{item.order?.trackingCode || "—"}{item.order?.providerRef ? ` / ${item.order.providerRef}` : ""}</td><td className="py-3 px-3 text-right">{item.quantity}</td><td className="py-3 px-3 text-right">{money(item.unitPrice)}</td><td className="py-3 pl-3 text-right">{money(item.amount)}</td></tr>)}</tbody><tfoot><tr><td colSpan={4} className="pt-5 text-right font-medium">Subtotal</td><td className="pt-5 text-right">{money(invoice.subtotal)}</td></tr><tr><td colSpan={4} className="pt-2 text-right font-medium">GST</td><td className="pt-2 text-right">{money(invoice.taxAmount)}</td></tr><tr className="text-base font-bold"><td colSpan={4} className="pt-3 text-right">Total</td><td className="pt-3 text-right">{money(invoice.totalAmount)}</td></tr></tfoot></table>
    <div className="mt-10 border-t border-slate-300 pt-4 text-xs text-slate-600"><p>This invoice is issued by {COMPANY_PROFILE.invoiceName} for B2B logistics services booked through the AN Logistics customer portal.</p><p className="mt-1">Please quote the invoice number for billing questions. DTDC service execution remains subject to DTDC serviceability, acceptance, and applicable terms.</p>{invoice.notes && <p className="mt-1">Notes: {invoice.notes}</p>}</div>
  </div>;
}
