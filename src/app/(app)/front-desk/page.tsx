import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { dateOnly, formatDate, formatMoney, folioBalance } from "@/lib/domain";
import { checkOut } from "@/lib/actions";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function FrontDesk() {
  const propertyId = await requirePropertyId();
  const today = dateOnly(new Date());

  const reservations = await prisma.reservation.findMany({
    where: { propertyId },
    include: { guest: true, roomType: true, room: true, folio: { include: { items: true } } },
    orderBy: { checkIn: "asc" },
  });

  const arrivals = reservations.filter(
    (r) => r.status === "BOOKED" && dateOnly(r.checkIn).getTime() === today.getTime()
  );
  const departures = reservations.filter(
    (r) => r.status === "CHECKED_IN" && dateOnly(r.checkOut).getTime() === today.getTime()
  );
  const inHouse = reservations.filter((r) => r.status === "CHECKED_IN");

  return (
    <div>
      <PageHeader title="Front Desk" subtitle={formatDate(today)} />

      <Section title="Arrivals" count={arrivals.length} accent="green">
        {arrivals.length === 0 ? (
          <Empty>No arrivals today.</Empty>
        ) : (
          <Table head={["Guest", "Room type", "Nights", "Confirmation", ""]}>
            {arrivals.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="td">
                  <Link href={`/reservations/${r.id}`} className="font-medium text-brand-700 hover:underline">
                    {r.guest.firstName} {r.guest.lastName}
                  </Link>
                  {r.guest.vip && <span className="ml-2 badge bg-amber-100 text-amber-800">VIP</span>}
                </td>
                <td className="td">{r.roomType.name}</td>
                <td className="td">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</td>
                <td className="td font-mono text-xs">{r.confirmation}</td>
                <td className="td text-right">
                  <Link href={`/reservations/${r.id}`} className="btn-primary !py-1.5 text-xs">
                    Check in →
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Departures" count={departures.length} accent="amber">
        {departures.length === 0 ? (
          <Empty>No departures today.</Empty>
        ) : (
          <Table head={["Guest", "Room", "Balance", "", ""]}>
            {departures.map((r) => {
              const balance = folioBalance(r.folio?.items ?? []);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/reservations/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.guest.firstName} {r.guest.lastName}
                    </Link>
                  </td>
                  <td className="td">Room {r.room?.number ?? "—"}</td>
                  <td className="td">
                    <span className={balance > 0 ? "font-semibold text-red-600" : "text-green-600"}>
                      {formatMoney(balance)}
                    </span>
                  </td>
                  <td className="td"><Badge status={r.status} /></td>
                  <td className="td text-right">
                    {balance > 0 ? (
                      <Link href={`/reservations/${r.id}`} className="btn-secondary !py-1.5 text-xs">
                        Settle folio
                      </Link>
                    ) : (
                      <form action={checkOut}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn-success !py-1.5 text-xs">Check out →</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Section>

      <Section title="In-house" count={inHouse.length} accent="brand">
        {inHouse.length === 0 ? (
          <Empty>No in-house guests.</Empty>
        ) : (
          <Table head={["Guest", "Room", "Departing", "Balance", ""]}>
            {inHouse.map((r) => {
              const balance = folioBalance(r.folio?.items ?? []);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="td">
                    <Link href={`/reservations/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.guest.firstName} {r.guest.lastName}
                    </Link>
                  </td>
                  <td className="td">Room {r.room?.number ?? "—"}</td>
                  <td className="td">{formatDate(r.checkOut)}</td>
                  <td className="td">{formatMoney(balance)}</td>
                  <td className="td text-right">
                    <Link href={`/reservations/${r.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                      Open →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: "green" | "amber" | "brand";
  children: React.ReactNode;
}) {
  const dot = { green: "bg-green-500", amber: "bg-amber-500", brand: "bg-brand-500" }[accent];
  return (
    <div className="mb-6 card">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h2 className="font-semibold text-gray-800">{title}</h2>
        <span className="badge bg-gray-100 text-gray-600">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full">
      <thead className="border-b border-gray-100 bg-gray-50">
        <tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm text-gray-400">{children}</div>;
}
