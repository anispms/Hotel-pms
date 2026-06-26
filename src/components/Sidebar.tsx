"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/front-desk", label: "Front Desk", icon: "🛎" },
  { href: "/reservations", label: "Reservations", icon: "📅" },
  { href: "/rooms", label: "Rooms", icon: "🚪" },
  { href: "/housekeeping", label: "Housekeeping", icon: "🧹" },
  { href: "/guests", label: "Guests", icon: "👤" },
];

const CONFIG_NAV = [
  { href: "/room-types", label: "Rates & Inventory", icon: "💲" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/reports/builder", label: "Report Builder", icon: "🧮" },
  { href: "/settings/integrations", label: "Integrations", icon: "🔌" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/onboarding", label: "Onboarding", icon: "🚀" },
];

export default function Sidebar() {
  const pathname = usePathname();
  // Active = the longest registered href that prefixes the current path.
  const allHrefs = [...NAV, ...CONFIG_NAV].map((n) => n.href);
  const bestMatch = allHrefs
    .filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === bestMatch;

  const renderItem = (item: { href: string; label: string; icon: string }) => (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive(item.href)
          ? "bg-brand-50 text-brand-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <span className="w-5 text-center text-base">{item.icon}</span>
      {item.label}
    </Link>
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
          H
        </div>
        <div>
          <div className="text-sm font-bold leading-tight">Hotel X</div>
          <div className="text-[11px] text-gray-500">Property Management</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map(renderItem)}
        <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Configure
        </div>
        {CONFIG_NAV.map(renderItem)}
      </nav>
      <div className="px-5 py-3 text-[11px] text-gray-400">v1.0 · Demo data</div>
    </aside>
  );
}
