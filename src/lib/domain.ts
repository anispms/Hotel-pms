// Shared domain constants, enums and pure helpers used across the PMS.

export const TAX_RATE = 0.12; // 12% room tax applied on room charges

export const RESERVATION_STATUSES = [
  "BOOKED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const HK_STATUSES = ["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_ORDER"] as const;
export type HkStatus = (typeof HK_STATUSES)[number];

export const SOURCES = ["DIRECT", "OTA", "PHONE", "WALK_IN", "CORPORATE"] as const;

export const ROLES = ["ADMIN", "MANAGER", "FRONT_DESK", "HOUSEKEEPING"] as const;
export type Role = (typeof ROLES)[number];

export const FOLIO_CATEGORIES = [
  "ROOM",
  "FNB",
  "TAX",
  "MINIBAR",
  "PAYMENT",
  "MISC",
] as const;

// ── Date helpers (work in plain local dates, ignore time-of-day) ──

/** Strip time, return a Date at local midnight. */
export function dateOnly(d: Date | string): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Number of nights between two dates (checkout - checkin). Minimum 0. */
export function nightsBetween(checkIn: Date | string, checkOut: Date | string): number {
  const a = dateOnly(checkIn).getTime();
  const b = dateOnly(checkOut).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Format a date as YYYY-MM-DD (for <input type=date> and display). */
export function toISODate(d: Date | string): string {
  return dateOnly(d).toISOString().slice(0, 10);
}

export function formatDate(d: Date | string): string {
  return dateOnly(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n || 0);
}

/** True if the date ranges [aIn,aOut) and [bIn,bOut) overlap. */
export function rangesOverlap(
  aIn: Date | string,
  aOut: Date | string,
  bIn: Date | string,
  bOut: Date | string
): boolean {
  return dateOnly(aIn) < dateOnly(bOut) && dateOnly(bIn) < dateOnly(aOut);
}

export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    BOOKED: "bg-blue-100 text-blue-800",
    CHECKED_IN: "bg-green-100 text-green-800",
    CHECKED_OUT: "bg-gray-200 text-gray-700",
    CANCELLED: "bg-red-100 text-red-700",
    NO_SHOW: "bg-amber-100 text-amber-800",
    CLEAN: "bg-green-100 text-green-800",
    DIRTY: "bg-amber-100 text-amber-800",
    INSPECTED: "bg-blue-100 text-blue-800",
    OUT_OF_ORDER: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

/** Charges minus payments for a set of folio items. */
export function folioBalance(items: { kind: string; amount: number }[]): number {
  const charges = items.filter((i) => i.kind === "CHARGE").reduce((a, b) => a + b.amount, 0);
  const payments = items.filter((i) => i.kind === "PAYMENT").reduce((a, b) => a + b.amount, 0);
  return Math.round((charges - payments) * 100) / 100;
}

export function folioTotals(items: { kind: string; amount: number }[]) {
  const charges = items.filter((i) => i.kind === "CHARGE").reduce((a, b) => a + b.amount, 0);
  const payments = items.filter((i) => i.kind === "PAYMENT").reduce((a, b) => a + b.amount, 0);
  return {
    charges: Math.round(charges * 100) / 100,
    payments: Math.round(payments * 100) / 100,
    balance: Math.round((charges - payments) * 100) / 100,
  };
}

/** Generate a confirmation number like "HX-7F3A21". */
export function makeConfirmation(seed: number): string {
  const base = (seed * 2654435761) >>> 0;
  return "HX-" + base.toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
}
