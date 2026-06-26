import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { HK_STATUSES, statusBadge } from "@/lib/domain";
import { setRoomStatus } from "@/lib/actions";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const NEXT_LABEL: Record<string, { to: string; label: string }> = {
  DIRTY: { to: "CLEAN", label: "Mark clean" },
  CLEAN: { to: "INSPECTED", label: "Mark inspected" },
  INSPECTED: { to: "DIRTY", label: "Mark dirty" },
  OUT_OF_ORDER: { to: "CLEAN", label: "Return to service" },
};

export default async function HousekeepingPage() {
  const propertyId = await requirePropertyId();
  const [rooms, inHouse] = await Promise.all([
    prisma.room.findMany({ where: { propertyId }, include: { roomType: true }, orderBy: { number: "asc" } }),
    prisma.reservation.findMany({
      where: { propertyId, status: "CHECKED_IN", roomId: { not: null } },
      select: { roomId: true },
    }),
  ]);
  const occupied = new Set(inHouse.map((r) => r.roomId));

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        subtitle="Update room cleaning status across the property"
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {HK_STATUSES.map((status) => {
          const list = rooms.filter((r) => r.hkStatus === status);
          return (
            <div key={status} className="card">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <span className={`badge ${statusBadge(status)}`}>{status.replace(/_/g, " ")}</span>
                <span className="text-sm font-semibold text-gray-500">{list.length}</span>
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
                {list.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">None</p>
                ) : (
                  list.map((room) => {
                    const next = NEXT_LABEL[room.hkStatus];
                    const isOccupied = occupied.has(room.id);
                    return (
                      <div key={room.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{room.number}</div>
                          <span className="text-xs text-gray-400">{room.roomType.code}</span>
                        </div>
                        {isOccupied && (
                          <div className="mt-1 text-[11px] font-medium text-amber-600">Occupied</div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {next && (
                            <form action={setRoomStatus}>
                              <input type="hidden" name="roomId" value={room.id} />
                              <input type="hidden" name="hkStatus" value={next.to} />
                              <button className="btn-secondary !px-2 !py-1 text-[11px]">{next.label}</button>
                            </form>
                          )}
                          {room.hkStatus !== "OUT_OF_ORDER" && (
                            <form action={setRoomStatus}>
                              <input type="hidden" name="roomId" value={room.id} />
                              <input type="hidden" name="hkStatus" value="OUT_OF_ORDER" />
                              <button className="btn-secondary !px-2 !py-1 text-[11px] text-red-600">OOO</button>
                            </form>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
