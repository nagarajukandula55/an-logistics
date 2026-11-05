# Production readiness checklist

## Core configuration

- Set `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, and `CRON_SECRET`.
- Run migrations and seed only the intended initial admin account.
- Confirm the deployment can reach PostgreSQL and the configured courier APIs.
- Keep provider credentials and API keys in the deployment secret store.

## Agreements

- Configure Zoho Sign OAuth credentials and the correct data-centre domains.
- Set `ZOHO_SIGN_WEBHOOK_SECRET` and register `/api/webhooks/zoho-sign` in Zoho.
- Set `AGREEMENT_DOCUMENT_HOSTS` to the exact HTTPS host used for reviewed PDFs.
- Verify draft → send → signed webhook → signed PDF email → rate-card activation.
- Configure `AGREEMENTS_NOTIFY_EMAIL` and verify both signer and operations delivery.
- Treat `SENDING` agreements as reconciliation-required until the Zoho envelope is checked.

## Telegram

- Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and `TELEGRAM_WEBHOOK_SECRET`.
- Register the webhook with Telegram using `secret_token` and verify a signed update arrives.
- Add the bot to each operations group and grant permission to send messages and documents.
- In Settings → Telegram notifications, discover or paste each group chat ID, send a test, and enable only the events wanted by that group.
- Verify tenant/customer deep links for `/start`, then verify `/shipments` and `/documents <tracking-code>` scope results correctly.
- Remember that Telegram delivery is best effort; operators should reconcile from the application if Telegram is unavailable.

## Shipment and document flows

- Test API rates and API shipment creation with and without dimensions; confirm the returned chargeable weight matches.
- Test dashboard booking, customer booking, tracking webhook updates, scheduled reconciliation, assignment, delivery, and cancellation.
- Confirm order-status events reach the tenant webhook, customer Telegram link, and internal operations group where configured.
- Confirm the courier label URL is reachable by Telegram when using `/documents`.
- Print and visually verify agreement previews, invoices, and settlements from a production-like browser.

## Operational safeguards

- Keep the optional cron endpoints protected by `CRON_SECRET` if you connect an external scheduler; no Vercel cron schedule is enabled by default.
- Confirm courier webhook authentication and provider-specific AWB mapping with the courier account owner.
- Monitor application logs for failed Telegram, email, Zoho, and courier calls.
- Reconcile failed or uncertain courier bookings before retrying to prevent duplicate shipments.
- Run the isolated onboarding test suite against a migrated test database before go-live.
