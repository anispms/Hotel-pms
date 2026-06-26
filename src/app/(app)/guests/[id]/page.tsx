import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { formatDate, formatMoney, nightsBetween } from "@/lib/domain";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function GuestProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propertyId = await requirePropertyId();
  const guest = await prisma.guest.findFirst({
    where: { id, propertyId },
    include: {
      reservations: {
        include: { roomType: true, room: true },
        orderBy: { checkIn: "desc" },
      },
    },
  });
  if (!guest) notFound();

  const stays = guest.reservations;
  const totalNights = stays
    .filter((r) => r.status === "CHECKED_OUT" || r.status === "CHECKED_IN")
    .reduce((a, r) => a + nightsBetween(r.checkIn, r.checkOut), 0);
  const lifetime = stays
    .filter((r) => r.status === "CHECKED_OUT" || r.status === "CHECKED_IN")
    .reduce((a, r) => a + r.ratePerNight * nightsBetween(r.checkIn, r.checkOut), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`${guest.firstName} ${guest.lastName}`}
        subtitle={[guest.city, guest.country].filter(Boolean).join(", ") || "Guest profile"}
        action={
          <div className="flex items-center gap-2">
            {guest.vip && <span className="badge bg-amber-100 text-amber-800">VIP</span>}
            <Link href="/guests" className="btn-secondary">← Back</Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="card space-y-2 p-5 text-sm md:col-span-1">
          <h2 className="mb-2 font-semibold text-gray-800">Contact</h2>
          <Field label="Email" value={guest.email} />
          <Field label="Phone" value={guest.phone} />
          <Field label="Address" value={guest.address} />
          <Field label="City" value={guest.city} />
          <Field label="Country" value={guest.country} />
          <Field label="ID / Passport" value={guest.idNumber} />
          {guest.notes && (
            <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">{guest.notes}</div>
          )}
        </div>

        <div className="space-y-6 md:col-span-2">
          <div className="grid grid-cols-3 gap-4">
            <Mini label="Stays" value={String(stays.length)} />
            <Mini label="Nights" value={String(totalNights)} />
            <Mini label="Lifetime value" value={formatMoney(lifetime)} />
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="font-semibold text-gray-800">Stay history</h2>
            </div>
            {stays.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No reservations yet.</div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>{["Confirmation", "Dates", "Room", "Status"].map((h) => <th key={h} className="th">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stays.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="td">
                        <Link href={`/reservations/${r.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                          {r.confirmation}
                        </Link>
                      </td>
                      <td className="td text-xs">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</td>
                      <td className="td">{r.roomType.name}{r.room ? ` · ${r.room.number}` : ""}</td>
                      <td className="td"><Badge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-800">{value || "—"}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
