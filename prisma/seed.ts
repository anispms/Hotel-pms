import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function nights(a: Date, b: Date): number {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

const TAX_RATE = 0.12;
let confirmSeq = 1000; // globally unique confirmation counter

type PropertySeed = {
  name: string;
  legalName: string;
  city: string;
  country: string;
  currency: string;
  timezone: string;
  email: string;
  phone: string;
  layout: { code: string; count: number }[];
  guestCount: number;
};

const ROOM_TYPE_DEFS = [
  { code: "STD", name: "Standard Queen", baseRate: 119, maxOccupancy: 2, description: "Cozy room with a queen bed and city view." },
  { code: "DLX", name: "Deluxe King", baseRate: 169, maxOccupancy: 2, description: "Spacious king room with sitting area." },
  { code: "STE", name: "Executive Suite", baseRate: 289, maxOccupancy: 3, description: "Separate living room, premium amenities." },
  { code: "FAM", name: "Family Room", baseRate: 219, maxOccupancy: 4, description: "Two queen beds, perfect for families." },
];

const GUEST_POOL = [
  { firstName: "James", lastName: "Carter", city: "San Francisco", country: "USA", vip: true },
  { firstName: "Sophie", lastName: "Nguyen", city: "New York", country: "USA" },
  { firstName: "Liam", lastName: "O'Brien", city: "Dublin", country: "Ireland" },
  { firstName: "Aisha", lastName: "Khan", city: "London", country: "UK", vip: true },
  { firstName: "Mateo", lastName: "Rossi", city: "Rome", country: "Italy" },
  { firstName: "Yuki", lastName: "Tanaka", city: "Tokyo", country: "Japan" },
  { firstName: "Emma", lastName: "Schmidt", city: "Berlin", country: "Germany" },
  { firstName: "Noah", lastName: "Williams", city: "Miami", country: "USA" },
  { firstName: "Olivia", lastName: "Martin", city: "Paris", country: "France" },
  { firstName: "Lucas", lastName: "Silva", city: "São Paulo", country: "Brazil" },
  { firstName: "Mia", lastName: "Johansson", city: "Stockholm", country: "Sweden" },
  { firstName: "Daniel", lastName: "Park", city: "Seoul", country: "South Korea", vip: true },
  { firstName: "Grace", lastName: "Thompson", city: "Sydney", country: "Australia" },
  { firstName: "Omar", lastName: "Haddad", city: "Dubai", country: "UAE" },
  { firstName: "Chloe", lastName: "Dubois", city: "Montreal", country: "Canada" },
];

async function seedProperty(organizationId: string, def: PropertySeed) {
  const property = await prisma.property.create({
    data: {
      organizationId,
      name: def.name,
      legalName: def.legalName,
      email: def.email,
      phone: def.phone,
      website: "https://hotelx.example",
      addressLine: "123 Ocean Avenue",
      city: def.city,
      country: def.country,
      currency: def.currency,
      timezone: def.timezone,
      taxRate: TAX_RATE,
      taxName: "Room Tax",
      invoicePrefix: def.name.includes("Beach") ? "BCH" : "INV",
      invoiceNext: 1001,
      invoiceFooter: `Thank you for staying with ${def.name}.`,
      onboardedAt: new Date(),
    },
  });
  const propertyId = property.id;

  // Room types + rate plans
  const roomTypes: Record<string, { id: string; baseRate: number }> = {};
  for (const rt of ROOM_TYPE_DEFS) {
    const created = await prisma.roomType.create({ data: { propertyId, ...rt } });
    roomTypes[rt.code] = { id: created.id, baseRate: rt.baseRate };
    await prisma.ratePlan.create({ data: { propertyId, code: `${rt.code}-BAR`, name: "Best Available Rate", roomTypeId: created.id, rate: rt.baseRate } });
    await prisma.ratePlan.create({ data: { propertyId, code: `${rt.code}-ADV`, name: "Advance Purchase (-15%)", roomTypeId: created.id, rate: Math.round(rt.baseRate * 0.85) } });
    await prisma.ratePlan.create({ data: { propertyId, code: `${rt.code}-BB`, name: "Bed & Breakfast", roomTypeId: created.id, rate: rt.baseRate + 25, includesBreakfast: true } });
  }

  // Rooms
  const rooms: { id: string; number: string; code: string }[] = [];
  let floor = 1;
  let onFloor = 0;
  for (const seg of def.layout) {
    for (let i = 0; i < seg.count; i++) {
      if (onFloor === 10) { floor++; onFloor = 0; }
      onFloor++;
      const number = `${floor}${String(onFloor).padStart(2, "0")}`;
      const roll = Math.random();
      const hkStatus = roll < 0.65 ? "CLEAN" : roll < 0.85 ? "DIRTY" : roll < 0.95 ? "INSPECTED" : "OUT_OF_ORDER";
      const created = await prisma.room.create({ data: { propertyId, number, floor, roomTypeId: roomTypes[seg.code].id, hkStatus } });
      rooms.push({ id: created.id, number, code: seg.code });
    }
  }

  // Guests (slice of the shared pool, scoped to this property)
  const guests = [];
  for (const g of GUEST_POOL.slice(0, def.guestCount)) {
    guests.push(await prisma.guest.create({
      data: {
        propertyId,
        firstName: g.firstName,
        lastName: g.lastName,
        email: `${g.firstName.toLowerCase()}.${g.lastName.replace(/[^a-z]/gi, "").toLowerCase()}@example.com`,
        phone: "+1 555 010" + String(guests.length).padStart(2, "0"),
        city: g.city,
        country: g.country,
        vip: g.vip ?? false,
      },
    }));
  }

  // Reservations across past/present/future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const G = guests.length;
  const schedule: [number, string, number, number, string][] = [
    [0 % G, "STE", -2, 4, "CHECKED_IN"],
    [3 % G, "DLX", -1, 3, "CHECKED_IN"],
    [5 % G, "STD", -3, 5, "CHECKED_IN"],
    [1 % G, "DLX", 0, 2, "BOOKED"],
    [2 % G, "STD", 0, 3, "BOOKED"],
    [4 % G, "FAM", 2, 4, "BOOKED"],
    [2 % G, "STD", -2, 2, "CHECKED_IN"],
    [1 % G, "STD", -10, 3, "CHECKED_OUT"],
    [4 % G, "DLX", -15, 2, "CHECKED_OUT"],
    [3 % G, "STD", 1, 2, "CANCELLED"],
  ];

  for (const [gi, code, offIn, len, status] of schedule) {
    const checkIn = addDays(today, offIn);
    const checkOut = addDays(checkIn, len);
    const rt = roomTypes[code];
    const ratePerNight = rt.baseRate;
    let roomId: string | null = null;
    if (status === "CHECKED_IN" || status === "CHECKED_OUT") {
      roomId = rooms.find((r) => r.code === code)?.id ?? null;
    }
    const confirmation = "HX-" + (confirmSeq++).toString(36).toUpperCase().padStart(6, "0");
    const resv = await prisma.reservation.create({
      data: {
        propertyId,
        confirmation,
        guestId: guests[gi].id,
        roomTypeId: rt.id,
        roomId,
        checkIn,
        checkOut,
        adults: code === "FAM" ? 2 : 1,
        children: code === "FAM" ? 2 : 0,
        ratePerNight,
        source: ["DIRECT", "OTA", "PHONE", "CORPORATE"][confirmSeq % 4],
        status,
      },
    });
    if (status === "CHECKED_IN" || status === "CHECKED_OUT") {
      const folio = await prisma.folio.create({ data: { reservationId: resv.id } });
      const n = nights(checkIn, checkOut);
      for (let d = 0; d < n; d++) {
        const night = addDays(checkIn, d);
        await prisma.folioItem.create({ data: { folioId: folio.id, kind: "CHARGE", category: "ROOM", description: `Room charge — ${night.toISOString().slice(0, 10)}`, amount: ratePerNight, postedAt: night } });
        await prisma.folioItem.create({ data: { folioId: folio.id, kind: "CHARGE", category: "TAX", description: "Room tax (12%)", amount: Math.round(ratePerNight * TAX_RATE * 100) / 100, postedAt: night } });
      }
      if (status === "CHECKED_OUT") {
        const total = ratePerNight * n * (1 + TAX_RATE);
        await prisma.folioItem.create({ data: { folioId: folio.id, kind: "PAYMENT", category: "PAYMENT", description: "Visa ****4242", amount: Math.round(total * 100) / 100 } });
      }
    }
  }

  // A sample integration + automation webhook per property
  await prisma.integration.create({
    data: { propertyId, key: "payment", name: "Payment Gateway", category: "PAYMENT", enabled: true, config: JSON.stringify({ provider: "stripe", publishable_key: "pk_test_demo" }) },
  });
  await prisma.webhookEndpoint.create({
    data: { propertyId, name: "Zapier — new bookings", url: "https://hooks.zapier.com/hooks/catch/000000/demo/", provider: "ZAPIER", events: "reservation.created,guest.checked_in,guest.checked_out" },
  });

  return { propertyId, rooms: rooms.length, guests: guests.length, reservations: schedule.length };
}

async function main() {
  console.log("Resetting data…");
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.eventLog.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.folioItem.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.property.deleteMany();
  await prisma.organization.deleteMany();

  // ── Organization (the tenant / account) ──
  const org = await prisma.organization.create({ data: { name: "Sunrise Hospitality Group" } });
  console.log(`Created organization: ${org.name}`);

  // ── Staff (shared across the org's properties) ──
  const users = [
    { name: "Avery Admin", email: "admin@hotelx.com", role: "ADMIN" },
    { name: "Morgan Manager", email: "manager@hotelx.com", role: "MANAGER" },
    { name: "Dana Desk", email: "frontdesk@hotelx.com", role: "FRONT_DESK" },
    { name: "Hayden House", email: "housekeeping@hotelx.com", role: "HOUSEKEEPING" },
  ];
  for (const u of users) {
    await prisma.user.create({ data: { ...u, organizationId: org.id, passwordHash: hashPassword("password123") } });
  }
  console.log(`Created ${users.length} users (password: password123)`);

  // ── Two properties to demonstrate tenant isolation ──
  const a = await seedProperty(org.id, {
    name: "Grand Plaza Downtown",
    legalName: "Grand Plaza Hotels LLC",
    city: "San Francisco", country: "USA", currency: "USD", timezone: "America/Los_Angeles",
    email: "front@grandplaza.com", phone: "+1 415 555 0100",
    layout: [{ code: "STD", count: 16 }, { code: "DLX", count: 12 }, { code: "FAM", count: 8 }, { code: "STE", count: 4 }],
    guestCount: 15,
  });
  console.log(`Property A (Grand Plaza): ${a.rooms} rooms, ${a.guests} guests, ${a.reservations} reservations`);

  const b = await seedProperty(org.id, {
    name: "Seaside Resort Beachfront",
    legalName: "Seaside Resorts Inc",
    city: "Miami", country: "USA", currency: "USD", timezone: "America/New_York",
    email: "front@seasideresort.com", phone: "+1 305 555 0200",
    layout: [{ code: "STD", count: 8 }, { code: "DLX", count: 6 }, { code: "STE", count: 6 }],
    guestCount: 8,
  });
  console.log(`Property B (Seaside Resort): ${b.rooms} rooms, ${b.guests} guests, ${b.reservations} reservations`);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
