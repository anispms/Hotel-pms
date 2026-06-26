import { prisma } from "@/lib/db";
import { nightsBetween, toISODate } from "@/lib/domain";

export const DATASETS = ["reservations", "guests", "payments"] as const;
export type Dataset = (typeof DATASETS)[number];

export const GROUP_BYS = ["none", "status", "source", "roomType"] as const;
export type GroupBy = (typeof GROUP_BYS)[number];

export type ReportParams = {
  dataset?: string;
  from?: string;
  to?: string;
  groupBy?: string;
};

export type NormalizedParams = {
  dataset: Dataset;
  from: string;
  to: string;
  groupBy: GroupBy;
};

/** Normalize raw searchParams into validated values with sensible defaults. */
export function normalizeParams(sp: ReportParams): NormalizedParams {
  const dataset = DATASETS.includes(sp.dataset as Dataset)
    ? (sp.dataset as Dataset)
    : "reservations";

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 90);
  const from = sp.from || toISODate(defaultFrom);
  const to = sp.to || toISODate(new Date());

  const groupBy =
    dataset === "reservations" && GROUP_BYS.includes(sp.groupBy as GroupBy)
      ? (sp.groupBy as GroupBy)
      : "none";

  return { dataset, from, to, groupBy };
}

/** Build an inclusive end-of-range Date (start of the day after `to`). */
function rangeEnd(to: string): Date {
  const toEnd = new Date(to);
  toEnd.setDate(toEnd.getDate() + 1);
  return toEnd;
}

export type ReportColumn = { key: string; label: string; numeric?: boolean };

export type ReportRow = Record<string, string | number>;

export type ReportResult = {
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Field name to group by (one of the column keys) or null when ungrouped. */
  groupKey: string | null;
  /** Display label of the grouped column. */
  groupLabel: string | null;
  /** Which numeric column to subtotal (revenue/amount), or null. */
  totalKey: string | null;
  totalLabel: string | null;
  count: number;
  total: number; // sum of totalKey across all rows
};

/**
 * Run the report query for the given (normalized) params and return a
 * dataset-agnostic shape used by both the page table and the CSV export.
 */
export async function runReport(p: NormalizedParams, propertyId: string): Promise<ReportResult> {
  const start = new Date(p.from);
  const end = rangeEnd(p.to);

  if (p.dataset === "reservations") {
    const reservations = await prisma.reservation.findMany({
      where: { propertyId, checkIn: { gte: start, lt: end } },
      include: { guest: true, roomType: true, room: true },
      orderBy: { checkIn: "desc" },
    });

    const columns: ReportColumn[] = [
      { key: "confirmation", label: "Confirmation" },
      { key: "guest", label: "Guest" },
      { key: "roomType", label: "Room Type" },
      { key: "checkIn", label: "Check-in" },
      { key: "checkOut", label: "Check-out" },
      { key: "nights", label: "Nights", numeric: true },
      { key: "source", label: "Source" },
      { key: "status", label: "Status" },
      { key: "revenue", label: "Revenue", numeric: true },
    ];

    const rows: ReportRow[] = reservations.map((r) => {
      const nights = nightsBetween(r.checkIn, r.checkOut);
      return {
        confirmation: r.confirmation,
        guest: `${r.guest.firstName} ${r.guest.lastName}`,
        roomType: r.roomType.name,
        checkIn: toISODate(r.checkIn),
        checkOut: toISODate(r.checkOut),
        nights,
        source: r.source,
        status: r.status,
        revenue: Math.round(r.ratePerNight * nights * 100) / 100,
      };
    });

    const groupMap: Record<GroupBy, { key: string; label: string } | null> = {
      none: null,
      status: { key: "status", label: "Status" },
      source: { key: "source", label: "Source" },
      roomType: { key: "roomType", label: "Room Type" },
    };
    const grouped = groupMap[p.groupBy];

    const total =
      Math.round(rows.reduce((a, r) => a + Number(r.revenue), 0) * 100) / 100;

    return {
      columns,
      rows,
      groupKey: grouped ? grouped.key : null,
      groupLabel: grouped ? grouped.label : null,
      totalKey: "revenue",
      totalLabel: "Revenue",
      count: rows.length,
      total,
    };
  }

  if (p.dataset === "guests") {
    const guests = await prisma.guest.findMany({
      where: { propertyId, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
    });

    const columns: ReportColumn[] = [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "country", label: "Country" },
      { key: "vip", label: "VIP" },
    ];

    const rows: ReportRow[] = guests.map((g) => ({
      name: `${g.firstName} ${g.lastName}`,
      email: g.email ?? "",
      city: g.city ?? "",
      country: g.country ?? "",
      vip: g.vip ? "Yes" : "No",
    }));

    return {
      columns,
      rows,
      groupKey: null,
      groupLabel: null,
      totalKey: null,
      totalLabel: null,
      count: rows.length,
      total: 0,
    };
  }

  // payments
  const payments = await prisma.folioItem.findMany({
    where: {
      kind: "PAYMENT",
      postedAt: { gte: start, lt: end },
      folio: { reservation: { propertyId } },
    },
    include: {
      folio: { include: { reservation: { include: { guest: true } } } },
    },
    orderBy: { postedAt: "desc" },
  });

  const columns: ReportColumn[] = [
    { key: "date", label: "Date" },
    { key: "reservation", label: "Reservation" },
    { key: "guest", label: "Guest" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount", numeric: true },
  ];

  const rows: ReportRow[] = payments.map((it) => {
    const res = it.folio?.reservation;
    const guest = res?.guest;
    return {
      date: toISODate(it.postedAt),
      reservation: res?.confirmation ?? "",
      guest: guest ? `${guest.firstName} ${guest.lastName}` : "",
      description: it.description ?? "",
      amount: Math.round(it.amount * 100) / 100,
    };
  });

  const total =
    Math.round(rows.reduce((a, r) => a + Number(r.amount), 0) * 100) / 100;

  return {
    columns,
    rows,
    groupKey: null,
    groupLabel: null,
    totalKey: "amount",
    totalLabel: "Amount",
    count: rows.length,
    total,
  };
}

/** Build the canonical query string for links/exports from normalized params. */
export function reportQueryString(p: NormalizedParams): string {
  const qs = new URLSearchParams({
    dataset: p.dataset,
    from: p.from,
    to: p.to,
    groupBy: p.groupBy,
  });
  return qs.toString();
}
