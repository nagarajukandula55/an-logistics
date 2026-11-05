/** Single source for details printed on AN Logistics documents. Configure
 * these environment variables per deployment; defaults preserve the current
 * AN Group details until the admin replaces them. */
export const COMPANY_PROFILE = {
  brand: process.env.AN_BRAND_NAME || "AN Logistics",
  legalName: process.env.AN_LEGAL_NAME || "AN Group",
  gstin: process.env.AN_GSTIN || "37EOZPK9605G1Z5",
  address: process.env.AN_REGISTERED_ADDRESS || "1203, opp:ice factory, Bondapalle, Gotlam, Vizianagaram, 535003",
  email: process.env.AN_CONTACT_EMAIL || "contact@angroup.in",
  phone: process.env.AN_CONTACT_PHONE || "+918985229693",
  website: process.env.AN_WEBSITE || "logistics.angroup.in",
};
