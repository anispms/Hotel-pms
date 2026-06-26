import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui";
import { dateOnly, formatMoney, nightsBetween, rangesOverlap, formatDate } from "@/lib/domain";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const propertyId = await requirePropertyId();
  const today = dateOnly(new Date());
  const totalRooms = await prisma.room.count({ where: { propertyId } });

  const reservations = await prisma.reservation.findMany({
    where: { propertyId },
    include: { roomType: true, folio: { include: { items: true } } },
  });

  const realised = reservations.filter(
    (r) => r.status === "CHECKED_IN" || r.status === "CHECKED_OUT"
  );

  // 7-day occupancy forecast
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const day = dateOnly(new Date());
    day.setDate(day.getDate() + i);
    const next = dateOnly(new Date());
    next.setDate(next.getDate() + i + 1);
    const occ = reservations.filter(
      (r) =>
        (r.status === "BOOKED" || r.status === "CHECKED_IN" || r.status === "CHECKED_OUT") &&
        rangesOverlap(day, next, r.checkIn, r.checkOut)
    ).length;
    return { day, occ, pct: totalRooms ? Math.round((occ / totalRooms) * 100) : 0 };
  });

  // Revenue by source
  const bySource: Record<string, { count: number; revenue: number }> = {};
  for (const r of reservations) {
    if (r.status === "CANCELLED" || r.status === "NO_SHOW") continue;
    const rev = r.ratePerNight * nightsBetween(r.checkIn, r.checkOut);
    bySource[r.source] = bySource[r.source] || { count: 0, revenue: 0 };
    bySource[r.source].count++;
    bySource[r.source].revenue += rev;
  }

  // Room type performance
  const byType: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const r of realised) {
    const rev = r.ratePerNight * nightsBetween(r.checkIn, r.checkOut);
    byType[r.roomType.code] = byType[r.roomType.code] || { name: r.roomType.name, count: 0, revenue: 0 };
    byType[r.roomType.code].count++;
    byType[r.roomType.code].revenue += rev;
  }

  // Folio totals
  let postedCharges = 0;
  let collectedPayments = 0;
  for (const r of reservations) {
    for (const it of r.folio?.items ?? []) {
      if (it.kind === "CHARGE") postedCharges += it.amount;
      else collectedPayments += it.amount;
    }
  }

  const totalRoomRevenue = realised.reduce(
    (a, r) => a + r.ratePerNight * nightsBetween(r.checkIn, r.checkOut),
    0
  );
  const totalRoomNights = realised.reduce((a, r) => a + nightsBetween(r.checkIn, r.checkOut), 0);
  const adr = totalRoomNights ? totalRoomRevenue / totalRoomNights : 0;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Manager report & analytics"
        action={<a href="/reports/builder" className="btn-secondary">🧮 Custom report builder →</a>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Room revenue (realised)" value={formatMoney(totalRoomRevenue)} accent="brand" />
        <StatCard label="Average daily rate" value={formatMoney(adr)} accent="brand" />
        <StatCard label="Posted charges" value={formatMoney(postedCharges)} accent="amber" />
        <StatCard label="Payments collected" value={formatMoney(collectedPayments)} accent="green" />
      </div>

      <div className="mt-6 card p-5">
        <h2 className="mb-4 font-semibold text-gray-800">7-day occupancy forecast</h2>
        <div className="space-y-3">
          {forecast.map((f) => (
            <div key={f.day.toISOString()} className="flex items-center gap-4">
              <div className="w-28 shrink-0 text-sm text-gray-600">{formatDate(f.day)}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="flex h-6 items-center justify-end rounded-full bg-brand-500 pr-2 text-[11px] font-semibold text-white"
                  style={{ width: `${Math.max(f.pct, 6)}%` }}
                >
                  {f.pct}%
                </div>
              </div>
              <div className="w-24 shrink-0 text-right text-xs text-gray-500">{f.occ}/{totalRooms} rooms</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-gray-800">Revenue by source</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-400"><th className="pb-2">Source</th><th className="pb-2">Bookings</th><th className="pb-2 text-right">Revenue</th></tr></thead>
            <tbody>
              {Object.entries(bySource).sort((a, b) => b[1].revenue - a[1].revenue).map(([src, v]) => (
                <tr key={src} className="border-t border-gray-100">
                  <td className="py-2">{src.replace(/_/g, " ")}</td>
                  <td className="py-2">{v.count}</td>
                  <td className="py-2 text-right font-medium">{formatMoney(v.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-gray-800">Room type performance</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-400"><th className="pb-2">Type</th><th className="pb-2">Stays</th><th className="pb-2 text-right">Revenue</th></tr></thead>
            <tbody>
              {Object.entries(byType).sort((a, b) => b[1].revenue - a[1].revenue).map(([code, v]) => (
                <tr key={code} className="border-t border-gray-100">
                  <td className="py-2"><span className="font-mono text-xs text-gray-400">{code}</span> {v.name}</td>
                  <td className="py-2">{v.count}</td>
                  <td className="py-2 text-right font-medium">{formatMoney(v.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
