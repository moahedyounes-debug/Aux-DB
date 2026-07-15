import { createServerFn } from "@tanstack/react-start";

const SHEET_ID = "1x796CMZf8b3RUNkqsanO56F_Wmo75L2uLzIlgE65doY";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const CACHE_MS = 5 * 60_000;

async function fetchRange(range: string): Promise<string[][]> {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  const lov = process.env.LOVABLE_API_KEY;
  if (!key || !lov) throw new Error("Google Sheets connector not configured");
  const url = `${GATEWAY}/spreadsheets/${SHEET_ID}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": key },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets fetch failed [${res.status}]: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { values?: string[][] };
  return json.values ?? [];
}

const cache = new Map<string, { at: number; data: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

// ============================================================
// Parts (spare-parts inventory / request log)
// ============================================================
export interface PartRow {
  order: string;
  partNumber: string;
  description: string;
  model: string;
  serial: string;
  awb: string;
  requestDate: string;
  dispatchDate: string;
  receivingDate: string;
  status: string;
  branch: string;
  qty: number;
  notes: string;
  requestedBy: string;
  asc: string;
}
export interface PartsBranchRow {
  branch: string;
  requests: number;
  received: number;
  pending: number;
  qty: number;
}
export interface PartsStatusRow {
  status: string;
  count: number;
}
export interface PartsMonthRow {
  month: string;
  requests: number;
}
export interface PartsSummary {
  fetchedAt: string;
  total: number;
  received: number;
  pending: number;
  dispatched: number;
  totalQty: number;
  uniqueParts: number;
  byBranch: PartsBranchRow[];
  byStatus: PartsStatusRow[];
  byMonth: PartsMonthRow[];
  topParts: { part: string; description: string; count: number }[];
  recent: PartRow[];
  error?: string;
}

function normStatus(s: string): string {
  const t = s.trim().toLowerCase();
  if (!t) return "Unknown";
  if (t.includes("receiv")) return "Received";
  if (t.includes("dispatch") || t.includes("sent") || t.includes("shipped")) return "Dispatched";
  if (t.includes("pending") || t.includes("waiting") || t.includes("request")) return "Pending";
  if (t.includes("cancel")) return "Cancelled";
  return s.trim();
}

function monthKey(iso: string): string {
  if (!iso) return "";
  // handles "2026-05-11" or "17/05/2026"
  if (/^\d{4}-\d{2}/.test(iso)) return iso.slice(0, 7);
  const m = iso.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}`;
  return "";
}

export const getPartsData = createServerFn({ method: "GET" }).handler(
  async (): Promise<PartsSummary> => {
    return cached("parts", async () => {
      try {
        const rows = await fetchRange("Parts!A2:O");
        const parsed: PartRow[] = rows
          .filter((r) => r[0])
          .map((r) => ({
            order: String(r[0] ?? "").trim(),
            partNumber: String(r[1] ?? "").trim(),
            description: String(r[2] ?? "").trim(),
            model: String(r[3] ?? "").trim(),
            serial: String(r[4] ?? "").trim(),
            awb: String(r[5] ?? "").trim(),
            requestDate: String(r[6] ?? "").trim(),
            dispatchDate: String(r[7] ?? "").trim(),
            receivingDate: String(r[8] ?? "").trim(),
            status: normStatus(String(r[9] ?? "")),
            branch: String(r[10] ?? "").trim() || "Unknown",
            qty: Number(String(r[11] ?? "0").replace(/[^\d.-]/g, "")) || 0,
            notes: String(r[12] ?? "").trim(),
            requestedBy: String(r[13] ?? "").trim(),
            asc: String(r[14] ?? "").trim(),
          }));

        const byBranch = new Map<string, PartsBranchRow>();
        const byStatus = new Map<string, number>();
        const byMonth = new Map<string, number>();
        const partCount = new Map<string, { desc: string; count: number }>();
        let received = 0;
        let dispatched = 0;
        let pending = 0;
        let totalQty = 0;

        for (const p of parsed) {
          totalQty += p.qty;
          const b = byBranch.get(p.branch) ?? { branch: p.branch, requests: 0, received: 0, pending: 0, qty: 0 };
          b.requests++;
          b.qty += p.qty;
          if (p.status === "Received") { received++; b.received++; }
          else if (p.status === "Dispatched") { dispatched++; }
          else { pending++; b.pending++; }
          byBranch.set(p.branch, b);
          byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
          const mk = monthKey(p.requestDate);
          if (mk) byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
          if (p.partNumber && p.partNumber !== "—") {
            const pc = partCount.get(p.partNumber) ?? { desc: p.description, count: 0 };
            pc.count++;
            partCount.set(p.partNumber, pc);
          }
        }

        return {
          fetchedAt: new Date().toISOString(),
          total: parsed.length,
          received,
          pending,
          dispatched,
          totalQty,
          uniqueParts: partCount.size,
          byBranch: Array.from(byBranch.values()).sort((a, b) => b.requests - a.requests),
          byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
          byMonth: Array.from(byMonth.entries()).map(([month, requests]) => ({ month, requests })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
          topParts: Array.from(partCount.entries()).map(([part, v]) => ({ part, description: v.desc, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 15),
          recent: parsed.slice(-100).reverse(),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          fetchedAt: new Date().toISOString(),
          total: 0, received: 0, pending: 0, dispatched: 0, totalQty: 0, uniqueParts: 0,
          byBranch: [], byStatus: [], byMonth: [], topParts: [], recent: [], error: msg,
        };
      }
    });
  },
);

// ============================================================
// Access (users, roles, page permissions)
// ============================================================
export interface AccessRow {
  email: string;
  asc: string;
  pendingBranch: string;
  adminAccess: string;
  parts: string;
  callCenter: string;
}
export interface AccessSummary {
  fetchedAt: string;
  total: number;
  admins: number;
  callCenter: number;
  partsAccess: number;
  byASC: { asc: string; users: number }[];
  users: AccessRow[];
  error?: string;
}

export const getAccessData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccessSummary> => {
    return cached("access", async () => {
      try {
        const rows = await fetchRange("Access!A2:F");
        const users: AccessRow[] = rows
          .filter((r) => r[0])
          .map((r) => ({
            email: String(r[0] ?? "").trim(),
            asc: String(r[1] ?? "").trim() || "—",
            pendingBranch: String(r[2] ?? "").trim(),
            adminAccess: String(r[3] ?? "").trim(),
            parts: String(r[4] ?? "").trim(),
            callCenter: String(r[5] ?? "").trim(),
          }));

        const byASC = new Map<string, number>();
        let admins = 0, callCenter = 0, partsAccess = 0;
        for (const u of users) {
          byASC.set(u.asc, (byASC.get(u.asc) ?? 0) + 1);
          if (u.adminAccess.toLowerCase() === "yes") admins++;
          if (u.callCenter.toLowerCase() === "yes") callCenter++;
          if (u.parts && u.parts.toLowerCase() !== "no") partsAccess++;
        }

        return {
          fetchedAt: new Date().toISOString(),
          total: users.length,
          admins, callCenter, partsAccess,
          byASC: Array.from(byASC.entries()).map(([asc, u]) => ({ asc, users: u })).sort((a, b) => b.users - a.users),
          users,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { fetchedAt: new Date().toISOString(), total: 0, admins: 0, callCenter: 0, partsAccess: 0, byASC: [], users: [], error: msg };
      }
    });
  },
);

// ============================================================
// ActiveUsers (session / activity log)
// ============================================================
export interface ActiveUserRow {
  timestamp: string;
  email: string;
  asc: string;
  page: string;
  action: string;
}
export interface ActivitySummary {
  fetchedAt: string;
  total: number;
  activeUsers: number;
  uniquePages: number;
  byPage: { page: string; count: number }[];
  byUser: { email: string; count: number; lastSeen: string }[];
  byDay: { date: string; count: number }[];
  recent: ActiveUserRow[];
  error?: string;
}

function parseTs(s: string): Date | null {
  if (!s) return null;
  const iso = s.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})/);
  if (iso) {
    const [, dd, mm, yy, h, mi, se] = iso;
    return new Date(`${yy}-${mm}-${dd}T${h}:${mi}:${se}`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const getActivityData = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActivitySummary> => {
    return cached("activity", async () => {
      try {
        const rows = await fetchRange("ActiveUsers!A2:E");
        const parsed: ActiveUserRow[] = rows
          .filter((r) => r[0] && r[1])
          .map((r) => ({
            timestamp: String(r[0] ?? "").trim(),
            email: String(r[1] ?? "").trim(),
            asc: String(r[2] ?? "").trim(),
            page: String(r[3] ?? "").trim(),
            action: String(r[4] ?? "").trim(),
          }));

        const byPage = new Map<string, number>();
        const byUserMap = new Map<string, { count: number; lastSeen: string; lastDate: number }>();
        const byDay = new Map<string, number>();

        for (const r of parsed) {
          byPage.set(r.page, (byPage.get(r.page) ?? 0) + 1);
          const d = parseTs(r.timestamp);
          const time = d?.getTime() ?? 0;
          const u = byUserMap.get(r.email) ?? { count: 0, lastSeen: r.timestamp, lastDate: 0 };
          u.count++;
          if (time > u.lastDate) { u.lastDate = time; u.lastSeen = r.timestamp; }
          byUserMap.set(r.email, u);
          if (d) {
            const iso = d.toISOString().slice(0, 10);
            byDay.set(iso, (byDay.get(iso) ?? 0) + 1);
          }
        }

        return {
          fetchedAt: new Date().toISOString(),
          total: parsed.length,
          activeUsers: byUserMap.size,
          uniquePages: byPage.size,
          byPage: Array.from(byPage.entries()).map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count).slice(0, 15),
          byUser: Array.from(byUserMap.entries()).map(([email, v]) => ({ email, count: v.count, lastSeen: v.lastSeen })).sort((a, b) => b.count - a.count).slice(0, 30),
          byDay: Array.from(byDay.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
          recent: parsed.slice(-100).reverse(),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { fetchedAt: new Date().toISOString(), total: 0, activeUsers: 0, uniquePages: 0, byPage: [], byUser: [], byDay: [], recent: [], error: msg };
      }
    });
  },
);

// ============================================================
// UploadLogs — data pipeline health (Control Panel)
// ============================================================
export interface UploadRow {
  timestamp: string;
  action: string;
  rows: number;
  columns: number;
  status: string;
  notes: string;
}
export interface UploadSummary {
  fetchedAt: string;
  total: number;
  success: number;
  failed: number;
  lastRun: string;
  lastStatus: string;
  lastRows: number;
  byAction: { action: string; runs: number; lastRows: number; lastRun: string }[];
  recent: UploadRow[];
  error?: string;
}

export const getUploadLogs = createServerFn({ method: "GET" }).handler(
  async (): Promise<UploadSummary> => {
    return cached("uploads", async () => {
      try {
        const rows = await fetchRange("UploadLogs!A2:F");
        const parsed: UploadRow[] = rows
          .filter((r) => r[0])
          .map((r) => ({
            timestamp: String(r[0] ?? "").trim(),
            action: String(r[1] ?? "").trim() || "—",
            rows: Number(r[2] ?? 0) || 0,
            columns: Number(r[3] ?? 0) || 0,
            status: String(r[4] ?? "").trim() || "—",
            notes: String(r[5] ?? "").trim(),
          }));

        const byActionMap = new Map<string, { action: string; runs: number; lastRows: number; lastRun: string; lastTime: number }>();
        let success = 0, failed = 0;
        for (const r of parsed) {
          if (r.status.toLowerCase().includes("success")) success++;
          else if (r.status.toLowerCase().includes("fail") || r.status.toLowerCase().includes("error")) failed++;
          const d = new Date(r.timestamp);
          const t = isNaN(d.getTime()) ? 0 : d.getTime();
          const a = byActionMap.get(r.action) ?? { action: r.action, runs: 0, lastRows: 0, lastRun: r.timestamp, lastTime: 0 };
          a.runs++;
          if (t >= a.lastTime) { a.lastTime = t; a.lastRun = r.timestamp; a.lastRows = r.rows; }
          byActionMap.set(r.action, a);
        }

        const sorted = [...parsed].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
        const last = sorted[0];

        return {
          fetchedAt: new Date().toISOString(),
          total: parsed.length,
          success,
          failed,
          lastRun: last?.timestamp ?? "",
          lastStatus: last?.status ?? "—",
          lastRows: last?.rows ?? 0,
          byAction: Array.from(byActionMap.values()).sort((a, b) => b.runs - a.runs),
          recent: sorted.slice(0, 100),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { fetchedAt: new Date().toISOString(), total: 0, success: 0, failed: 0, lastRun: "", lastStatus: "—", lastRows: 0, byAction: [], recent: [], error: msg };
      }
    });
  },
);

// ============================================================
// ASC Remarks (technician / branch remarks history per ticket)
// ============================================================
export interface AscRemarkRow {
  ticket: string;
  remark: string;
  updated: string;
  by: string;
}
export interface AscRemarksSummary {
  fetchedAt: string;
  total: number;
  withRemarks: number;
  authors: number;
  byAuthor: { author: string; entries: number }[];
  recent: AscRemarkRow[];
  error?: string;
}

export const getAscRemarks = createServerFn({ method: "GET" }).handler(
  async (): Promise<AscRemarksSummary> => {
    return cached("ascremarks", async () => {
      try {
        const rows = await fetchRange("ASC Remarks!A2:D");
        const parsed: AscRemarkRow[] = rows
          .filter((r) => r[0])
          .map((r) => ({
            ticket: String(r[0] ?? "").trim(),
            remark: String(r[1] ?? "").trim(),
            updated: String(r[2] ?? "").trim(),
            by: String(r[3] ?? "").trim(),
          }));

        const byAuthorMap = new Map<string, number>();
        let withRemarks = 0;
        for (const r of parsed) {
          if (r.remark) withRemarks++;
          if (r.by) byAuthorMap.set(r.by, (byAuthorMap.get(r.by) ?? 0) + 1);
        }
        return {
          fetchedAt: new Date().toISOString(),
          total: parsed.length,
          withRemarks,
          authors: byAuthorMap.size,
          byAuthor: Array.from(byAuthorMap.entries()).map(([author, entries]) => ({ author, entries })).sort((a, b) => b.entries - a.entries).slice(0, 15),
          recent: parsed.slice(-100).reverse(),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { fetchedAt: new Date().toISOString(), total: 0, withRemarks: 0, authors: 0, byAuthor: [], recent: [], error: msg };
      }
    });
  },
);
