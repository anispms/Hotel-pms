import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { statusBadge } from "@/lib/domain";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const propertyId = await requirePropertyId();
  const [rooms, inHouse] = await Promise.all([
    prisma.room.findMany({ where: { propertyId }, include: { roomType: true }, orderBy: { number: "asc" } }),
    prisma.reservation.findMany({
      where: { propertyId, status: "CHECKED_IN", roomId: { not: null } },
      include: { guest: true },
    }),
  ]);

  const occupant = new Map(inHouse.map((r) => [r.roomId!, r]));
  const floors = [...new Set(rooms.map((r) => r.floor))].sort();

  const counts = {
    total: rooms.length,
    occupied: occupant.size,
    clean: rooms.filter((r) => r.hkStatus === "CLEAN").length,
    dirty: rooms.filter((r) => r.hkStatus === "DIRTY").length,
    ooo: rooms.filter((r) => r.hkStatus === "OUT_OF_ORDER").length,
  };

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle={`${counts.total} rooms · ${counts.occupied} occupied · ${counts.clean} clean · ${counts.dirty} dirty · ${counts.ooo} out of order`}
      />

      <div className="space-y-8">
        {floors.map((floor) => (
          <div key={floor}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Floor {floor}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {rooms
                .filter((r) => r.floor === floor)
                .map((room) => {
                  const guest = occupant.get(room.id);
                  return (
                    <div key={room.id} className="card overflow-hidden p-4">
                      <div className="flex items-start justify-between">
                        <div className="text-lg font-bold">{room.number}</div>
                        <span className={`badge ${statusBadge(room.hkStatus)}`}>
                          {room.hkStatus === "OUT_OF_ORDER" ? "OOO" : room.hkStatus.charAt(0) + room.hkStatus.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">{room.roomType.code} · {room.roomType.name}</div>
                      <div className="mt-3 border-t border-gray-100 pt-2 text-xs">
                        {guest ? (
                          <Link href={`/reservations/${guest.id}`} className="font-medium text-brand-700 hover:underline">
                            {guest.guest.firstName} {guest.guest.lastName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">Vacant</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
