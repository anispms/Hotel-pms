import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import {
  formatDate,
  formatMoney,
  nightsBetween,
  folioTotals,
  FOLIO_CATEGORIES,
} from "@/lib/domain";
import {
  checkIn,
  checkOut,
  cancelReservation,
  markNoShow,
  postCharge,
  postPayment,
  deleteFolioItem,
  availableRoomsFor,
} from "@/lib/actions";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  noroom: "Please select a room to check the guest in.",
  balance: "Outstanding balance must be settled before check-out.",
  amount: "Enter an amount greater than zero.",
};

export default async function ReservationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const propertyId = await requirePropertyId();

  const r = await prisma.reservation.findFirst({
    where: { id, propertyId },
    include: {
      guest: true,
      roomType: true,
      room: true,
      folio: { include: { items: { orderBy: { postedAt: "asc" } } } },
    },
  });
  if (!r) notFound();

  const nights = nightsBetween(r.checkIn, r.checkOut);
  const items = r.folio?.items ?? [];
  const totals = folioTotals(items);

  const available =
    r.status === "BOOKED"
      ? await availableRoomsFor(propertyId, r.roomTypeId, r.checkIn, r.checkOut, r.id)
      : [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${r.guest.firstName} ${r.guest.lastName}`}
        subtitle={`${r.confirmation} · ${r.roomType.name}`}
        action={
          <div className="flex items-center gap-2">
            <Badge status={r.status} />
            <Link href={`/reservations/${r.id}/invoice`} className="btn-secondary">🧾 Invoice</Link>
            <Link href="/reservations" className="btn-secondary">← Back</Link>
          </div>
        }
      />

      {error && ERRORS[error] && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{ERRORS[error]}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stay & guest */}
        <div className="space-y-6 lg:col-span-1">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Stay</h2>
            <dl className="space-y-2 text-sm">
              <Info label="Check-in" value={formatDate(r.checkIn)} />
              <Info label="Check-out" value={formatDate(r.checkOut)} />
              <Info label="Nights" value={String(nights)} />
              <Info label="Guests" value={`${r.adults} adult(s), ${r.children} child(ren)`} />
              <Info label="Room type" value={r.roomType.name} />
              <Info label="Room" value={r.room ? r.room.number : "Not assigned"} />
              <Info label="Rate / night" value={formatMoney(r.ratePerNight)} />
              <Info label="Source" value={r.source.replace(/_/g, " ")} />
            </dl>
            {r.notes && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{r.notes}</div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Guest</h2>
            <Link href={`/guests/${r.guest.id}`} className="text-sm font-medium text-brand-700 hover:underline">
              {r.guest.firstName} {r.guest.lastName} {r.guest.vip ? "· VIP" : ""}
            </Link>
            <dl className="mt-2 space-y-1 text-sm text-gray-600">
              {r.guest.email && <div>{r.guest.email}</div>}
              {r.guest.phone && <div>{r.guest.phone}</div>}
              {(r.guest.city || r.guest.country) && (
                <div>{[r.guest.city, r.guest.country].filter(Boolean).join(", ")}</div>
              )}
            </dl>
          </div>

          {/* Lifecycle actions */}
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Actions</h2>
            {r.status === "BOOKED" && (
              <div className="space-y-3">
                <form action={checkIn} className="space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="label">Assign room & check in</label>
                  {available.length === 0 ? (
                    <p className="text-xs text-red-500">No available rooms of this type for these dates.</p>
                  ) : (
                    <>
                      <select name="roomId" className="input" required>
                        {available.map((room) => (
                          <option key={room.id} value={room.id}>
                            Room {room.number} (floor {room.floor})
                          </option>
                        ))}
                      </select>
                      <button className="btn-success w-full">Check in</button>
                    </>
                  )}
                </form>
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <form action={cancelReservation} className="flex-1">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-danger w-full !py-1.5 text-xs">Cancel</button>
                  </form>
                  <form action={markNoShow} className="flex-1">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-secondary w-full !py-1.5 text-xs">No-show</button>
                  </form>
                </div>
              </div>
            )}
            {r.status === "CHECKED_IN" && (
              <form action={checkOut}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn-success w-full" disabled={totals.balance > 0.005}>
                  Check out
                </button>
                {totals.balance > 0.005 && (
                  <p className="mt-2 text-xs text-red-500">
                    Settle the {formatMoney(totals.balance)} balance to enable check-out.
                  </p>
                )}
              </form>
            )}
            {(r.status === "CHECKED_OUT" || r.status === "CANCELLED" || r.status === "NO_SHOW") && (
              <p className="text-sm text-gray-400">No actions available — reservation is {r.status.replace(/_/g, " ").toLowerCase()}.</p>
            )}
          </div>
        </div>

        {/* Folio */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="font-semibold text-gray-800">Folio</h2>
              <span className="text-sm text-gray-500">{items.length} item(s)</span>
            </div>

            {items.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No charges or payments posted yet.
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Description</th>
                    <th className="th">Category</th>
                    <th className="th text-right">Charge</th>
                    <th className="th text-right">Payment</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="td whitespace-nowrap text-xs text-gray-500">
                        {formatDate(it.postedAt)}
                      </td>
                      <td className="td">{it.description}</td>
                      <td className="td">
                        <span className="badge bg-gray-100 text-gray-600">{it.category}</span>
                      </td>
                      <td className="td text-right">
                        {it.kind === "CHARGE" ? formatMoney(it.amount) : ""}
                      </td>
                      <td className="td text-right text-green-600">
                        {it.kind === "PAYMENT" ? formatMoney(it.amount) : ""}
                      </td>
                      <td className="td text-right">
                        <form action={deleteFolioItem}>
                          <input type="hidden" name="itemId" value={it.id} />
                          <input type="hidden" name="reservationId" value={r.id} />
                          <button className="text-xs text-gray-300 hover:text-red-500" title="Remove">✕</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr>
                    <td className="td font-medium" colSpan={3}>Total charges</td>
                    <td className="td text-right font-medium" colSpan={3}>{formatMoney(totals.charges)}</td>
                  </tr>
                  <tr>
                    <td className="td font-medium" colSpan={3}>Total payments</td>
                    <td className="td text-right font-medium text-green-600" colSpan={3}>{formatMoney(totals.payments)}</td>
                  </tr>
                  <tr>
                    <td className="td text-base font-bold" colSpan={3}>Balance due</td>
                    <td className={`td text-right text-base font-bold ${totals.balance > 0 ? "text-red-600" : "text-green-600"}`} colSpan={3}>
                      {formatMoney(totals.balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Post forms */}
            {(r.status === "CHECKED_IN" || r.status === "BOOKED") && (
              <div className="grid grid-cols-1 gap-4 border-t border-gray-100 p-5 md:grid-cols-2">
                <form action={postCharge} className="space-y-2 rounded-lg border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-700">Post a charge</div>
                  <input type="hidden" name="reservationId" value={r.id} />
                  <input name="description" placeholder="Description" required className="input" />
                  <div className="grid grid-cols-2 gap-2">
                    <select name="category" className="input">
                      {FOLIO_CATEGORIES.filter((c) => c !== "PAYMENT").map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input name="amount" type="number" step="0.01" min="0" placeholder="0.00" required className="input" />
                  </div>
                  <button className="btn-secondary w-full !py-1.5 text-sm">Add charge</button>
                </form>

                <form action={postPayment} className="space-y-2 rounded-lg border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-700">Record a payment</div>
                  <input type="hidden" name="reservationId" value={r.id} />
                  <input name="description" placeholder="e.g. Visa ****4242" required className="input" defaultValue="Card payment" />
                  <input name="amount" type="number" step="0.01" min="0" placeholder="0.00" required className="input" defaultValue={totals.balance > 0 ? totals.balance.toFixed(2) : ""} />
                  <button className="btn-primary w-full !py-1.5 text-sm">Record payment</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  );
}
