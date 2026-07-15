// Frontend helper to read whitelisted Google Sheets via the public API
// endpoint /api/public/sheet-read. Auto-filters by the signed-in Access
// record when a filter spec is provided.

import { applyAccessFilter, type AccessRecord } from "@/hooks/use-access";

export type SheetSource = "maintenance" | "parts" | "agents" | "calls";

const API = "/api/public/sheet-read";

export type TabInfo = {
  title: string;
  sheetId: number;
  rowCount: number;
  columnCount: number;
};

export async function listTabs(source: SheetSource): Promise<TabInfo[]> {
  const r = await fetch(`${API}?source=${source}&mode=meta`);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "sheet_meta_failed");
  return d.tabs as TabInfo[];
}

export async function readRange(
  source: SheetSource,
  range: string,
): Promise<string[][]> {
  const r = await fetch(`${API}?source=${source}&range=${encodeURIComponent(range)}`);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "sheet_read_failed");
  return (d.values ?? []) as string[][];
}

export async function readRanges(
  source: SheetSource,
  ranges: string[],
): Promise<Array<{ range?: string; values: string[][] }>> {
  const qs = ranges.map((r) => `range=${encodeURIComponent(r)}`).join("&");
  const r = await fetch(`${API}?source=${source}&${qs}`);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "sheet_read_failed");
  return d.valueRanges ?? [];
}

/**
 * Read a tab and return { headers, rows } with rows as records keyed by header.
 * Optionally filter by the signed-in access record.
 */
export async function readTable(
  source: SheetSource,
  range: string,
  opts?: {
    access?: AccessRecord | null;
    filterFields?: { asc?: string; branch?: string };
  },
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const values = await readRange(source, range);
  if (!values.length) return { headers: [], rows: [] };
  const [headerRow, ...body] = values;
  const headers = headerRow.map((h) => (h ?? "").trim());
  let rows = body.map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").toString()));
    return o;
  });
  if (opts?.access && opts.filterFields) {
    rows = applyAccessFilter(rows, opts.access, opts.filterFields);
  }
  return { headers, rows };
}