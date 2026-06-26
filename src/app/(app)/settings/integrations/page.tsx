import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { formatDate } from "@/lib/domain";
import { EVENT_TYPES, EVENT_LABELS } from "@/lib/events";
import {
  saveIntegration,
  createWebhook,
  toggleWebhook,
  deleteWebhook,
  testWebhook,
} from "@/lib/admin-actions";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Static catalog of connectable systems. Provider-specific config fields are
// captured generically as config_* inputs and stored as a JSON blob.
type CatalogItem = {
  key: string;
  name: string;
  category: string;
  blurb: string;
  icon: string;
  fields: { name: string; label: string; placeholder?: string }[];
};

const CATALOG: CatalogItem[] = [
  {
    key: "booking_engine",
    name: "Website Booking Engine",
    category: "BOOKING",
    icon: "🌐",
    blurb: "Take direct, commission-free bookings from your own website.",
    fields: [
      { name: "site_url", label: "Website URL", placeholder: "https://myhotel.com" },
      { name: "api_key", label: "Booking engine API key" },
    ],
  },
  {
    key: "payment",
    name: "Payment Gateway",
    category: "PAYMENT",
    icon: "💳",
    blurb: "Charge cards and collect deposits (Stripe, Adyen, Razorpay…).",
    fields: [
      { name: "provider", label: "Provider", placeholder: "stripe" },
      { name: "publishable_key", label: "Publishable key" },
      { name: "secret_key", label: "Secret key" },
    ],
  },
  {
    key: "door_lock",
    name: "Smart Door Locks",
    category: "ACCESS",
    icon: "🔐",
    blurb: "Issue mobile keys automatically on check-in (Assa Abloy, Salto…).",
    fields: [
      { name: "vendor", label: "Lock vendor", placeholder: "salto" },
      { name: "api_token", label: "API token" },
    ],
  },
  {
    key: "accounting",
    name: "Financial Accounting",
    category: "ACCOUNTING",
    icon: "📒",
    blurb: "Sync invoices & payments to QuickBooks, Xero or Tally.",
    fields: [
      { name: "system", label: "Accounting system", placeholder: "xero" },
      { name: "account_id", label: "Account / tenant ID" },
    ],
  },
  {
    key: "channel_manager",
    name: "Channel Manager / OTAs",
    category: "CHANNEL",
    icon: "🔁",
    blurb: "Distribute inventory to Booking.com, Expedia, Airbnb & more.",
    fields: [
      { name: "provider", label: "Channel manager", placeholder: "siteminder" },
      { name: "property_id", label: "Property ID" },
      { name: "api_key", label: "API key" },
    ],
  },
];

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireRole(ADMIN_ROLES);
  const propertyId = await requirePropertyId();
  const { saved, error } = await searchParams;

  const [integrations, webhooks, deliveries, events] = await Promise.all([
    prisma.integration.findMany({ where: { propertyId } }),
    prisma.webhookEndpoint.findMany({
      where: { propertyId },
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhookDelivery.findMany({
      where: { endpoint: { propertyId } },
      include: { endpoint: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.eventLog.findMany({ where: { propertyId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const byKey = new Map(integrations.map((i) => [i.key, i]));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Integrations & Automation"
        subtitle="Connect your hotel's systems and automate workflows with Zapier, Make & webhooks"
        action={<Link href="/settings" className="btn-secondary">← Settings</Link>}
      />

      {saved && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">✓ Saved.</div>}
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Please check the form and try again.</div>}

      {/* ── Automation: Zapier / Make ── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Workflow automation</h2>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card border-l-4 border-l-orange-400 p-5">
          <div className="text-2xl">⚡</div>
          <div className="mt-1 font-semibold">Zapier</div>
          <p className="mt-1 text-sm text-gray-500">
            Create a Zap with a “Webhooks by Zapier → Catch Hook” trigger, copy the hook URL,
            and add it below as a <b>Zapier</b> endpoint. Every selected PMS event will flow into Zapier — connect to 6,000+ apps.
          </p>
        </div>
        <div className="card border-l-4 border-l-purple-400 p-5">
          <div className="text-2xl">🧩</div>
          <div className="mt-1 font-semibold">Make (Integromat)</div>
          <p className="mt-1 text-sm text-gray-500">
            Add a “Custom Webhook” module in a Make scenario, copy its address, and register it below as a
            <b> Make</b> endpoint. Build visual multi-step automations from any PMS event.
          </p>
        </div>
      </div>

      {/* Webhook endpoints */}
      <div className="card mb-4">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="font-semibold text-gray-800">Webhook endpoints</h3>
          <p className="text-xs text-gray-500">PMS events are POSTed as JSON to each active endpoint. Add a signing secret to verify authenticity (HMAC-SHA256 in <code>X-PMS-Signature</code>).</p>
        </div>
        <div className="divide-y divide-gray-100">
          {webhooks.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400">No endpoints yet. Add one below.</div>
          ) : (
            webhooks.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{w.name}</span>
                    <span className="badge bg-gray-100 text-gray-600">{w.provider}</span>
                    {w.active ? <Badge status="CLEAN" label="Active" /> : <Badge status="OUT_OF_ORDER" label="Paused" />}
                  </div>
                  <div className="truncate font-mono text-xs text-gray-400">{w.url}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    Events: {w.events === "*" ? "All events" : w.events} · {w._count.deliveries} deliveries
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={testWebhook}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="btn-secondary !py-1.5 text-xs">Send test</button>
                  </form>
                  <form action={toggleWebhook}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="btn-secondary !py-1.5 text-xs">{w.active ? "Pause" : "Resume"}</button>
                  </form>
                  <form action={deleteWebhook}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="btn-danger !py-1.5 text-xs">Delete</button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add webhook */}
        <form action={createWebhook} className="border-t border-gray-100 bg-gray-50 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input name="name" required placeholder="e.g. Zapier — new bookings" className="input" />
            </div>
            <div>
              <label className="label">Provider</label>
              <select name="provider" className="input" defaultValue="ZAPIER">
                <option value="ZAPIER">Zapier</option>
                <option value="MAKE">Make</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Webhook URL</label>
              <input name="url" required type="url" placeholder="https://hooks.zapier.com/hooks/catch/..." className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Signing secret (optional)</label>
              <input name="secret" placeholder="Used to compute X-PMS-Signature" className="input" />
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Trigger on events (none selected = all)</label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {EVENT_TYPES.map((e) => (
                <label key={e} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs">
                  <input type="checkbox" name="events" value={e} />
                  <span>{EVENT_LABELS[e]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <button className="btn-primary">Add webhook endpoint</button>
          </div>
        </form>
      </div>

      {/* ── Connected systems catalog ── */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">Connected systems</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CATALOG.map((item) => {
          const rec = byKey.get(item.key);
          const config: Record<string, string> = rec ? safeParse(rec.config) : {};
          const enabled = rec?.enabled ?? false;
          return (
            <details key={item.key} className="card overflow-hidden p-5" open={false}>
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <div className="text-2xl">{item.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.blurb}</div>
                </div>
                {enabled
                  ? <Badge status="CLEAN" label="Connected" />
                  : <span className="badge bg-gray-100 text-gray-500">Not connected</span>}
              </summary>

              <form action={saveIntegration} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <input type="hidden" name="key" value={item.key} />
                <input type="hidden" name="name" value={item.name} />
                <input type="hidden" name="category" value={item.category} />
                {item.fields.map((f) => (
                  <div key={f.name}>
                    <label className="label">{f.label}</label>
                    <input
                      name={`config_${f.name}`}
                      defaultValue={config[f.name] ?? ""}
                      placeholder={f.placeholder}
                      className="input"
                    />
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" name="enabled" defaultChecked={enabled} /> Enable this integration
                </label>
                <button className="btn-primary !py-1.5 text-sm">Save connection</button>
              </form>
            </details>
          );
        })}
      </div>

      {/* ── Logs ── */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-gray-100 px-5 py-3"><h3 className="font-semibold text-gray-800">Recent webhook deliveries</h3></div>
          <div className="divide-y divide-gray-100">
            {deliveries.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">No deliveries yet. Add an endpoint and send a test.</div>
            ) : (
              deliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs">{d.event}</div>
                    <div className="truncate text-xs text-gray-400">{d.endpoint?.name ?? "—"} · {formatDate(d.createdAt)}</div>
                  </div>
                  {d.status === "SUCCESS"
                    ? <Badge status="CLEAN" label={`OK ${d.statusCode ?? ""}`} />
                    : <Badge status="OUT_OF_ORDER" label="Failed" />}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="border-b border-gray-100 px-5 py-3"><h3 className="font-semibold text-gray-800">Event stream</h3></div>
          <div className="divide-y divide-gray-100">
            {events.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">No events yet.</div>
            ) : (
              events.map((e) => (
                <div key={e.id} className="px-5 py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-brand-700">{e.event}</span>
                    <span className="text-xs text-gray-400">{formatDate(e.createdAt)}</span>
                  </div>
                  <div className="text-xs text-gray-600">{e.summary}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function safeParse(s: string): Record<string, string> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
