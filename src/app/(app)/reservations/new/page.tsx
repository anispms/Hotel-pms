import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { toISODate } from "@/lib/domain";
import { requirePropertyId } from "@/lib/tenant";
import ReservationForm from "./ReservationForm";

export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  const propertyId = await requirePropertyId();
  const [guests, roomTypes] = await Promise.all([
    prisma.guest.findMany({ where: { propertyId }, orderBy: { lastName: "asc" } }),
    prisma.roomType.findMany({ where: { propertyId }, orderBy: { baseRate: "asc" } }),
  ]);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div>
      <PageHeader title="New reservation" subtitle="Create a booking for an existing guest" />
      {guests.length === 0 || roomTypes.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          You need at least one guest and one room type first.
        </div>
      ) : (
        <ReservationForm
          guests={guests}
          roomTypes={roomTypes}
          defaultCheckIn={toISODate(today)}
          defaultCheckOut={toISODate(tomorrow)}
        />
      )}
    </div>
  );
}
