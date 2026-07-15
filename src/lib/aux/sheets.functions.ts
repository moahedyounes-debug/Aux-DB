import { createServerFn } from "@tanstack/react-start";

const SHEET_ID = "1x796CMZf8b3RUNkqsanO56F_Wmo75L2uLzIlgE65doY";
const RANGE = "Sheet1!A2:AE"; // skip header row; columns A..AE covers all needed fields
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

// Column indices (0-based, relative to A)
const COL = {
  ticket: 0,
  serviceProvider: 2,
  ticketStatus: 12,
  orderCreation: 14,
  ticketSource: 16,
  completionResult: 19,
  completionTime: 20,
  serviceHours: 21,
  serviceTimeliness: 22,
  builder: 23,
  appointedDate: 24,
  rescheduling: 25,
  rescheduleReason: 26,
} as const;

export interface MonthKpi {
  month: string;
  label: string;
  total: number;
  pending: number;
  completed: number;
  rate48h: number;
  rate72h: number;
  count48h: number;
  count72h: number;
  rescheduled: number;
}
export interface DailyRow {
  date: string;
  weekday: string;
  incoming: number;
  completed: number;
  pending: number;
  rescheduled: number;
}
export interface CountRow {
  key: string;
  count: number;
}
export interface BranchKpi {
  branch: string;
  total: number;
  completed: number;
  pending: number;
  rate48h: number;
  rate72h: number;
  csat: number;
}
export interface Snapshot {
  total: number;
  pending: number;
  pendingNoReason: number;
  unassigned: number;
  completed: number;
  rate48h: number;
  rate72h: number;
  rescheduled: number;
}
export interface KpiData {
  fetchedAt: string;
  rowCount: number;
  snapshot: Snapshot;
  monthly: MonthKpi[];
  daily: DailyRow[];
  pendingByReason: { reason: string; count: number }[];
  pendingByBranch: { branch: string; count: number }[];
  pendingAging: { bucket: string; count: number }[];
  branches: BranchKpi[];
  error?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  // sheet format: "2026-07-15 14:56:26" -> replace space with T, treat as UTC-ish
  const s = String(v).trim().replace(" ", "T");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeBranch(raw: string): string {
  if (!raw) return "Unknown";
  return raw
    .replace(/^\s*(HMA|ABL|CTV|EYT|MZ|SJK)\s*[-–]\s*/i, "")
    .replace(/\s+Branch\s*$/i, "")
    .trim() || raw;
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "no" && s !== "false" && s !== "not rescheduled";
}

function isCompleted(row: string[]): boolean {
  const compTime = row[COL.completionTime];
  const compRes = row[COL.completionResult];
  return Boolean((compTime && String(compTime).trim()) || (compRes && String(compRes).trim()));
}

// simple in-memory cache to avoid hammering Sheets on every request
let cache: { at: number; data: KpiData } | null = null;
const CACHE_MS = 5 * 60_000;

async function fetchSheetRows(): Promise<string[][]> {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  const lov = process.env.LOVABLE_API_KEY;
  if (!key || !lov) throw new Error("Google Sheets connector not configured");
  const url = `${GATEWAY}/spreadsheets/${SHEET_ID}/values/${RANGE}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lov}`,
      "X-Connection-Api-Key": key,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets fetch failed [${res.status}]: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { values?: string[][] };
  return json.values ?? [];
}

function aggregate(rows: string[][]): KpiData {
  const now = new Date();
  const monthMap = new Map<string, MonthKpi>();
  const dayMap = new Map<string, DailyRow>();
  const reasonMap = new Map<string, number>();
  const branchPending = new Map<string, number>();
  const branchStats = new Map<
    string,
    { total: number; completed: number; pending: number; c48: number; c72: number }
  >();
  const aging = { "0–24h": 0, "24–48h": 0, "48–72h": 0, "3–7d": 0, "7–14d": 0, "14d+": 0 };

  let total = 0;
  let pending = 0;
  let completed = 0;
  let unassigned = 0;
  let pendingNoReason = 0;
  let rescheduledAll = 0;

  // Prep last 30 days buckets
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    dayMap.set(iso, {
      date: iso,
      weekday: WEEKDAYS[d.getDay()],
      incoming: 0,
      completed: 0,
      pending: 0,
      rescheduled: 0,
    });
  }

  for (const row of rows) {
    if (!row || !row[COL.ticket]) continue;
    total++;

    const created = parseDate(row[COL.orderCreation]);
    const done = isCompleted(row);
    const status = String(row[COL.ticketStatus] ?? "").trim();
    const branch = normalizeBranch(String(row[COL.serviceProvider] ?? ""));
    const resched = isTruthy(row[COL.rescheduling]);
    if (resched) rescheduledAll++;

    // service hours
    const hrs = Number(String(row[COL.serviceHours] ?? "").trim());
    const under48 = done && !isNaN(hrs) && hrs <= 48;
    const under72 = done && !isNaN(hrs) && hrs <= 72;

    let bs = branchStats.get(branch);
    if (!bs) {
      bs = { total: 0, completed: 0, pending: 0, c48: 0, c72: 0 };
      branchStats.set(branch, bs);
    }
    bs.total++;
    if (done) bs.completed++;
    else bs.pending++;
    if (under48) bs.c48++;
    if (under72) bs.c72++;

    if (done) completed++;
    else {
      pending++;
      if (status.toLowerCase().includes("not assigned")) unassigned++;
      const reason = String(row[COL.rescheduleReason] ?? "").trim();
      if (!reason) pendingNoReason++;
      else reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
      branchPending.set(branch, (branchPending.get(branch) ?? 0) + 1);

      if (created) {
        const ageH = (now.getTime() - created.getTime()) / 36e5;
        if (ageH < 24) aging["0–24h"]++;
        else if (ageH < 48) aging["24–48h"]++;
        else if (ageH < 72) aging["48–72h"]++;
        else if (ageH < 24 * 7) aging["3–7d"]++;
        else if (ageH < 24 * 14) aging["7–14d"]++;
        else aging["14d+"]++;
      }
    }

    // Monthly
    if (created) {
      const ym = created.toISOString().slice(0, 7);
      let m = monthMap.get(ym);
      if (!m) {
        const label = created.toLocaleString("en-US", { month: "short" });
        m = {
          month: ym,
          label,
          total: 0,
          pending: 0,
          completed: 0,
          rate48h: 0,
          rate72h: 0,
          count48h: 0,
          count72h: 0,
          rescheduled: 0,
        };
        monthMap.set(ym, m);
      }
      m.total++;
      if (done) m.completed++;
      else m.pending++;
      if (under48) m.count48h++;
      if (under72) m.count72h++;
      if (resched) m.rescheduled++;

      // Daily (last 30 days)
      const iso = created.toISOString().slice(0, 10);
      const dr = dayMap.get(iso);
      if (dr) {
        dr.incoming++;
        if (done) dr.completed++;
        else dr.pending++;
        if (resched) dr.rescheduled++;
      }
    }
  }

  // finalize monthly rates
  const monthly = Array.from(monthMap.values())
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .slice(-12)
    .map((m) => ({
      ...m,
      rate48h: m.completed > 0 ? Math.round((m.count48h / m.completed) * 1000) / 10 : 0,
      rate72h: m.completed > 0 ? Math.round((m.count72h / m.completed) * 1000) / 10 : 0,
    }));

  // Snapshot rates from completed tickets overall
  let totalUnder48 = 0;
  let totalUnder72 = 0;
  for (const m of monthly) {
    totalUnder48 += m.count48h;
    totalUnder72 += m.count72h;
  }
  const snapshot: Snapshot = {
    total,
    pending,
    completed,
    unassigned,
    pendingNoReason,
    rate48h: completed > 0 ? Math.round((totalUnder48 / completed) * 1000) / 10 : 0,
    rate72h: completed > 0 ? Math.round((totalUnder72 / completed) * 1000) / 10 : 0,
    rescheduled: rescheduledAll,
  };

  const pendingByReason = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const pendingByBranch = Array.from(branchPending.entries())
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const pendingAging = (Object.keys(aging) as (keyof typeof aging)[]).map((bucket) => ({
    bucket,
    count: aging[bucket],
  }));

  const branches: BranchKpi[] = Array.from(branchStats.entries())
    .map(([branch, s]) => ({
      branch,
      total: s.total,
      completed: s.completed,
      pending: s.pending,
      rate48h: s.completed > 0 ? Math.round((s.c48 / s.completed) * 1000) / 10 : 0,
      rate72h: s.completed > 0 ? Math.round((s.c72 / s.completed) * 1000) / 10 : 0,
      csat: 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    fetchedAt: new Date().toISOString(),
    rowCount: rows.length,
    snapshot,
    monthly,
    daily: Array.from(dayMap.values()),
    pendingByReason,
    pendingByBranch,
    pendingAging,
    branches,
  };
}

export const getSheetsKpi = createServerFn({ method: "GET" }).handler(async (): Promise<KpiData> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const rows = await fetchSheetRows();
    const data = aggregate(rows);
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sheets-kpi] failed:", msg);
    return {
      fetchedAt: new Date().toISOString(),
      rowCount: 0,
      snapshot: {
        total: 0,
        pending: 0,
        pendingNoReason: 0,
        unassigned: 0,
        completed: 0,
        rate48h: 0,
        rate72h: 0,
        rescheduled: 0,
      },
      monthly: [],
      daily: [],
      pendingByReason: [],
      pendingByBranch: [],
      pendingAging: [],
      branches: [],
      error: msg,
    };
  }
});