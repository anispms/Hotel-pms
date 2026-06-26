import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { createGuest } from "@/lib/actions";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const propertyId = await requirePropertyId();
  const guests = await prisma.guest.findMany({
    where: {
      propertyId,
      ...(q
        ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] }
        : {}),
    },
    include: { _count: { select: { reservations: true } } },
    orderBy: { lastName: "asc" },
  });

  return (
    <div>
      <PageHeader title="Guests" subtitle={`${guests.length} guest profile(s)`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form className="mb-4" action="/guests">
            <input name="q" defaultValue={q} placeholder="Search guests…" className="input !w-72" />
          </form>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {["Name", "Contact", "Location", "Stays"].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {guests.length === 0 ? (
                  <tr><td colSpan={4} className="td py-12 text-center text-gray-400">No guests found.</td></tr>
                ) : (
                  guests.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="td">
                        <Link href={`/guests/${g.id}`} className="font-medium text-brand-700 hover:underline">
                          {g.firstName} {g.lastName}
                        </Link>
                        {g.vip && <span className="ml-2 badge bg-amber-100 text-amber-800">VIP</span>}
                      </td>
                      <td className="td text-gray-600">
                        <div>{g.email ?? "—"}</div>
                        <div className="text-xs text-gray-400">{g.phone ?? ""}</div>
                      </td>
                      <td className="td text-gray-600">{[g.city, g.country].filter(Boolean).join(", ") || "—"}</td>
                      <td className="td">{g._count.reservations}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-1">
          <form action={createGuest} className="card space-y-3 p-5">
            <h2 className="font-semibold text-gray-800">Add guest</h2>
            <div className="grid grid-cols-2 gap-2">
              <input name="firstName" placeholder="First name" required className="input" />
              <input name="lastName" placeholder="Last name" required className="input" />
            </div>
            <input name="email" type="email" placeholder="Email" className="input" />
            <input name="phone" placeholder="Phone" className="input" />
            <div className="grid grid-cols-2 gap-2">
              <input name="city" placeholder="City" className="input" />
              <input name="country" placeholder="Country" className="input" />
            </div>
            <input name="idNumber" placeholder="ID / Passport no." className="input" />
            <textarea name="notes" rows={2} placeholder="Notes" className="input" />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" name="vip" className="rounded" /> VIP guest
            </label>
            <button className="btn-primary w-full">Add guest</button>
          </form>
        </div>
      </div>
    </div>
  );
}
