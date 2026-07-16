import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Timer,
  Users,
  BarChart3,
  Building2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useAccess, applyAccessFilter } from "@/hooks/use-access";
import { useGlobalFilters, applyGlobalFilters, shortBranch, firstWord } from "@/hooks/use-global-filters";
import { readTable } from "@/lib/sheets-client";
import { cn } from "@/lib/utils";
import { evaluateFormula, formatValue, parseKpiFormulaRow, type KpiFormulaDef } from "@/lib/aux/formula";
import { Calculator } from "lucide-react";
import { kpiQueryOptions, satisfactionQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/kpis")({
  head: () => ({
    meta: [
      { title: "KPIs — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Live KPI scorecard for AUX service centres — tickets, pending, 48h/72h SLA and branch performance.",
      },
      { property: "og:title", content: "KPIs — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Real-time KPI performance filtered by your service centre access.",
      },
    ],
  }),
  component: KpisPage,
});

// SLA targets (hours) & thresholds
const SLA_24 = 24;
const SLA_48 = 48;
const SLA_72 = 72;
const TARGETS = { rate24h: 60, rate48h: 90, rate72h: 95, pendingRate: 10, rtatDays: 2 };

// Column names in Sheet1 of the maintenance sheet
const COL = {
  ticket: "Ticket Number",
  asc: "Service Provider Name",
  branch: "Service Provider Name",
  status: "Ticket Status",
  phase: "Processing Phase",
  hours: "Service hours(H)",
  timeliness: "Service Timeliness",
  serviceType: "Service Type",
  createdAt: "Order Creation Time",
  completedAt: "Completion time",
  completionResult: "Completion Result",
  worker: "Worker Name",
  location: "Location",
  tel: "Tel",
} as const;

const fmt = new Intl.NumberFormat("en-US");
const sar = new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

type Row = Record<string, string>;

// Classification is driven solely by the "Completion Result" column:
//   closed    → one of the 5 whitelisted results (Install, On-site Explanation,
//               Phone Explanation, Troubleshooting, Value-added Services)
//   cancelled → "Cancel The Service"
//   pending   → blank
import { classifyCompletion } from "@/lib/aux/completion";
function isCompleted(r: Row): boolean {
  return classifyCompletion(r[COL.completionResult]) === "closed";
}
function isCancelled(r: Row): boolean {
  return classifyCompletion(r[COL.completionResult]) === "cancelled";
}
function isPending(r: Row): boolean {
  return classifyCompletion(r[COL.completionResult]) === "pending";
}
function hours(r: Row): number {
  const v = parseFloat(r[COL.hours] || "");
  return Number.isFinite(v) ? v : NaN;
}

function pendingAgeDays(r: Row, now: number): number {
  const raw = r[COL.createdAt];
  if (!raw) return NaN;
  const d = new Date(String(raw).replace(" ", "T"));
  const t = d.getTime();
  if (!Number.isFinite(t)) return NaN;
  return (now - t) / 86_400_000;
}

// Derive service hours from completion - creation when the "Service hours(H)"
// column is blank, so SLA rates are not skewed by missing entries.
function serviceHours(r: Row): number {
  const explicit = parseFloat(r[COL.hours] || "");
  if (Number.isFinite(explicit)) return explicit;
  const start = r[COL.createdAt];
  const end = r[COL.completedAt];
  if (!start || !end) return NaN;
  const s = new Date(String(start).replace(" ", "T")).getTime();
  const e = new Date(String(end).replace(" ", "T")).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return NaN;
  return (e - s) / 3_600_000;
}

// Extract the city component from the free-text Location column.
// Sheet format is typically "Region / City / District" (also supports commas,
// vertical bars, or '>' as separators). Returns "" when the row has no city.
function cityOf(r: Row): string {
  const raw = String(r[COL.location] ?? "").trim();
  if (!raw) return "";
  const parts = raw.split(/[\/,>·|]/).map((p) => p.trim()).filter(Boolean);
  return (parts[1] ?? parts[0] ?? "").trim();
}

// Fuzzy match for the 3 main cities across Arabic + English spellings.
function mainCityKey(city: string): "Riyadh" | "Jeddah" | "Khobar" | "" {
  const c = city.toLowerCase();
  if (!c) return "";
  if (c.includes("riyadh") || c.includes("الرياض") || c === "رياض") return "Riyadh";
  if (c.includes("jeddah") || c.includes("jedda") || c.includes("جدة") || c.includes("جده")) return "Jeddah";
  if (c.includes("khobar") || c.includes("khubar") || c.includes("الخبر") || c === "خبر") return "Khobar";
  return "";
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

function KpisPage() {
  const { access, ready } = useAccess();

  const query = useQuery({
    queryKey: ["maintenance", "Sheet1"],
    queryFn: () => readTable("maintenance", "Sheet1!A1:AE"),
    staleTime: 60_000,
    enabled: ready,
  });

  const kpiQuery = useQuery({ ...kpiQueryOptions(), enabled: ready });
  const satisfactionQuery = useQuery({ ...satisfactionQueryOptions, enabled: ready });

  const npsByMonth = useMemo(() => {
    const map = new Map<string, { cic: number; repair: number }>();
    for (const m of satisfactionQuery.data?.byMonth ?? []) {
      map.set(m.month, { cic: m.cicNps, repair: m.repairNps });
    }
    return map;
  }, [satisfactionQuery.data]);

  const npsVal = (key: string, kind: "cic" | "repair"): number | null => {
    const collect = (ks: string[]) => {
      const vals: number[] = [];
      for (const k of ks) {
        const e = npsByMonth.get(k);
        if (e) vals.push(kind === "cic" ? e.cic : e.repair);
      }
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };
    const m = key.match(/^(\d{4})TTL$/);
    if (m) return collect(MONTHS_BY_YEAR.get(m[1]) ?? []);
    return collect([key]);
  };

  const formulasQuery = useQuery<KpiFormulaDef[]>({
    queryKey: ["kpi-formulas"],
    enabled: ready && !!access?.email,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const r = await fetch("/api/public/sheet-write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actorEmail: access?.email, action: "list", tab: "KPIFormulas" }),
        });
        const d = (await r.json()) as { ok: boolean; rows?: string[][] };
        if (!d.ok || !d.rows) return [];
        return d.rows
          .map((row, i) => parseKpiFormulaRow(row, i + 2))
          .filter((f) => f.name && f.formula && !f.hidden);
      } catch {
        return [];
      }
    },
  });

  const rows = useMemo(() => {
    if (!query.data) return [] as Row[];
    return applyAccessFilter(query.data.rows, access, {
      asc: COL.asc,
      branch: COL.branch,
    });
  }, [query.data, access]);

  const { filters } = useGlobalFilters();
  const filteredRows = useMemo(
    () => applyGlobalFilters(rows, {
      spn: COL.asc, worker: COL.worker, createdAt: COL.createdAt,
    }, filters),
    [rows, filters],
  );

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const completed = filteredRows.filter(isCompleted).length;
    const pending = filteredRows.filter(isPending).length;
    const completedRows = filteredRows.filter(isCompleted);
    const withHrs = completedRows.filter((r) => Number.isFinite(serviceHours(r)));
    const under24 = withHrs.filter((r) => serviceHours(r) <= SLA_24).length;
    const under48 = withHrs.filter((r) => serviceHours(r) <= SLA_48).length;
    const under72 = withHrs.filter((r) => serviceHours(r) <= SLA_72).length;
    // Spec: 48h % = closed within 48h / total closed (same scope).
    //       72h % = closed within 72h / total closed (same scope).
    const rate24 = pct(under24, completed);
    const rate48 = pct(under48, completed);
    const rate72 = pct(under72, completed);
    const avgHours =
      withHrs.length > 0
        ? withHrs.reduce((s, r) => s + serviceHours(r), 0) / withHrs.length
        : 0;
    const branches = new Set(
      filteredRows.map((r) => shortBranch(r[COL.branch])).filter(Boolean),
    ).size;
    // Spec: Pending rate = tickets created in the period with no completion
    // result yet AND already older than 24h, over total created.
    const now = Date.now();
    const pendingOver24 = filteredRows.filter((r) => {
      if (!isPending(r)) return false;
      const age = pendingAgeDays(r, now);
      return Number.isFinite(age) && age * 24 > 24;
    }).length;
    return {
      total, completed, pending, rate24, rate48, rate72, avgHours, branches,
      pendingRate: pct(pendingOver24, total),
      pendingOver24,
      completionRate: pct(completed, total),
      u24: under24,
      u48: under48,
      u72: under72,
      withHrs: withHrs.length,
    };
  }, [filteredRows]);

  // Monthly buckets — key = YYYY-MM
  const monthly = useMemo(() => {
    const now = Date.now();
    type M = {
      total: number; completed: number; pending: number;
      withHrs: number; hrsSum: number; pending7d: number; pendingOver24: number;
      u24: number; u48: number; u72: number;
    };
    const map = new Map<string, M>();
    const key = (r: Row): string | null => {
      const raw = r[COL.createdAt];
      if (!raw) return null;
      const d = new Date(String(raw).replace(" ", "T"));
      if (!Number.isFinite(d.getTime())) return null;
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    for (const r of filteredRows) {
      const k = key(r);
      if (!k) continue;
      // Skip cancelled tickets — they don't count toward pending or SLA.
      if (isCancelled(r)) continue;
      const e = map.get(k) ?? { total: 0, completed: 0, pending: 0, withHrs: 0, hrsSum: 0, pending7d: 0, pendingOver24: 0, u24: 0, u48: 0, u72: 0 };
      e.total++;
      const done = isCompleted(r);
      if (done) e.completed++;
      // Compute lifespan hours from creation → (completion for closed, now for pending).
      const createdRaw = r[COL.createdAt];
      const createdMs = createdRaw ? new Date(String(createdRaw).replace(" ", "T")).getTime() : NaN;
      let lifeHours = NaN;
      if (Number.isFinite(createdMs)) {
        if (done) {
          const endRaw = r[COL.completedAt];
          const endMs = endRaw ? new Date(String(endRaw).replace(" ", "T")).getTime() : NaN;
          if (Number.isFinite(endMs) && endMs >= createdMs) lifeHours = (endMs - createdMs) / 3_600_000;
          else lifeHours = serviceHours(r); // fallback to explicit column
        } else if (isPending(r)) {
          e.pending++;
          lifeHours = (now - createdMs) / 3_600_000;
        }
      }
      if (done && Number.isFinite(lifeHours)) {
        e.withHrs++;
        e.hrsSum += lifeHours;
        if (lifeHours <= SLA_24) e.u24++;
        if (lifeHours <= SLA_48) e.u48++;
        if (lifeHours <= SLA_72) e.u72++;
      }
      if (Number.isFinite(lifeHours)) {
        if (lifeHours > SLA_48) e.pendingOver24++;
        if (lifeHours > SLA_48) e.pending7d++;
      }
      map.set(k, e);
    }
    return map;
  }, [filteredRows]);

  // Reclaim: same customer (Tel) with same Service Type returning within 90 days.
  // Bucket = the month of the *later* (reclaimed) ticket.
  const reclaimByMonth = useMemo(() => {
    const RECLAIM_WINDOW_MS = 90 * 86_400_000;
    const monthKey = (ms: number): string => {
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    const normTel = (s: string) =>
      String(s ?? "").replace(/\D/g, "").replace(/^966/, "0").replace(/^0+/, "0");
    const normSt = (s: string) => String(s ?? "").trim().toLowerCase();

    type Entry = { ms: number };
    const groups = new Map<string, Entry[]>();
    const closedByMonth = new Map<string, number>();

    for (const r of filteredRows) {
      if (!isCompleted(r)) continue;
      const raw = r[COL.createdAt];
      if (!raw) continue;
      const ms = new Date(String(raw).replace(" ", "T")).getTime();
      if (!Number.isFinite(ms)) continue;
      const mk = monthKey(ms);
      closedByMonth.set(mk, (closedByMonth.get(mk) ?? 0) + 1);
      const tel = normTel(r[COL.tel] || "");
      const st = normSt(r[COL.serviceType] || "");
      if (!tel || !st) continue;
      const gk = `${tel}::${st}`;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk)!.push({ ms });
    }

    const reclaimByMonthMap = new Map<string, number>();
    for (const entries of groups.values()) {
      if (entries.length < 2) continue;
      entries.sort((a, b) => a.ms - b.ms);
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].ms - entries[i - 1].ms <= RECLAIM_WINDOW_MS) {
          const mk = monthKey(entries[i].ms);
          reclaimByMonthMap.set(mk, (reclaimByMonthMap.get(mk) ?? 0) + 1);
        }
      }
    }

    const merged = new Map<string, { reclaims: number; closed: number }>();
    for (const [mk, closed] of closedByMonth) {
      merged.set(mk, { reclaims: reclaimByMonthMap.get(mk) ?? 0, closed });
    }
    return merged;
  }, [filteredRows]);

  // Per-company monthly breakdown of currently-pending tickets older than 6 days.
  const monthlyByCompany = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const now = Date.now();
    for (const r of filteredRows) {
      if (isCancelled(r)) continue;
      let qualifies = false;
      const createdRaw = r[COL.createdAt];
      const createdMs = createdRaw ? new Date(String(createdRaw).replace(" ", "T")).getTime() : NaN;
      if (!Number.isFinite(createdMs)) continue;
      if (isPending(r)) {
        const days = (now - createdMs) / 86_400_000;
        if (days * 24 > SLA_48) qualifies = true;
      } else if (isCompleted(r)) {
        const endRaw = r[COL.completedAt];
        const endMs = endRaw ? new Date(String(endRaw).replace(" ", "T")).getTime() : NaN;
        const hrs = Number.isFinite(endMs) && endMs >= createdMs
          ? (endMs - createdMs) / 3_600_000
          : serviceHours(r);
        if (Number.isFinite(hrs) && hrs > SLA_48) qualifies = true;
      }
      if (!qualifies) continue;
      const fw = firstWord(r[COL.asc] || "");
      const fwU = fw.toUpperCase();
      if (!fw || fwU === "AUTHORIZED") continue;
      const company = fwU.startsWith("HMA") ? "HMA" : fw;
      const d = new Date(createdMs);
      const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!map.has(company)) map.set(company, new Map());
      const inner = map.get(company)!;
      inner.set(mk, (inner.get(mk) ?? 0) + 1);
    }
    return map;
  }, [filteredRows]);

  // Months actually present in the filtered dataset — used to drive both the
  // scorecard columns and the year-total (YYYY TTL) aggregations.
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const { MONTH_COLS, MONTHS_BY_YEAR } = useMemo(() => {
    const byYear = new Map<string, string[]>();
    for (const k of monthly.keys()) {
      const [y] = k.split("-");
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(k);
    }
    const years = Array.from(byYear.keys()).sort();
    for (const y of years) byYear.get(y)!.sort();
    const cols: Array<{ key: string; label: string; kind: "m" | "ttl" | "sep" }> = [];
    for (const y of years) {
      const yy = y.slice(2);
      const months = byYear.get(y)!;
      months.forEach((mk, i) => {
        const monthIdx = parseInt(mk.split("-")[1], 10) - 1;
        const name = MONTH_NAMES[monthIdx] ?? mk;
        cols.push({ key: mk, label: i === 0 ? `${yy}' ${name}` : name, kind: "m" });
      });
      cols.push({ key: `${y}TTL`, label: `${yy} TTL`, kind: "ttl" });
    }
    return { MONTH_COLS: cols, MONTHS_BY_YEAR: byYear };
  }, [monthly]);

  // Monthly RTAT per main city (Riyadh / Jeddah / Khobar) — average service
  // hours (converted to days) of closed tickets whose Location resolves to
  // that city.
  const monthlyCity = useMemo(() => {
    type M = { withHrs: number; hrsSum: number };
    const map = new Map<string, M>(); // key = `${city}::${YYYY-MM}`
    const monthKey = (r: Row): string | null => {
      const raw = r[COL.createdAt];
      if (!raw) return null;
      const d = new Date(String(raw).replace(" ", "T"));
      if (!Number.isFinite(d.getTime())) return null;
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    for (const r of filteredRows) {
      if (!isCompleted(r)) continue;
      const city = mainCityKey(cityOf(r));
      if (!city) continue;
      const mk = monthKey(r);
      if (!mk) continue;
      const h = serviceHours(r);
      if (!Number.isFinite(h)) continue;
      const k = `${city}::${mk}`;
      const e = map.get(k) ?? { withHrs: 0, hrsSum: 0 };
      e.withHrs++;
      e.hrsSum += h;
      map.set(k, e);
    }
    return map;
  }, [filteredRows]);

  const cityRtat = (city: "Riyadh" | "Jeddah" | "Khobar", colKey: string): number | null => {
    const collect = (ks: string[]) => {
      let withHrs = 0, hrsSum = 0;
      for (const k of ks) {
        const e = monthlyCity.get(`${city}::${k}`);
        if (!e) continue;
        withHrs += e.withHrs; hrsSum += e.hrsSum;
      }
      return withHrs > 0 ? hrsSum / withHrs / 24 : null;
    };
    const m = colKey.match(/^(\d{4})TTL$/);
    if (m) return collect(MONTHS_BY_YEAR.get(m[1]) ?? []);
    return collect([colKey]);
  };

  const formulaVars = useMemo<Record<string, number>>(() => ({
    total: stats.total,
    completed: stats.completed,
    pending: stats.pending,
    with_hrs: stats.withHrs,
    u24: stats.u24,
    u48: stats.u48,
    u72: stats.u72,
    avg_hours: stats.avgHours,
    branches: stats.branches,
  }), [stats]);

  const customKpis = useMemo(() => {
    const defs = formulasQuery.data ?? [];
    return defs.map((d) => {
      const res = evaluateFormula(d.formula, formulaVars);
      return {
        name: d.name,
        formula: d.formula,
        display: res.error ? "—" : formatValue(res.value, d.format),
        error: res.error,
      };
    });
  }, [formulasQuery.data, formulaVars]);

  const branchTable = useMemo(() => {
    const now = Date.now();
    type Row2 = {
      total: number; completed: number; pending: number;
      withHrs: number; u24: number; u48: number; u72: number;
      hrsSum: number; pending3d: number; pending7d: number;
    };
    const map = new Map<string, Row2>();
    for (const r of filteredRows) {
      const key = shortBranch(r[COL.branch]) || "—";
      const e = map.get(key) ?? {
        total: 0, completed: 0, pending: 0,
        withHrs: 0, u24: 0, u48: 0, u72: 0,
        hrsSum: 0, pending3d: 0, pending7d: 0,
      };
      e.total++;
      const done = isCompleted(r);
      const pend = isPending(r);
      if (done) e.completed++;
      if (pend) {
        e.pending++;
        const age = pendingAgeDays(r, now);
        if (Number.isFinite(age)) {
          if (age > 3) e.pending3d++;
          if (age > 7) e.pending7d++;
        }
      }
      const h = serviceHours(r);
      if (done && Number.isFinite(h)) {
        e.withHrs++;
        e.hrsSum += h;
        if (h <= SLA_24) e.u24++;
        if (h <= SLA_48) e.u48++;
        if (h <= SLA_72) e.u72++;
      }
      map.set(key, e);
    }
    // Warranty amount / csat lookup by branch — matching normalized branch labels.
    const warrByBranch = new Map<string, number>();
    const csatByBranch = new Map<string, number>();
    const wtyQtyByBranch = new Map<string, number>();
    if (kpiQuery.data) {
      for (const w of kpiQuery.data.warranty.byBranch) {
        warrByBranch.set(w.branch, w.net);
        wtyQtyByBranch.set(w.branch, w.claims);
      }
      for (const b of kpiQuery.data.branches) {
        csatByBranch.set(b.branch, b.csat);
      }
    }
    const findKey = (m: Map<string, number>, branch: string): number | undefined => {
      if (m.has(branch)) return m.get(branch);
      const lc = branch.toLowerCase();
      for (const [k, v] of m) {
        if (k.toLowerCase() === lc) return v;
        if (k.toLowerCase().includes(lc) || lc.includes(k.toLowerCase())) return v;
      }
      return undefined;
    };
    return Array.from(map.entries())
      .map(([branch, s]) => ({
        branch,
        ...s,
        rate24: pct(s.u24, s.completed),
        rate48: pct(s.u48, s.completed),
        rate72: pct(s.u72, s.completed),
        rtat: s.withHrs > 0 ? s.hrsSum / s.withHrs : 0,
        csat: findKey(csatByBranch, branch) ?? 0,
        wtyQty: findKey(wtyQtyByBranch, branch) ?? s.completed,
        wtyAmount: findKey(warrByBranch, branch) ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRows, kpiQuery.data]);

  const scope = access
    ? access.isAllAccess
      ? "All service centres"
      : `${access.asc}${access.branch ? " · " + access.branch : ""}`
    : "—";

  const monthVal = (key: string, field: "total" | "completed" | "pending" | "pending7d" | "rtat" | "rate24" | "rate48" | "rate72" | "reclaim"): number | null => {
    const collect = (ks: string[]) => {
      let total = 0, completed = 0, pending = 0, pending7d = 0, withHrs = 0, hrsSum = 0, pendingOver24 = 0;
      let u24 = 0, u48 = 0, u72 = 0;
      let reclaims = 0, reclaimClosed = 0;
      let any = false;
      for (const k of ks) {
        const e = monthly.get(k);
        if (e) {
          any = true;
          total += e.total; completed += e.completed; pending += e.pending;
          pending7d += e.pending7d; withHrs += e.withHrs; hrsSum += e.hrsSum;
          pendingOver24 += e.pendingOver24;
          u24 += e.u24; u48 += e.u48; u72 += e.u72;
        }
        const rc = reclaimByMonth.get(k);
        if (rc) { any = true; reclaims += rc.reclaims; reclaimClosed += rc.closed; }
      }
      if (!any) return null;
      if (field === "total") return total;
      if (field === "completed") return completed;
      if (field === "pending") return pendingOver24;
      if (field === "pending7d") return pending7d;
      if (field === "rtat") return withHrs > 0 ? hrsSum / withHrs / 24 : null;
      if (field === "rate24") return completed > 0 ? (u24 / completed) * 100 : null;
      if (field === "rate48") return completed > 0 ? (u48 / completed) * 100 : null;
      if (field === "rate72") return completed > 0 ? (u72 / completed) * 100 : null;
      if (field === "reclaim") return reclaimClosed > 0 ? (reclaims / reclaimClosed) * 100 : null;
      return null;
    };
    const m = key.match(/^(\d{4})TTL$/);
    if (m) return collect(MONTHS_BY_YEAR.get(m[1]) ?? []);
    return collect([key]);
  };

  const companyPending7d = (company: string, colKey: string): number | null => {
    const inner = monthlyByCompany.get(company);
    if (!inner) return null;
    const collect = (ks: string[]) => {
      let sum = 0; let any = false;
      for (const k of ks) { const v = inner.get(k); if (v !== undefined) { sum += v; any = true; } }
      return any ? sum : null;
    };
    const m = colKey.match(/^(\d{4})TTL$/);
    if (m) return collect(MONTHS_BY_YEAR.get(m[1]) ?? []);
    return collect([colKey]);
  };

  const companies = useMemo(
    () => Array.from(monthlyByCompany.keys()).sort(),
    [monthlyByCompany],
  );

  // Net SVC Cost (M USD) — derived from warranty payments (net SAR → M USD).
  // SAR→USD peg: 3.75.
  const svcCostMUSD = (colKey: string): number | null => {
    if (!kpiQuery.data) return null;
    const byMonth = new Map<string, number>();
    for (const w of kpiQuery.data.warranty.byMonth) byMonth.set(w.month, w.net);
    const collect = (ks: string[]) => {
      let sum = 0; let any = false;
      for (const k of ks) {
        const v = byMonth.get(k);
        if (v !== undefined) { sum += v; any = true; }
      }
      return any ? sum / 3.75 / 1_000_000 : null;
    };
    const m = colKey.match(/^(\d{4})TTL$/);
    if (m) return collect(MONTHS_BY_YEAR.get(m[1]) ?? []);
    return collect([colKey]);
  };

  type RowKind = "num" | "pct" | "days" | "k" | "m" | "musd";
  interface KRow {
    category?: string;
    label: string;
    indent?: number;
    bold?: boolean;
    kind: RowKind;
    // returns raw number or null when not computable
    value: (colKey: string) => number | null;
    bp?: number | null;
  }

  const empty = (): number | null => null;

  const kpiRows: KRow[] = [
    { category: "SLA", label: "24hr (%)", kind: "pct",
      value: (c) => monthVal(c, "rate24"), bp: 60 },
    { label: "48hr (%)", kind: "pct",
      value: (c) => monthVal(c, "rate48"), bp: 90 },
    { label: "72hr (%)", kind: "pct",
      value: (c) => monthVal(c, "rate72"), bp: 95 },

    { category: "Strengthen Basic competence", label: "Repair Q'ty (K)", kind: "num",
      value: (c) => { const v = monthVal(c, "completed"); return v === null ? null : v; } },
    { label: "Reclaim Total (%)", kind: "pct",
      value: (c) => monthVal(c, "reclaim"), bp: 5 },

    { label: "RTAT (Day)", bold: true, kind: "days",
      value: (c) => monthVal(c, "rtat"), bp: 2 },
    { label: "RTAT (3D Main City)", indent: 1, kind: "days",
      value: (c) => {
        const vals = [cityRtat("Riyadh", c), cityRtat("Jeddah", c), cityRtat("Khobar", c)]
          .filter((v): v is number => v !== null && Number.isFinite(v));
        return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      } },
    { label: "Riyadh", indent: 2, kind: "days", value: (c) => cityRtat("Riyadh", c) },
    { label: "Jeddah", indent: 2, kind: "days", value: (c) => cityRtat("Jeddah", c) },
    { label: "Khobar", indent: 2, kind: "days", value: (c) => cityRtat("Khobar", c) },

    { label: "TTL Pending Q'ty", bold: true, kind: "num",
      value: (c) => monthVal(c, "pending"), bp: 1742 },
    { label: ">48 Hr", indent: 1, kind: "num",
      value: (c) => monthVal(c, "pending7d"), bp: 997 },
    ...companies.map((co) => ({
      label: co,
      indent: 2 as const,
      kind: "num" as RowKind,
      value: (c: string) => companyPending7d(co, c),
    })),
    { category: "Preparation for Future Service", label: "Digital consultation rate (%)", kind: "pct", value: empty, bp: 50 },
    { label: "Digital (K)", indent: 1, kind: "num", value: empty },
    { label: "Call + Digital (K)", indent: 1, kind: "num", value: empty },

    { category: "CIC", label: "Consultation Satisfaction (Point)", kind: "num", value: empty, bp: 4.5 },
    { label: "Consultation resolution (%)", kind: "pct", value: empty },

    { category: "NPS", label: "CIC T NPS", kind: "pct",
      value: (c) => npsVal(c, "cic") },
    { label: "Repair T NPS", kind: "pct",
      value: (c) => npsVal(c, "repair") },

    { category: "Business", label: "Net SVC Cost (M USD)", kind: "musd",
      value: (c) => svcCostMUSD(c), bp: 0.2 },
    { label: "Net SVC Cost rate (%)", kind: "pct", value: empty, bp: 0.49 },
  ];

  const fmtCell = (v: number | null, kind: RowKind): string => {
    if (v === null || !Number.isFinite(v)) return "—";
    if (kind === "pct") return `${v.toFixed(1)}%`;
    if (kind === "days") return v.toFixed(1);
    if (kind === "musd") return v.toFixed(2);
    if (kind === "num") return fmt.format(Math.round(v));
    if (kind === "k") return fmt.format(Math.round(v));
    if (kind === "m") return fmt.format(Math.round(v));
    return String(v);
  };

  return (
    <DashboardLayout
      title="KPIs"
      subtitle={`Live from maintenance sheet · Scope: ${scope}`}
    >
      {query.isError && (
        <div className="surface-card p-4 border border-destructive/40 text-destructive text-sm">
          Failed to load maintenance data: {(query.error as Error)?.message}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total Tickets"
          value={query.isLoading ? "…" : fmt.format(stats.total)}
          hint={query.isLoading ? "Loading…" : `${stats.branches} branch(es)`}
          icon={Activity}
          tone="primary"
        />
        <KpiCard
          label="Completed"
          value={query.isLoading ? "…" : fmt.format(stats.completed)}
          hint={`${stats.completionRate.toFixed(1)}% completion`}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Pending"
          value={query.isLoading ? "…" : fmt.format(stats.pending)}
          hint={`${stats.pendingRate.toFixed(1)}% of total · target ≤ ${TARGETS.pendingRate}%`}
          icon={AlertTriangle}
          tone={stats.pendingRate > TARGETS.pendingRate ? "destructive" : "warning"}
        />
        <KpiCard
          label="Avg Repair Time"
          value={query.isLoading ? "…" : `${stats.avgHours.toFixed(1)}h`}
          hint="Across completed tickets"
          icon={Timer}
          tone="accent"
        />
        <KpiCard
          label="24h Rate"
          value={query.isLoading ? "…" : `${stats.rate24.toFixed(1)}%`}
          hint={`Target ≥ ${TARGETS.rate24h}%`}
          icon={Clock}
          tone={stats.rate24 >= TARGETS.rate24h ? "success" : "warning"}
        />
        <KpiCard
          label="48h Rate"
          value={query.isLoading ? "…" : `${stats.rate48.toFixed(1)}%`}
          hint={`Target ≥ ${TARGETS.rate48h}%`}
          icon={Clock}
          tone={stats.rate48 >= TARGETS.rate48h ? "success" : "warning"}
        />
        <KpiCard
          label="72h Rate"
          value={query.isLoading ? "…" : `${stats.rate72.toFixed(1)}%`}
          hint={`Target ≥ ${TARGETS.rate72h}%`}
          icon={Clock}
          tone={stats.rate72 >= TARGETS.rate72h ? "success" : "warning"}
        />
        <KpiCard
          label="Branches"
          value={query.isLoading ? "…" : fmt.format(stats.branches)}
          hint="Distinct service centres in scope"
          icon={Building2}
          tone="primary"
        />
      </div>

      {customKpis.length > 0 && (
        <ChartCard title="Custom KPI Formulas" subtitle="Defined in Data Editor · evaluated against the current scope">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {customKpis.map((k) => (
              <KpiCard
                key={k.name}
                label={k.name}
                value={k.display}
                hint={k.error ? `Error: ${k.error}` : k.formula}
                icon={Calculator}
                tone={k.error ? "destructive" : "primary"}
              />
            ))}
          </div>
        </ChartCard>
      )}

      <ChartCard
        title="Branch Scorecard"
        subtitle={`Targets — 24h ≥ ${TARGETS.rate24h}% · 48h ≥ ${TARGETS.rate48h}% · 72h ≥ ${TARGETS.rate72h}% · RTAT ≤ ${TARGETS.rtatDays}d`}
      >
        {query.isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading live maintenance data…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <BarChart3 className="h-8 w-8 opacity-40" />
            No tickets in your access scope yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border border-border">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground">
                  <th rowSpan={2} className="py-2 px-3 text-start font-semibold border border-border bg-muted sticky left-0 z-30 w-28 min-w-28">Category</th>
                  <th rowSpan={2} className="py-2 px-3 text-start font-semibold border border-border bg-muted sticky left-28 z-30 min-w-[14rem]">Metric</th>
                  <th rowSpan={2} className="py-2 px-2 text-center font-semibold border border-border">vs PY</th>
                  {Array.from(MONTHS_BY_YEAR.keys()).sort().map((y) => {
                    const span = (MONTHS_BY_YEAR.get(y)?.length ?? 0) + 1;
                    return (
                      <th key={y} colSpan={span} className="py-2 px-2 text-center font-semibold border border-border">{y}</th>
                    );
                  })}
                  <th colSpan={2} className="py-2 px-2 text-center font-semibold border border-border bg-muted/70">Comparisons</th>
                </tr>
                <tr className="bg-muted/30 text-muted-foreground">
                  {MONTH_COLS.map((c) => (
                    <th key={c.key} className={cn("py-1.5 px-2 text-center font-medium border border-border", c.kind === "ttl" && "bg-accent/40")}>
                      {c.label}
                    </th>
                  ))}
                  <th className="py-1.5 px-2 text-center font-medium border border-border">vs LM</th>
                  <th className="py-1.5 px-2 text-center font-medium border border-border">vs BP</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // compute row spans for categories
                  const catCounts = new Map<string, number>();
                  let currentCat = "";
                  for (const r of kpiRows) {
                    if (r.category) currentCat = r.category;
                    catCounts.set(currentCat, (catCounts.get(currentCat) ?? 0) + 1);
                  }
                  const seenCat = new Set<string>();
                  let lastCat = "";
                  return kpiRows.map((r, idx) => {
                    if (r.category) lastCat = r.category;
                    const showCat = r.category && !seenCat.has(r.category);
                    if (showCat) seenCat.add(r.category!);
                    const monthKeys = MONTH_COLS.filter((c) => c.kind === "m").map((c) => c.key);
                    const curKey = monthKeys[monthKeys.length - 1];
                    const prevKey = monthKeys[monthKeys.length - 2];
                    const curVal = curKey ? r.value(curKey) : null;
                    const prevVal = prevKey ? r.value(prevKey) : null;
                    const vsLM = curVal != null && prevVal != null && prevVal !== 0 ? (curVal / prevVal) * 100 : null;
                    const vsBP = r.bp != null && curVal != null && r.bp !== 0 ? (curVal / r.bp) * 100 : null;
                    return (
                      <tr key={idx} className="border border-border hover:bg-muted/20">
                        {showCat && (
                          <td rowSpan={catCounts.get(lastCat)} className="py-2 px-3 font-semibold text-foreground bg-background border border-border align-middle text-center sticky left-0 z-20 w-28 min-w-28">
                            {lastCat}
                          </td>
                        )}
                        <td className={cn("py-1.5 px-3 border border-border whitespace-nowrap bg-background sticky left-28 z-10 min-w-[14rem]", r.bold && "font-semibold", r.indent === 1 && "pl-6", r.indent === 2 && "pl-10 text-muted-foreground")}>
                          {r.label}
                        </td>
                        <td className="py-1.5 px-2 text-center tabular-nums border border-border text-muted-foreground">—</td>
                        {MONTH_COLS.map((c) => {
                          const v = r.value(c.key);
                          return (
                            <td key={c.key} className={cn("py-1.5 px-2 text-center tabular-nums border border-border", c.kind === "ttl" && "bg-accent/20 font-semibold")}>
                              {fmtCell(v, r.kind)}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2 text-center tabular-nums border border-border">
                          {vsLM != null ? <span className={cn("inline-block rounded px-1.5 py-0.5", vsLM >= 100 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>{vsLM.toFixed(0)}%</span> : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-center tabular-nums border border-border">
                          {vsBP != null ? <span className={cn("inline-block rounded px-1.5 py-0.5", vsBP >= 100 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>{vsBP.toFixed(0)}%</span> : "—"}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </DashboardLayout>
  );
}