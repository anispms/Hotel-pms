import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, Badge } from "@/components/ui";
import { dateOnly, formatMoney, rangesOverlap, formatDate } from "@/lib/domain";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  const propertyId = await requirePropertyId();
  const today = dateOnly(new Date());
  const tomorrow = dateOnly(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [totalRooms, reservations, guestsCount] = await Promise.all([
    prisma.room.count({ where: { propertyId } }),
    prisma.reservation.findMany({
      where: { propertyId },
      include: { guest: true, roomType: true, room: true },
    }),
    prisma.guest.count({ where: { propertyId } }),
  ]);

  const active = reservations.filter((r) => r.status === "BOOKED" || r.status === "CHECKED_IN");

  // Occupied tonight: a stay covering [today, tomorrow) that is checked-in
  const inHouse = reservations.filter((r) => r.status === "CHECKED_IN");
  const occupiedTonight = inHouse.filter((r) =>
    rangesOverlap(today, tomorrow, r.checkIn, r.checkOut)
  ).length;

  const arrivals = active.filter(
    (r) => r.status === "BOOKED" && dateOnly(r.checkIn).getTime() === today.getTime()
  );
  const departures = inHouse.filter(
    (r) => dateOnly(r.checkOut).getTime() === today.getTime()
  );

  const occupancy = totalRooms ? Math.round((occupiedTonight / totalRooms) * 100) : 0;
  const roomRevenueTonight = inHouse
    .filter((r) => rangesOverlap(today, tomorrow, r.checkIn, r.checkOut))
    .reduce((a, r) => a + r.ratePerNight, 0);
  const adr = occupiedTonight ? roomRevenueTonight / occupiedTonight : 0;
  const revpar = totalRooms ? roomRevenueTonight / totalRooms : 0;

  const upcoming = active
    .filter((r) => r.status === "BOOKED" && dateOnly(r.checkIn) >= today)
    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime())
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Operational snapshot for ${formatDate(today)}`}
      />

      {denied && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You don't have permission to access that area. Contact an administrator if you need access.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Occupancy tonight" value={`${occupancy}%`} hint={`${occupiedTonight} of ${totalRooms} rooms`} accent="brand" />
        <StatCard label="Arrivals today" value={arrivals.length} hint="Expected check-ins" accent="green" />
        <StatCard label="Departures today" value={departures.length} hint="Expected check-outs" accent="amber" />
        <StatCard label="In-house guests" value={inHouse.length} hint={`${guestsCount} guests on file`} accent="gray" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="ADR" value={formatMoney(adr)} hint="Average daily rate" accent="brand" />
        <StatCard label="RevPAR" value={formatMoney(revpar)} hint="Revenue per available room" accent="brand" />
        <StatCard label="Room revenue tonight" value={formatMoney(roomRevenueTonight)} accent="green" />
        <StatCard label="Active reservations" value={active.length} accent="gray" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Arrivals today" href="/front-desk">
          {arrivals.length === 0 ? (
            <Empty>No arrivals scheduled.</Empty>
          ) : (
            arrivals.map((r) => (
              <Row key={r.id} href={`/reservations/${r.id}`}>
                <div>
                  <div className="font-medium">{r.guest.firstName} {r.guest.lastName}</div>
                  <div className="text-xs text-gray-500">{r.roomType.name} · {r.confirmation}</div>
                </div>
                <Badge status={r.status} />
              </Row>
            ))
          )}
        </Panel>

        <Panel title="Departures today" href="/front-desk">
          {departures.length === 0 ? (
            <Empty>No departures scheduled.</Empty>
          ) : (
            departures.map((r) => (
              <Row key={r.id} href={`/reservations/${r.id}`}>
                <div>
                  <div className="font-medium">{r.guest.firstName} {r.guest.lastName}</div>
                  <div className="text-xs text-gray-500">
                    Room {r.room?.number ?? "—"} · {r.roomType.name}
                  </div>
                </div>
                <Badge status={r.status} />
              </Row>
            ))
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Upcoming reservations" href="/reservations">
          {upcoming.length === 0 ? (
            <Empty>Nothing upcoming.</Empty>
          ) : (
            upcoming.map((r) => (
              <Row key={r.id} href={`/reservations/${r.id}`}>
                <div>
                  <div className="font-medium">{r.guest.firstName} {r.guest.lastName}</div>
                  <div className="text-xs text-gray-500">{r.roomType.name} · {r.confirmation}</div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {formatDate(r.checkIn)}
                </div>
              </Row>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="font-semibold text-gray-800">{title}</h2>
        <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">
          View all →
        </Link>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
      {children}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm text-gray-400">{children}</div>;
}
