import Link from "next/link";
import { statusBadge } from "@/lib/domain";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "brand" | "green" | "amber" | "gray";
}) {
  const bar = {
    brand: "bg-brand-500",
    green: "bg-green-500",
    amber: "bg-amber-500",
    gray: "bg-gray-400",
  }[accent];
  return (
    <div className="card overflow-hidden p-5">
      <div className={`mb-3 h-1 w-10 rounded-full ${bar}`} />
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-sm font-medium text-gray-600">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}

export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge ${statusBadge(status)}`}>
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card flex items-center justify-center p-12 text-sm text-gray-400">
      {message}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>
      {children}
    </Link>
  );
}
