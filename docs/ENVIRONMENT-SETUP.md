# Environment setup checklist

This file records the configuration required by the application. Values are intentionally left blank or illustrative; add real secrets only to the deployment environment or an ignored local `.env` file.

## Required before production

```env
DATABASE_URL=
AUTH_SECRET=
ENCRYPTION_KEY=
CRON_SECRET=
AGENT_API_KEY=
DTDC_WEBHOOK_SECRET=
AN_BRAND_NAME=AN Logistics
AN_LEGAL_NAME=AN Group
AN_GSTIN=37EOZPK9605G1Z5
AN_REGISTERED_ADDRESS=1203, opp:ice factory, Bondapalle, Gotlam, Vizianagaram, 535003
AN_CONTACT_EMAIL=contact@angroup.in
AN_CONTACT_PHONE=+918985229693
AN_WEBSITE=logistics.angroup.in
```

`CRON_SECRET` protects tracking reconciliation and agreement-renewal jobs. Do not leave it unset in production.

## Optional integrations

```env
ACCOUNTING_API_URL=
ACCOUNTING_API_KEY=
WALLET_API_URL=
WALLET_API_KEY=

ZOHO_SIGN_CLIENT_ID=
ZOHO_SIGN_CLIENT_SECRET=
ZOHO_SIGN_REFRESH_TOKEN=
ZOHO_SIGN_API_DOMAIN=sign.zoho.in
ZOHO_SIGN_ACCOUNTS_DOMAIN=accounts.zoho.in
ZOHO_SIGN_WEBHOOK_SECRET=
AGREEMENT_DOCUMENT_HOSTS=

TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=

RESEND_API_KEY=
EMAIL_FROM=
AGREEMENTS_NOTIFY_EMAIL=

VOLUMETRIC_MEASUREMENT_URL=
VOLUMETRIC_MEASUREMENT_TOKEN=
```

## Setup-only variables

```env
SEED_ADMIN_USERNAME=
SEED_ADMIN_PASSWORD=
SEED_DEMO_DATA=false
```

The volumetric measurement URL must accept multipart `images` files and return a JSON object containing `dimensions.lengthCm`, `dimensions.widthCm`, and `dimensions.heightCm`. The camera UI will fall back to manual entry when the service is unavailable.
