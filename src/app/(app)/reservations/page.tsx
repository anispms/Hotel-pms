import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Badge, LinkButton } from "@/components/ui";
import { formatDate, formatMoney, nightsBetween, RESERVATION_STATUSES } from "@/lib/domain";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const propertyId = await requirePropertyId();

  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: status && RESERVATION_STATUSES.includes(status as never) ? status : undefined,
      OR: q
        ? [
            { confirmation: { contains: q } },
            { guest: { firstName: { contains: q } } },
            { guest: { lastName: { contains: q } } },
          ]
        : undefined,
    },
    include: { guest: true, roomType: true, room: true },
    orderBy: { checkIn: "desc" },
  });

  const filters = ["ALL", ...RESERVATION_STATUSES];

  return (
    <div>
      <PageHeader
        title="Reservations"
        subtitle={`${reservations.length} ${status && status !== "ALL" ? status.toLowerCase().replace(/_/g, " ") : ""} reservation(s)`}
        action={<LinkButton href="/reservations/new">+ New reservation</LinkButton>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => {
          const isActive = (f === "ALL" && !status) || status === f;
          const href = f === "ALL" ? "/reservations" : `/reservations?status=${f}`;
          return (
            <Link
              key={f}
              href={href}
              className={`badge border px-3 py-1 ${
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.replace(/_/g, " ")}
            </Link>
          );
        })}
        <form className="ml-auto" action="/reservations">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or confirmation…"
            className="input !w-64"
          />
        </form>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              {["Confirmation", "Guest", "Room type", "Check-in", "Check-out", "Nights", "Total", "Status"].map((h) => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={8} className="td py-12 text-center text-gray-400">
                  No reservations match your filter.
                </td>
              </tr>
            ) : (
              reservations.map((r) => {
                const nights = nightsBetween(r.checkIn, r.checkOut);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="td">
                      <Link href={`/reservations/${r.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                        {r.confirmation}
                      </Link>
                    </td>
                    <td className="td font-medium">
                      {r.guest.firstName} {r.guest.lastName}
                      {r.guest.vip && <span className="ml-2 badge bg-amber-100 text-amber-800">VIP</span>}
                    </td>
                    <td className="td">{r.roomType.name}{r.room ? ` · ${r.room.number}` : ""}</td>
                    <td className="td">{formatDate(r.checkIn)}</td>
                    <td className="td">{formatDate(r.checkOut)}</td>
                    <td className="td">{nights}</td>
                    <td className="td">{formatMoney(r.ratePerNight * nights)}</td>
                    <td className="td"><Badge status={r.status} /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
