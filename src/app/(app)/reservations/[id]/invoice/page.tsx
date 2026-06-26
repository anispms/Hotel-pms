import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate, nightsBetween, folioTotals } from "@/lib/domain";
import { getSettings, formatMoneyIn } from "@/lib/settings";
import { requirePropertyId } from "@/lib/tenant";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const PRINT_CSS = `
@media print {
  body { background: #ffffff !important; }
  .no-print { display: none !important; }
  .invoice-sheet {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
  }
  @page { margin: 16mm; }
}
`;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const settings = await getSettings();
  const items = r.folio?.items ?? [];
  const totals = folioTotals(items);
  const nights = nightsBetween(r.checkIn, r.checkOut);

  const invoiceNumber = `${settings.invoicePrefix}-${r.confirmation}`;
  const guestName = `${r.guest.firstName} ${r.guest.lastName}`;
  const guestLocation = [r.guest.city, r.guest.country].filter(Boolean).join(", ");

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="mx-auto max-w-[800px]">
        {/* Toolbar — hidden when printing */}
        <div className="no-print mb-6 flex items-center justify-between gap-4">
          <Link href={`/reservations/${id}`} className="btn-secondary">
            ← Back
          </Link>
          <PrintButton />
        </div>

        {/* Invoice sheet */}
        <div className="invoice-sheet card p-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-8 border-b border-gray-200 pb-8">
            <div className="space-y-0.5 text-sm text-gray-600">
              <div className="text-xl font-bold text-gray-900">{settings.name}</div>
              {settings.legalName && <div>{settings.legalName}</div>}
              {settings.addressLine && <div>{settings.addressLine}</div>}
              {(settings.city || settings.country) && (
                <div>{[settings.city, settings.country].filter(Boolean).join(", ")}</div>
              )}
              {settings.email && <div>{settings.email}</div>}
              {settings.phone && <div>{settings.phone}</div>}
              {settings.website && <div>{settings.website}</div>}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tracking-tight text-gray-900">INVOICE</div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-end gap-3">
                  <dt className="text-gray-500">Invoice no.</dt>
                  <dd className="font-medium text-gray-800">{invoiceNumber}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-gray-500">Issue date</dt>
                  <dd className="font-medium text-gray-800">{formatDate(new Date())}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-gray-500">Confirmation</dt>
                  <dd className="font-medium text-gray-800">{r.confirmation}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Bill to */}
          <div className="border-b border-gray-200 py-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Bill to
            </div>
            <div className="mt-2 space-y-0.5 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">{guestName}</div>
              {r.guest.email && <div>{r.guest.email}</div>}
              {r.guest.phone && <div>{r.guest.phone}</div>}
              {r.guest.address && <div>{r.guest.address}</div>}
              {guestLocation && <div>{guestLocation}</div>}
            </div>
          </div>

          {/* Stay summary */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-b border-gray-200 py-6 sm:grid-cols-3">
            <Summary label="Check-in" value={formatDate(r.checkIn)} />
            <Summary label="Check-out" value={formatDate(r.checkOut)} />
            <Summary label="Nights" value={String(nights)} />
            <Summary label="Room" value={r.room ? r.room.number : "—"} />
            <Summary label="Room type" value={r.roomType.name} />
            <Summary label="Rate / night" value={formatMoneyIn(settings.currency, r.ratePerNight)} />
          </div>

          {/* Line items */}
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Description</th>
                <th className="py-2 pl-3 text-right font-semibold">Charges</th>
                <th className="py-2 pl-3 text-right font-semibold">Payments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No charges posted.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="text-gray-700">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-gray-500">
                      {formatDate(it.postedAt)}
                    </td>
                    <td className="py-2.5 pr-3">{it.description}</td>
                    <td className="py-2.5 pl-3 text-right">
                      {it.kind === "CHARGE" ? formatMoneyIn(settings.currency, it.amount) : ""}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-green-600">
                      {it.kind === "PAYMENT" ? formatMoneyIn(settings.currency, it.amount) : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Total charges</dt>
                <dd className="font-medium text-gray-800">
                  {formatMoneyIn(settings.currency, totals.charges)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total payments</dt>
                <dd className="font-medium text-green-600">
                  {formatMoneyIn(settings.currency, totals.payments)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="text-base font-bold text-gray-900">Balance Due</dt>
                <dd
                  className={`text-base font-bold ${
                    totals.balance > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {formatMoneyIn(settings.currency, totals.balance)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Footer */}
          <div className="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
            <div>{settings.invoiceFooter || "Thank you for staying with us."}</div>
            <div className="mt-1">
              {settings.taxName} is included where applicable.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 font-medium text-gray-800">{value}</div>
    </div>
  );
}
