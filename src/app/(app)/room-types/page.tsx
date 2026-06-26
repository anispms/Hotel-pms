import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/domain";
import { createRoomType, createRatePlan, createRoom } from "@/lib/actions";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function RoomTypesPage() {
  const propertyId = await requirePropertyId();
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId },
    include: {
      ratePlans: { orderBy: { rate: "asc" } },
      _count: { select: { rooms: true } },
    },
    orderBy: { baseRate: "asc" },
  });

  return (
    <div>
      <PageHeader title="Rates & Inventory" subtitle="Room types, rate plans and physical rooms" />

      <div className="space-y-5">
        {roomTypes.map((rt) => (
          <div key={rt.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="badge bg-brand-50 text-brand-700">{rt.code}</span>
                  <h2 className="text-lg font-semibold">{rt.name}</h2>
                </div>
                {rt.description && <p className="mt-1 text-sm text-gray-500">{rt.description}</p>}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{formatMoney(rt.baseRate)}</div>
                <div className="text-xs text-gray-400">base / night · max {rt.maxOccupancy} · {rt._count.rooms} rooms</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Rate plans</h3>
                <div className="space-y-1">
                  {rt.ratePlans.map((rp) => (
                    <div key={rp.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                      <div>
                        <span className="font-mono text-xs text-gray-400">{rp.code}</span>{" "}
                        <span className="font-medium">{rp.name}</span>
                        {rp.includesBreakfast && <span className="ml-2 badge bg-green-100 text-green-700">+ Breakfast</span>}
                      </div>
                      <div className="font-semibold">{formatMoney(rp.rate)}</div>
                    </div>
                  ))}
                  {rt.ratePlans.length === 0 && <p className="text-xs text-gray-400">No rate plans.</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <form action={createRatePlan} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 text-xs font-semibold text-gray-600">Add rate plan</div>
                  <input type="hidden" name="roomTypeId" value={rt.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="code" placeholder="Code" required className="input" />
                    <input name="rate" type="number" step="0.01" placeholder="Rate" required className="input" />
                  </div>
                  <input name="name" placeholder="Name" required className="input mt-2" />
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" name="includesBreakfast" /> Includes breakfast
                  </label>
                  <button className="btn-secondary mt-2 w-full !py-1.5 text-xs">Add rate plan</button>
                </form>

                <form action={createRoom} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 text-xs font-semibold text-gray-600">Add room of this type</div>
                  <input type="hidden" name="roomTypeId" value={rt.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="number" placeholder="Room no." required className="input" />
                    <input name="floor" type="number" placeholder="Floor" defaultValue={1} className="input" />
                  </div>
                  <button className="btn-secondary mt-2 w-full !py-1.5 text-xs">Add room</button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <form action={createRoomType} className="card grid grid-cols-1 gap-3 p-5 md:grid-cols-6">
          <div className="md:col-span-6 font-semibold text-gray-800">Add room type</div>
          <input name="code" placeholder="Code (e.g. STD)" required className="input md:col-span-1" />
          <input name="name" placeholder="Name" required className="input md:col-span-2" />
          <input name="baseRate" type="number" step="0.01" placeholder="Base rate" required className="input md:col-span-1" />
          <input name="maxOccupancy" type="number" placeholder="Max occ." defaultValue={2} className="input md:col-span-1" />
          <button className="btn-primary md:col-span-1">Add type</button>
          <input name="description" placeholder="Description (optional)" className="input md:col-span-6" />
        </form>
      </div>
    </div>
  );
}
