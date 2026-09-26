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
        description="What this system actually needs to fulfill orders through a courier — and what&apos;s real vs. what&apos;s manual today."
      />

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="h-section">The data model, in plain terms</h2>
          <p className="text-sm text-ink-2">
            Every courier you work with is one <strong>Courier Partner</strong> record — the
            company/franchise itself (name, contact, commission terms). A partner can have one or
            more <strong>Courier Branches</strong> — physical pickup/drop points with their own
            serviceable pincodes. Separately, a partner can optionally have an{" "}
            <strong>API Config</strong> — the credentials this app uses to call that courier&apos;s
            website/API automatically for rates, booking and tracking. A partner with{" "}
            <em>no</em> API Config still works — it&apos;s just dispatched manually (phone/WhatsApp)
            instead of by an automated call.
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-2 flex flex-col gap-1">
            <li><strong>Courier Partner</strong> — the company. Set &quot;Integration type&quot; to Manual or API when onboarding.</li>
            <li><strong>Courier Branch</strong> — a location of theirs with a serviceable-pincode list, added from the partner&apos;s detail page.</li>
            <li><strong>Rate Card</strong> — your own priced slabs (zone × weight) for Manual partners, since there&apos;s no live API to fetch a quote from.</li>
            <li><strong>Agreement</strong> — the commercial contract/commission record, for your own records.</li>
            <li><strong>API Config</strong> — provider name + base URL + credentials, used only when integrationType = API.</li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="h-section">Connecting DTDC <Badge tone="warning">API integration, unverified</Badge></h2>
          </div>
          <p className="text-sm text-ink-2">
            DTDC is our first real-API courier partner (<code>src/lib/courier-providers/dtdc-provider.ts</code> /{" "}
            <code>dtdc-client.ts</code>), built against DTDC&apos;s partner platform (&quot;Shipsy&quot; —{" "}
            <span className="font-mono">dtdc.portal.shipsy.in</span>). It authenticates with a
            static <strong>API key</strong> sent as an <span className="font-mono">api-key</span> header,
            plus a <strong>customer code</strong> on most request bodies — not email/password like
            the Shiprocket integration this replaced.
          </p>
          <p className="text-sm text-ink-2 font-medium">
            Endpoint paths/payload shapes here are confirmed only for shipment creation (Softdata
            Upload) — serviceability, tracking, and cancel were written from the API Playground&apos;s
            endpoint list without seeing their full schemas, so treat calls to those as untested
            until verified against a real account.
          </p>
          <ol className="list-decimal pl-5 text-sm text-ink-2 flex flex-col gap-2">
            <li>
              In the DTDC partner portal (<span className="font-mono">dtdc.portal.shipsy.in</span>),
              go to <strong>Setup → Integration Logs / AppLink</strong> to get your API key and
              customer code.
            </li>
            <li>
              In this app, go to <Link href="/couriers/new" className="text-accent">Couriers → Onboard courier</Link> and
              create the partner with Integration type = <strong>API</strong>.
            </li>
            <li>
              Open the new partner&apos;s detail page and find the <strong>API config</strong> panel.
              Set Provider to <span className="font-mono">DTDC</span> (case-insensitive match; the
              form reveals DTDC-specific fields once you type it). The Base URL defaults to{" "}
              <span className="font-mono">https://app.shipsy.in</span> — DTDC&apos;s API server is fixed,
              not issued per account, so leave it unless DTDC tells you otherwise.
            </li>
            <li>
              Enter your <strong>API key</strong>, <strong>customer code</strong>, and{" "}
              <strong>hub code</strong> in the fields that appear. These are encrypted (AES-256-GCM)
              before being stored — see <code>src/lib/crypto.ts</code> — and the app needs an{" "}
              <span className="font-mono">ENCRYPTION_KEY</span> environment variable set for this to
              work (already configured in this deployment).
            </li>
            <li>
              Check <strong>Active</strong> and save, then test with a low-stakes order before
              relying on it — <span className="font-mono">service_type_id</span> is still a
              placeholder in <code>dtdc-provider.ts</code> until DTDC confirms the right value for
              this account.
            </li>
            <li>
              Register our <span className="font-mono">/api/webhooks/tracking-update</span> URL as
              DTDC&apos;s Consignment Status Webhook callback in their own portal (exact screen still
              being tracked down — see Setup/Integration Logs/AppLink), so delivery/tracking status
              updates flow back automatically. Until that&apos;s confirmed, a scheduled fallback (
              <code>/api/cron/sync-tracking</code>, see <code>vercel.json</code>) polls DTDC&apos;s
              tracking endpoint directly every 15 minutes as a safety net.
            </li>
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="h-section">Connecting any other courier <Badge tone="warning">Manual only, for now</Badge></h2>
          </div>
          <p className="text-sm text-ink-2 font-medium">
            Be clear about this: DTDC is the only courier with an API adapter built so far.{" "}
            <code>src/lib/courier-providers/registry.ts</code> only maps the provider name{" "}
            <span className="font-mono">DTDC</span> to a real adapter — anything else set as an
            API Config&apos;s provider will fail at call time with &quot;No adapter implemented for
            provider: …&quot;. That is a deliberate, honest failure, not a partial integration.
            More couriers get added one at a time, the same way DTDC was.
          </p>
          <p className="text-sm text-ink-2">
            What you <em>can</em> do today for Delhivery, Bluedart, a local franchise, etc.
            is onboard it as a fully functional <strong>Manual</strong> partner:
          </p>
          <ol className="list-decimal pl-5 text-sm text-ink-2 flex flex-col gap-2">
            <li>
              <Link href="/couriers/new" className="text-accent">Onboard courier</Link> with
              Integration type = <strong>Manual (phone / WhatsApp)</strong>. No API credentials
              needed at all.
            </li>
            <li>
              Add one or more <strong>Branches</strong> on the partner&apos;s detail page, each with
              the pincodes it actually services — this is what the app uses instead of a live
              serviceability API call.
            </li>
            <li>
              Add a <strong>Rate Card</strong> with zone/weight-banded slabs reflecting the rates
              you&apos;ve agreed with them — this stands in for a live rate-quote API call.
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
              implementing the same <code>CourierProvider</code> interface DTDC uses
              (<code>checkServiceability</code>, <code>getQuote</code>, and optionally{" "}
              <code>getQuotes</code>/<code>createShipment</code>/<code>trackShipment</code>/
              <code>cancelShipment</code>), registered by name in{" "}
              <code>registry.ts</code>&apos;s <code>API_PROVIDERS</code> map. Delhivery credentials
              (an API token, not email/password) would then be entered the same way as DTDC&apos;s,
              once that adapter exists. No schema or UI changes would be required — the API Config
              form&apos;s &quot;Provider&quot; field and the encrypted-credential storage are already
              generic; only the DTDC-specific UI branch in the API Config panel would need a
              Delhivery-specific field set (an API token field instead of a key/customer-code/hub-code
              trio) if its auth style differs, which it does.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
