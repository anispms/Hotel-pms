# Hotel X — Property Management System (PMS)

A multi-module hotel PMS built with **Next.js 15 (App Router), TypeScript, Tailwind CSS, and Prisma/SQLite**. It ships with seeded demo data so it runs immediately.

## Modules

| Module | What it does |
| --- | --- |
| **Dashboard** | Occupancy, ADR, RevPAR, arrivals/departures, in-house count, room revenue |
| **Front Desk** | Today's arrivals, departures (with check-out), and in-house guests |
| **Reservations** | List/filter/search, create bookings, full reservation lifecycle |
| **Reservation detail** | Check-in (room assignment + availability), check-out (balance-gated), cancel/no-show, and the guest **folio** (post charges & payments) |
| **Rooms** | Floor-by-floor room grid with housekeeping status and current occupant |
| **Housekeeping** | Status board (Clean / Dirty / Inspected / Out of order) with one-click updates |
| **Guests** | Guest CRM — profiles, contact info, stay history, lifetime value, VIP flag |
| **Rates & Inventory** | Manage room types, rate plans, and physical rooms |
| **Reports** | 7-day occupancy forecast, revenue by source, room-type performance, folio totals |
| **Report Builder** | Self-serve custom reports — pick dataset (reservations/guests/payments), date range, group-by, and **export CSV** |
| **Settings** | Property profile, currency/timezone, tax & fees, check-in/out times, invoice numbering |
| **Staff & Roles** | Add/disable staff, assign roles (Admin/Manager/Front Desk/Housekeeping) |
| **Integrations Hub** | Connectable catalog (booking engine, payments, door locks, accounting, channel manager) **+ Zapier/Make/custom webhook automation** with signed payloads, delivery log & event stream |
| **Invoicing** | Printable, PDF-ready invoice generated from the folio |
| **Onboarding** | Guided setup checklist that tracks real configuration progress |
| **Auth & tenancy** | Multi-tenant: an Organization owns multiple Properties; every record is property-scoped, with a property switcher and role-gated admin areas |

## Multi-tenancy & roles

The system is **multi-tenant**. An `Organization` (the account/customer) owns one
or more `Property` records (individual hotels). Every domain row — guests, rooms,
reservations, folios, integrations, events — carries a `propertyId` and is
filtered by the **currently selected property**. Users belong to an organization
and switch properties from the top-bar switcher; the choice is stored in a
signed cookie and validated against the user's organization on every switch, so
there is no cross-tenant access.

Server actions and detail pages re-verify ownership (`findFirst({ where: { id,
propertyId } })`), so a record from another property returns 404 rather than
leaking.

**Roles** (`ADMIN`, `MANAGER`, `FRONT_DESK`, `HOUSEKEEPING`) are enforced:
configuration, staff, and integrations pages/actions require `ADMIN`/`MANAGER`
via `requireRole(...)`; unauthorized users are redirected to the dashboard.

The seed creates one organization (**Sunrise Hospitality Group**) with two
demo properties — **Grand Plaza Downtown** (40 rooms) and **Seaside Resort
Beachfront** (20 rooms) — so isolation is visible immediately: switch the
property in the top bar and the entire app re-scopes.

## Integrations & automation

The PMS emits domain **events** (`reservation.created`, `guest.checked_in`,
`guest.checked_out`, `payment.recorded`, `folio.charge_posted`,
`housekeeping.updated`, …). Each event is logged to an activity stream and
fanned out to every active webhook endpoint subscribed to it.

To automate with **Zapier** or **Make**: create a catch-hook / custom-webhook
trigger, copy its URL, and add it under **Settings → Integrations** as an
endpoint (choosing which events should fire it). Optionally set a signing
secret — payloads are then signed with HMAC-SHA256 in the `X-PMS-Signature`
header. Deliveries (success/failure + status code) are recorded in the
delivery log. Delivery failures never block hotel operations.

The engine lives in `src/lib/events.ts`; events are emitted from the relevant
server actions in `src/lib/actions.ts`.

## Quick start

```bash
cd hotel-pms
npm install
npm run setup     # prisma generate + db push + seed
npm run dev       # http://localhost:3000
```

`npm run setup` creates `prisma/dev.db`, applies the schema, and seeds 4 staff
accounts, 4 room types, 40 rooms, 15 guests, and 21 reservations spanning past,
present, and future dates (with folios).

### Demo accounts (password: `password123`)

- `admin@hotelx.com` — Admin
- `manager@hotelx.com` — Manager
- `frontdesk@hotelx.com` — Front Desk
- `housekeeping@hotelx.com` — Housekeeping

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build (runs `prisma generate` first)
- `npm run setup` — generate client, push schema, seed
- `npm run db:reset` — wipe and re-seed the database
- `npm run db:seed` — re-run the seed only
- `npm run e2e` — run the Playwright end-to-end smoke suite

## End-to-end tests

A Playwright suite (`e2e/smoke.spec.ts`) drives the real UI in a browser and
covers the things that only break on real form submission:

1. **Full front-desk lifecycle** — log in, add a guest, create a booking,
   check in (room assignment + auto-posted room & tax charges), record a
   payment, check out (balance-gated), and open the invoice.
2. **Property switcher** — switching the active property re-scopes the app.
3. **Role enforcement** — a housekeeping user is redirected away from admin
   settings.

Run with `npm run e2e` (it builds/starts the app automatically via Playwright's
`webServer`). The config uses a pre-installed Chromium when present and falls
back to Playwright's managed browser otherwise.

## Architecture

- **Data model** — `prisma/schema.prisma`: `User`, `Guest`, `RoomType`, `Room`,
  `RatePlan`, `Reservation`, `Folio`, `FolioItem`.
- **Server actions** — `src/lib/actions.ts`: all mutations (booking lifecycle,
  check-in/out, folio postings, housekeeping, inventory). Check-in posts room +
  tax charges automatically; check-out is blocked until the folio balance is zero.
- **Domain helpers** — `src/lib/domain.ts`: nights/date math, money formatting,
  folio totals, availability overlap, status badges.
- **Auth** — `src/lib/auth.ts`: scrypt password hashing + HMAC-signed session
  cookie. The `(app)` route group enforces authentication.

## Notes

This is a functional reference implementation / MVP foundation. Natural next
steps: channel-manager/OTA sync, payment gateway integration, multi-property
support, night-audit automation, group blocks, and granular role permissions.
