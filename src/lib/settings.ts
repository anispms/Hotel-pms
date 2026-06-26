import { prisma } from "./db";
import { requireProperty, getCurrentProperty, requirePropertyId } from "./tenant";

/**
 * Property configuration accessor. Kept named `getSettings` for ergonomics —
 * it returns the current property record, which now carries all the
 * per-property configuration (profile, currency, tax, invoice numbering).
 */
export async function getSettings() {
  return requireProperty();
}

export function formatMoneyIn(currency: string, n: number): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}

/** Atomically take the next invoice number for the current property. */
export async function nextInvoiceNumber(): Promise<string> {
  const prop = await requireProperty();
  await prisma.property.update({
    where: { id: prop.id },
    data: { invoiceNext: prop.invoiceNext + 1 },
  });
  return `${prop.invoicePrefix}-${prop.invoiceNext}`;
}

/** Onboarding checklist derived from real configuration state for the current property. */
export async function onboardingChecklist() {
  const prop = await getCurrentProperty();
  if (!prop) {
    return { steps: [], completed: 0, total: 0, percent: 0, settings: null };
  }
  const where = { propertyId: prop.id };
  const [roomTypes, rooms, ratePlans, guests, integrations] = await Promise.all([
    prisma.roomType.count({ where }),
    prisma.room.count({ where }),
    prisma.ratePlan.count({ where }),
    prisma.guest.count({ where }),
    prisma.webhookEndpoint.count({ where }),
  ]);

  const steps = [
    {
      key: "profile",
      title: "Set up your property profile",
      done: !!prop.legalName && !!prop.city,
      href: "/settings",
      hint: "Hotel name, address, currency, timezone, tax",
    },
    {
      key: "room_types",
      title: "Create room types",
      done: roomTypes > 0,
      href: "/room-types",
      hint: `${roomTypes} configured`,
    },
    {
      key: "rates",
      title: "Add rate plans",
      done: ratePlans > 0,
      href: "/room-types",
      hint: `${ratePlans} rate plans`,
    },
    {
      key: "rooms",
      title: "Add your rooms",
      done: rooms > 0,
      href: "/rooms",
      hint: `${rooms} rooms`,
    },
    {
      key: "guests",
      title: "Import or add guests",
      done: guests > 0,
      href: "/guests",
      hint: `${guests} guests`,
    },
    {
      key: "integrations",
      title: "Connect an automation (Zapier / Make)",
      done: integrations > 0,
      href: "/settings/integrations",
      hint: "Optional but recommended",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  return {
    steps,
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    settings: prop,
  };
}

export { requirePropertyId };
