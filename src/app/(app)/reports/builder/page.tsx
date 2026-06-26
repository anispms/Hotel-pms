import Link from "next/link";
import { PageHeader, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/domain";
import {
  DATASETS,
  GROUP_BYS,
  normalizeParams,
  reportQueryString,
  runReport,
  type ReportRow,
} from "@/lib/report-query";
import { requirePropertyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const DATASET_LABELS: Record<string, string> = {
  reservations: "Reservations",
  guests: "Guests",
  payments: "Payments",
};

const GROUP_LABELS: Record<string, string> = {
  none: "None",
  status: "Status",
  source: "Source",
  roomType: "Room type",
};

export default async function ReportBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{
    dataset?: string;
    from?: string;
    to?: string;
    groupBy?: string;
  }>;
}) {
  const sp = await searchParams;
  const propertyId = await requirePropertyId();
  const params = normalizeParams(sp);
  const result = await runReport(params, propertyId);

  const exportHref = `/reports/builder/export?${reportQueryString(params)}`;

  const isMoneyCol = (key: string) =>
    key === result.totalKey && result.totalKey !== null;

  function renderCell(row: ReportRow, key: string) {
    const v = row[key];
    if (isMoneyCol(key)) return formatMoney(Number(v));
    return String(v);
  }

  // Build grouped buckets when grouping is active.
  const groups: { label: string; rows: ReportRow[]; subtotal: number }[] = [];
  if (result.groupKey) {
    const map = new Map<string, ReportRow[]>();
    for (const row of result.rows) {
      const k = String(row[result.groupKey]);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(row);
    }
    for (const [label, rows] of [...map.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      const subtotal = result.totalKey
        ? rows.reduce((a, r) => a + Number(r[result.totalKey!]), 0)
        : 0;
      groups.push({ label, rows, subtotal });
    }
  }

  return (
    <div>
      <PageHeader
        title="Report Builder"
        subtitle="Build and export a custom report"
      />

      <form method="get" className="card mb-6 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div>
            <label className="label" htmlFor="dataset">
              Dataset
            </label>
            <select
              id="dataset"
              name="dataset"
              defaultValue={params.dataset}
              className="input"
            >
              {DATASETS.map((d) => (
                <option key={d} value={d}>
                  {DATASET_LABELS[d]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input
              id="from"
              type="date"
              name="from"
              defaultValue={params.from}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input
              id="to"
              type="date"
              name="to"
              defaultValue={params.to}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="groupBy">
              Group by
            </label>
            <select
              id="groupBy"
              name="groupBy"
              defaultValue={params.groupBy}
              className="input"
            >
              {GROUP_BYS.map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Run report
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Group by only applies to the Reservations dataset.
        </p>
      </form>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Rows" value={result.count} accent="brand" />
          {result.totalKey && (
            <StatCard
              label={`Total ${result.totalLabel?.toLowerCase()}`}
              value={formatMoney(result.total)}
              accent="green"
            />
          )}
        </div>
        <Link href={exportHref} className="btn-secondary">
          ⤓ Download CSV
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              {result.columns.map((c) => (
                <th
                  key={c.key}
                  className={`th ${c.numeric ? "text-right" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={result.columns.length}
                  className="td py-12 text-center text-gray-400"
                >
                  No rows match.
                </td>
              </tr>
            ) : result.groupKey ? (
              <>
                {groups.map((g) => (
                  <GroupBlock
                    key={g.label}
                    label={g.label}
                    groupLabel={result.groupLabel ?? ""}
                    rows={g.rows}
                    subtotal={g.subtotal}
                    columns={result.columns}
                    totalKey={result.totalKey}
                    renderCell={renderCell}
                  />
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="td" colSpan={result.columns.length - 1}>
                    Grand total · {result.count} row(s)
                  </td>
                  <td className="td text-right">{formatMoney(result.total)}</td>
                </tr>
              </>
            ) : (
              result.rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {result.columns.map((c) => (
                    <td
                      key={c.key}
                      className={`td ${c.numeric ? "text-right" : ""}`}
                    >
                      {renderCell(row, c.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupBlock({
  label,
  groupLabel,
  rows,
  subtotal,
  columns,
  totalKey,
  renderCell,
}: {
  label: string;
  groupLabel: string;
  rows: ReportRow[];
  subtotal: number;
  columns: { key: string; label: string; numeric?: boolean }[];
  totalKey: string | null;
  renderCell: (row: ReportRow, key: string) => string;
}) {
  return (
    <>
      <tr className="bg-gray-50">
        <td
          colSpan={columns.length}
          className="td text-xs font-semibold uppercase tracking-wide text-gray-500"
        >
          {groupLabel}: {String(label).replace(/_/g, " ")}
        </td>
      </tr>
      {rows.map((row, i) => (
        <tr key={i} className="hover:bg-gray-50">
          {columns.map((c) => (
            <td
              key={c.key}
              className={`td ${c.numeric ? "text-right" : ""}`}
            >
              {renderCell(row, c.key)}
            </td>
          ))}
        </tr>
      ))}
      <tr className="border-t border-gray-100 bg-white font-medium text-gray-700">
        <td className="td" colSpan={columns.length - 1}>
          Subtotal · {rows.length} row(s)
        </td>
        <td className="td text-right">
          {totalKey ? formatMoney(subtotal) : ""}
        </td>
      </tr>
    </>
  );
}
