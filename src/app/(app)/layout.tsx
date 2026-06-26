import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PropertySwitcher from "@/components/PropertySwitcher";
import { getCurrentUser, logout } from "@/lib/auth";
import { accessibleProperties, getCurrentProperty } from "@/lib/tenant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [properties, current] = await Promise.all([
    accessibleProperties(),
    getCurrentProperty(),
  ]);

  async function signOut() {
    "use server";
    await logout();
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
          <PropertySwitcher
            properties={properties.map((p) => ({ id: p.id, name: p.name }))}
            currentId={current?.id ?? ""}
          />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold leading-tight">{user.name}</div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                {user.role.replace(/_/g, " ")}
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {user.name.charAt(0)}
            </div>
            <form action={signOut}>
              <button className="btn-secondary !px-2.5 !py-1.5 text-xs">Sign out</button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
