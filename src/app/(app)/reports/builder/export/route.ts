import { normalizeParams, runReport } from "@/lib/report-query";
import { getCurrentProperty } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Escape a single CSV field per RFC 4180. */
function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const params = normalizeParams({
    dataset: sp.get("dataset") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    groupBy: sp.get("groupBy") ?? undefined,
  });

  const property = await getCurrentProperty();
  if (!property) return new Response("Unauthorized", { status: 401 });
  const result = await runReport(params, property.id);

  const lines: string[] = [];
  lines.push(result.columns.map((c) => csvField(c.label)).join(","));
  for (const row of result.rows) {
    lines.push(
      result.columns.map((c) => csvField(row[c.key])).join(",")
    );
  }
  const csv = lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.dataset}-report.csv"`,
    },
  });
}
