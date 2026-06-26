import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { formatDate, ROLES } from "@/lib/domain";
import { createUser, toggleUser } from "@/lib/admin-actions";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLE_DESC: Record<string, string> = {
  ADMIN: "Full access incl. settings & integrations",
  MANAGER: "Operations + reports",
  FRONT_DESK: "Reservations, check-in/out, folio",
  HOUSEKEEPING: "Room status only",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const admin = await requireRole(ADMIN_ROLES);
  const { saved, error } = await searchParams;
  const users = await prisma.user.findMany({
    where: { organizationId: admin.organizationId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Staff & roles"
        subtitle="Manage who can access the PMS and what they can do"
        action={<Link href="/settings" className="btn-secondary">← Settings</Link>}
      />

      {saved && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">✓ Staff member added.</div>}
      {error === "exists" && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">A user with that email already exists.</div>}
      {error === "invalid" && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Name and email are required.</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>{["Name", "Email", "Role", "Status", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="td font-medium">{u.name}</td>
                    <td className="td text-gray-600">{u.email}</td>
                    <td className="td"><span className="badge bg-brand-50 text-brand-700">{u.role.replace(/_/g, " ")}</span></td>
                    <td className="td">
                      {u.active ? <Badge status="CHECKED_IN" label="Active" /> : <Badge status="CANCELLED" label="Disabled" />}
                    </td>
                    <td className="td text-right">
                      <form action={toggleUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="text-xs font-medium text-brand-600 hover:underline">
                          {u.active ? "Disable" : "Enable"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <form action={createUser} className="card space-y-3 p-5">
            <h2 className="font-semibold text-gray-800">Add staff member</h2>
            <input name="name" placeholder="Full name" required className="input" />
            <input name="email" type="email" placeholder="Email" required className="input" />
            <div>
              <label className="label">Role</label>
              <select name="role" className="input" defaultValue="FRONT_DESK">
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <input name="password" type="text" placeholder="Temp password (default: password123)" className="input" />
            <button className="btn-primary w-full">Add staff member</button>
          </form>

          <div className="mt-4 card p-4 text-xs text-gray-500">
            <div className="mb-2 font-semibold text-gray-600">Role permissions</div>
            {ROLES.map((r) => (
              <div key={r} className="mb-1">
                <span className="font-medium text-gray-700">{r.replace(/_/g, " ")}:</span> {ROLE_DESC[r]}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
