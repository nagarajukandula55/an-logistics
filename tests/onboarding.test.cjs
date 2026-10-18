const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

// Exercise real server functions with isolated persistence/provider boundaries.
// No database, Telegram message, signing request or courier booking is issued.
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name),
    console, process, FormData, URL, URLSearchParams, AbortSignal, Buffer, fetch,
  });
  return module.exports;
}
function form(data) { const f = new FormData(); for (const [k, v] of Object.entries(data)) f.append(k, String(v)); return f; }
const common = {
  'next/cache': { revalidatePath() {} },
  '@/lib/onboarding': { requireOnboardingAdmin: async () => ({}) },
  '@/lib/marketplace-tenant': { getMarketplaceTenantId: async () => 'market' },
  bcryptjs: { hash: async () => 'hashed' },
};
const application = { name: 'Test Shipper', email: 'TEST@example.com', phone: '9876543210', accountType: 'business', address: '10 Example Street', pincode: '560001', monthlyVolume: 10, consent: 'on' };

test('invalid phone or missing consent does not persist a public application', async () => {
  let writes = 0;
  const actions = load('src/lib/actions/onboarding.ts', { ...common, '@/lib/prisma': { prisma: { partnerApplication: { create: async () => writes++ } } }, '@/lib/telegram': { notifyOpsTelegram: async () => {} } });
  assert.equal((await actions.applyPartnerAction({}, form({ ...application, phone: '123' }))).ok, false);
  assert.equal((await actions.applyPartnerAction({}, form({ ...application, consent: '' }))).ok, false);
  assert.equal(writes, 0);
});
test('valid signup saves normalized lead and notifies ops without creating a login', async () => {
  let saved, notification;
  const actions = load('src/lib/actions/onboarding.ts', { ...common, '@/lib/prisma': { prisma: { partnerApplication: { create: async ({ data }) => { saved = data; } } } }, '@/lib/telegram': { notifyOpsTelegram: async (...args) => { notification = args; } } });
  assert.equal((await actions.applyPartnerAction({}, form(application))).ok, true);
  assert.equal(saved.email, 'test@example.com');
  assert.ok(saved.consentAt);
  assert.equal(notification[0], 'PARTNER_APPLICATION');
});
test('an unsigned application cannot receive a login', async () => {
  let created = false;
  const tx = { partnerApplication: { findUnique: async () => ({ status: 'AGREEMENT', customer: { agreements: [{ status: 'SENT', sellRateCardId: 'rate' }] } }) }, user: { create: async () => { created = true; } } };
  const actions = load('src/lib/actions/onboarding.ts', { ...common, '@/lib/prisma': { prisma: { $transaction: async fn => fn(tx) } }, '@/lib/telegram': {} });
  const result = await actions.activatePartnerAction({}, form({ id: 'lead', courierIds: 'dtdc' }));
  assert.equal(result.ok, false);
  assert.match(result.error, /signed rate-card agreement/);
  assert.equal(created, false);
});
test('signed agreements cannot be edited or repriced', async () => {
  const actions = load('src/lib/actions/agreements.ts', { ...common, '@/lib/prisma': { prisma: { agreement: { findUnique: async () => ({ status: 'SIGNED' }) } } }, '@/lib/agreements': {} });
  const result = await actions.updateAgreementAction({}, form({ agreementId: 'agreement', kind: 'B2B', templateVersion: 'v2', documentUrl: 'https://example.com/test.pdf' }));
  assert.equal(result.ok, false);
  assert.match(result.error, /locked/);
});
test('repeat completion does not reactivate rates or send duplicate alerts', async () => {
  let alerts = 0;
  const functions = load('src/lib/agreements.ts', { '@/lib/prisma': { prisma: { agreement: { findUnique: async () => ({ id: 'a', status: 'SIGNED', customer: {} }) }, $transaction: async fn => fn({ agreement: { updateMany: async () => ({ count: 0 }) } }) } }, '@/lib/email': {}, '@/lib/telegram': { notifyOpsTelegram: async () => alerts++ } });
  await functions.markAgreementSigned('a');
  assert.equal(alerts, 0);
});
test('onboarded customers never fall back to an unsigned default rate card', async () => {
  let queries = 0;
  const pricing = load('src/lib/sell-pricing.ts', { '@/lib/prisma': { prisma: { partnerApplication: { findUnique: async () => ({ id: 'lead' }) }, sellRateCard: { findFirst: async () => { queries++; return null; } } } } });
  assert.equal(await pricing.getSellPrice('market', 'LOCAL', 1, 'customer'), null);
  assert.equal(queries, 1);
});
test('weight-band boundaries select the lower band exactly once', async () => {
  const pricing = load('src/lib/sell-pricing.ts', { '@/lib/prisma': { prisma: { partnerApplication: { findUnique: async () => ({ id: 'lead' }) }, sellRateCard: { findFirst: async () => ({ id: 'rate', minMarginPercent: null, slabs: [{ zone: 'LOCAL', minWeightKg: 1, maxWeightKg: 2, price: 100 }, { zone: 'LOCAL', minWeightKg: 0, maxWeightKg: 1, price: 60 }] }) } } } });
  assert.equal((await pricing.getSellPrice('market', 'LOCAL', 1, 'customer')).price, 60);
});

const booking = { bookingKey: 'c6863aa0-3c54-4694-961b-08f31b724b90', pickupContactName: 'Sender', pickupContactPhone: '9876543210', pickupCity: 'Bengaluru', pickupState: 'Karnataka', deliveryCity: 'Mumbai', deliveryState: 'Maharashtra', lengthCm: 10, widthCm: 10, heightCm: 10, declaredValue: 500, packageDescription: 'Books', invoiceNumber: '', ewayBill: '', pickupDate: '2099-10-18', goodsConsent: 'on', pickupAddress: '10 Example Street', pickupPincode: '560001', deliveryAddress: '20 Example Street', deliveryContactName: 'Recipient', deliveryContactPhone: '9876543210', deliveryPincode: '400001', weightKg: 1, courierPartnerId: 'unallocated', courierBranchId: 'branch' };
function bookingActions(prisma) {
  return load('src/lib/actions/customer-booking.ts', {
    '@/lib/prisma': { prisma }, '@/lib/customer-session': { requireCustomerSession: async () => ({ customerId: 'customer', tenantId: 'market' }) },
    '@/lib/courier-providers/registry': {}, '@/lib/tracking-code': {}, '@/lib/courier-queries': {}, '@/lib/sell-pricing': {}, '@/lib/zone': {},
    '@/lib/validation': { pincodeSchema: require('zod').z.string().regex(/^[1-9]\d{5}$/) },
  });
}
test('a forged courier ID is rejected before any provider call or order write', async () => {
  const actions = bookingActions({ customer: { findUnique: async () => ({ onboardingApplication: { id: 'lead' }, allowedCouriers: [{ courierPartnerId: 'allocated' }] }) }, order: { findUnique: async () => null } });
  const result = await actions.createCustomerBookingAction({}, form(booking));
  assert.equal(result.ok, false);
  assert.match(result.error, /not allocated/);
});
test('repeat booking returns the existing docket without another provider call', async () => {
  const actions = bookingActions({ customer: { findUnique: async () => ({}) }, order: { findUnique: async () => ({ customerId: 'customer', trackingCode: 'AN-1', providerRef: 'DTDC-1' }) } });
  const result = await actions.createCustomerBookingAction({}, form(booking));
  assert.equal(result.ok, true);
  assert.equal(result.providerRef, 'DTDC-1');
});
test('DTDC receives sender address, independent declared value, dimensions and service code', async () => {
  let payload;
  const { dtdcProvider } = load('src/lib/courier-providers/dtdc-provider.ts', {
    '@/lib/prisma': { prisma: { courierApiConfig: { findUnique: async () => ({ apiKeyEncrypted: 'encrypted', baseUrl: 'https://example.com' }) } } },
    '@/lib/crypto': { decryptApiKey: () => JSON.stringify({ apiKey: 'test', customerCode: 'customer', hubCode: 'hub', serviceTypeId: 'SERVICE' }) },
    './dtdc-client': { dtdcRequest: async (_c, _path, options) => { if (options?.body) { payload = JSON.parse(options.body); return { awb_number: 'D123' }; } return {}; } },
  });
  const result = await dtdcProvider.createShipment({ id: 'courier', name: 'DTDC' }, { ...booking, orderId: 'order' });
  assert.equal(result.providerRef, 'D123');
  assert.equal(payload.origin_details.address_line_1, booking.pickupAddress);
  assert.equal(payload.declared_value, '500');
  assert.equal(payload.cod_amount, '0');
  assert.equal(payload.service_type_id, 'SERVICE');
  assert.equal(payload.pieces_detail[0].length, '10');
});
