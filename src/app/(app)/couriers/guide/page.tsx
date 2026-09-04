import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function CourierGuidePage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <PageHeader
        eyebrow="Courier partners"
        title="How to connect a courier"
        description="What this system actually needs to fulfill orders through a courier — and what's real vs. what's manual today."
      />

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="h-section">The data model, in plain terms</h2>
          <p className="text-sm text-ink-2">
            Every courier you work with is one <strong>Courier Partner</strong> record — the
            company/franchise itself (name, contact, commission terms). A partner can have one or
            more <strong>Courier Branches</strong> — physical pickup/drop points with their own
            serviceable pincodes. Separately, a partner can optionally have an{" "}
            <strong>API Config</strong> — the credentials this app uses to call that courier's
            website/API automatically for rates, booking and tracking. A partner with{" "}
            <em>no</em> API Config still works — it's just dispatched manually (phone/WhatsApp)
            instead of by an automated call.
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-2 flex flex-col gap-1">
            <li><strong>Courier Partner</strong> — the company. Set "Integration type" to Manual or API when onboarding.</li>
            <li><strong>Courier Branch</strong> — a location of theirs with a serviceable-pincode list, added from the partner's detail page.</li>
            <li><strong>Rate Card</strong> — your own priced slabs (zone × weight) for Manual partners, since there's no live API to fetch a quote from.</li>
            <li><strong>Agreement</strong> — the commercial contract/commission record, for your own records.</li>
            <li><strong>API Config</strong> — provider name + base URL + credentials, used only when integrationType = API.</li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="h-section">Connecting Shiprocket <Badge tone="success">Real API integration</Badge></h2>
          </div>
          <p className="text-sm text-ink-2">
            Shiprocket is the only courier with a working, tested API integration in this app
            today (<code>src/lib/courier-providers/shiprocket-provider.ts</code> /{" "}
            <code>shiprocket-client.ts</code>). It authenticates with a Shiprocket account email +
            password (not an API key) and can check serviceability, fetch live rate quotes, and —
            once wired to booking — create shipments and receive tracking webhooks.
          </p>
          <ol className="list-decimal pl-5 text-sm text-ink-2 flex flex-col gap-2">
            <li>
              Get a Shiprocket account. If you don't have one, sign up at{" "}
              <span className="font-mono">shiprocket.in</span> — any paid or trial plan works, no
              separate "developer" registration is needed. Shiprocket's public API (
              <span className="font-mono">apiv2.shiprocket.in/v1/external</span>) is authenticated
              with your normal login email + password, so there is no API key to generate.
            </li>
            <li>
              In this app, go to <Link href="/couriers/new" className="text-accent">Couriers → Onboard courier</Link> and
              create the partner with Integration type = <strong>API</strong>.
            </li>
            <li>
              Open the new partner's detail page and find the <strong>API config</strong> panel.
              Set Provider to <span className="font-mono">SHIPROCKET</span> (case-insensitive
              match; the form reveals Shiprocket-specific fields once you type it). The Base URL
              defaults to <span className="font-mono">https://apiv2.shiprocket.in/v1/external</span> —
              leave it unless Shiprocket tells you otherwise.
            </li>
            <li>
              Enter your Shiprocket account's <strong>email</strong> and <strong>password</strong> in
              the fields that appear. These are encrypted (AES-256-GCM) before being stored — see{" "}
              <code>src/lib/crypto.ts</code> — and the app needs an <span className="font-mono">ENCRYPTION_KEY</span>{" "}
              environment variable set for this to work (already configured in this deployment).
            </li>
            <li>
              Check <strong>Active</strong> and save. From this point, quoting/serviceability
              calls for orders routed to this partner will hit the real Shiprocket API using
              these credentials.
            </li>
            <li>
              Optionally add a <strong>Webhook URL</strong> pointing Shiprocket's shipment-status
              webhooks at <span className="font-mono">/api/webhooks/shiprocket</span> on this
              deployment, so delivery/tracking status updates flow back automatically instead of
              needing manual status entry.
            </li>
          </ol>
          <p className="text-xs text-ink-3">
            Booking a shipment (create AWB) and cancellation depend on which methods the provider
            implements — check <code>shiprocket-provider.ts</code> for the current state if a
            particular action isn't showing up yet; the interface supports it, but not every
            method is necessarily wired end-to-end in the dispatch UI.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="h-section">Connecting Delhivery or any other courier <Badge tone="warning">Manual only, today</Badge></h2>
          </div>
          <p className="text-sm text-ink-2 font-medium">
            Be clear about this: there is no Delhivery (or any other courier besides Shiprocket)
            API integration built yet. <code>src/lib/courier-providers/registry.ts</code> only
            maps the provider name <span className="font-mono">SHIPROCKET</span> to a real
            adapter — anything else set as an API Config's provider will fail at call time with
            "No adapter implemented for provider: …". That is a deliberate, honest failure, not a
            partial integration.
          </p>
          <p className="text-sm text-ink-2">
            What you <em>can</em> do today for Delhivery (or DTDC, Bluedart, a local franchise,
            etc.) is onboard it as a fully functional <strong>Manual</strong> partner:
          </p>
          <ol className="list-decimal pl-5 text-sm text-ink-2 flex flex-col gap-2">
            <li>
              <Link href="/couriers/new" className="text-accent">Onboard courier</Link> with
              Integration type = <strong>Manual (phone / WhatsApp)</strong>. No API credentials
              needed at all.
            </li>
            <li>
              Add one or more <strong>Branches</strong> on the partner's detail page, each with
              the pincodes it actually services — this is what the app uses instead of a live
              serviceability API call.
            </li>
            <li>
              Add a <strong>Rate Card</strong> with zone/weight-banded slabs reflecting the rates
              you've agreed with them — this stands in for a live rate-quote API call.
            </li>
            <li>
              Orders can be assigned to this partner exactly like an API partner. The difference
              is entirely operational: your dispatch team calls/messages the courier to book the
              pickup, gets the AWB/tracking number back, and enters it (and later, status updates)
              into this app by hand instead of it happening automatically.
            </li>
          </ol>
          <div className="rounded-control bg-surface-2 p-3 text-xs text-ink-2">
            <p className="font-medium text-ink mb-1">What building real Delhivery API support would take</p>
            <p>
              A new file (e.g. <code>src/lib/courier-providers/delhivery-provider.ts</code>)
              implementing the same <code>CourierProvider</code> interface Shiprocket uses
              (<code>checkServiceability</code>, <code>getQuote</code>, and optionally{" "}
              <code>getQuotes</code>/<code>createShipment</code>/<code>trackShipment</code>/
              <code>cancelShipment</code>), registered by name in{" "}
              <code>registry.ts</code>'s <code>API_PROVIDERS</code> map. Delhivery credentials
              (an API token, not email/password) would then be entered the same way as
              Shiprocket's, once that adapter exists. No schema or UI changes would be required —
              the API Config form's "Provider" field and the encrypted-credential storage are
              already generic; only the SHIPROCKET-specific UI branch in the API Config panel
              would need a Delhivery-specific field set (an API token field instead of
              email/password) if its auth style differs, which it does.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
