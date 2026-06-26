import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { updateSettings } from "@/lib/admin-actions";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "JPY", "AUD", "CAD", "SGD", "BRL"];
const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireRole(ADMIN_ROLES);
  const s = await getSettings();
  const { saved } = await searchParams;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Property Settings"
        subtitle="Configure your hotel profile, financials and operations"
        action={
          <div className="flex gap-2">
            <Link href="/settings/users" className="btn-secondary">Staff & roles</Link>
            <Link href="/settings/integrations" className="btn-secondary">Integrations</Link>
          </div>
        }
      />

      {saved && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Settings saved.
        </div>
      )}

      <form action={updateSettings} className="space-y-6">
        <Section title="Hotel profile">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Hotel name"><input name="name" defaultValue={s.name} className="input" required /></Field>
            <Field label="Legal / company name"><input name="legalName" defaultValue={s.legalName ?? ""} className="input" /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={s.email ?? ""} className="input" /></Field>
            <Field label="Phone"><input name="phone" defaultValue={s.phone ?? ""} className="input" /></Field>
            <Field label="Website"><input name="website" defaultValue={s.website ?? ""} className="input" /></Field>
            <Field label="Address"><input name="addressLine" defaultValue={s.addressLine ?? ""} className="input" /></Field>
            <Field label="City"><input name="city" defaultValue={s.city ?? ""} className="input" /></Field>
            <Field label="Country"><input name="country" defaultValue={s.country ?? ""} className="input" /></Field>
          </div>
        </Section>

        <Section title="Localization & operations">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Currency">
              <select name="currency" defaultValue={s.currency} className="input">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Timezone">
              <select name="timezone" defaultValue={s.timezone} className="input">
                {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Check-in time"><input name="checkInTime" type="time" defaultValue={s.checkInTime} className="input" /></Field>
            <Field label="Check-out time"><input name="checkOutTime" type="time" defaultValue={s.checkOutTime} className="input" /></Field>
          </div>
        </Section>

        <Section title="Tax & invoicing">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Tax name"><input name="taxName" defaultValue={s.taxName} className="input" /></Field>
            <Field label="Tax rate (%)"><input name="taxRate" type="number" step="0.01" defaultValue={(s.taxRate * 100).toString()} className="input" /></Field>
            <Field label="Invoice prefix"><input name="invoicePrefix" defaultValue={s.invoicePrefix} className="input" /></Field>
            <Field label="Next invoice #"><input value={s.invoiceNext} disabled className="input bg-gray-50" /></Field>
            <div className="md:col-span-2">
              <Field label="Invoice footer note"><textarea name="invoiceFooter" rows={2} defaultValue={s.invoiceFooter ?? ""} className="input" placeholder="Thank you for staying with us." /></Field>
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <button className="btn-primary">Save settings</button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h2 className="mb-4 font-semibold text-gray-800">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
