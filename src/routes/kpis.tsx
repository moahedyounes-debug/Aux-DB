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
import { useGlobalFilters, applyGlobalFilters, shortBranch } from "@/hooks/use-global-filters";
import { readTable } from "@/lib/sheets-client";
import { cn } from "@/lib/utils";
import { evaluateFormula, formatValue, parseKpiFormulaRow, type KpiFormulaDef } from "@/lib/aux/formula";
import { Calculator } from "lucide-react";
import { kpiQueryOptions } from "@/lib/aux/queries";

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
const TARGETS = { rate24h: 70, rate48h: 90, rate72h: 95, pendingRate: 10 };

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
    const withHrs = completedRows.filter((r) => Number.isFinite(hours(r)));
    const under24 = withHrs.filter((r) => hours(r) <= SLA_24).length;
    const under48 = withHrs.filter((r) => hours(r) <= SLA_48).length;
    const under72 = withHrs.filter((r) => hours(r) <= SLA_72).length;
    const rate24 = pct(under24, withHrs.length);
    const rate48 = pct(under48, withHrs.length);
    const rate72 = pct(under72, withHrs.length);
    const avgHours =
      withHrs.length > 0
        ? withHrs.reduce((s, r) => s + hours(r), 0) / withHrs.length
        : 0;
    const branches = new Set(
      filteredRows.map((r) => shortBranch(r[COL.branch])).filter(Boolean),
    ).size;
    return {
      total, completed, pending, rate24, rate48, rate72, avgHours, branches,
      pendingRate: pct(pending, total),
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
      withHrs: number; hrsSum: number; pending7d: number;
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
      const e = map.get(k) ?? { total: 0, completed: 0, pending: 0, withHrs: 0, hrsSum: 0, pending7d: 0 };
      e.total++;
      const done = isCompleted(r);
      if (done) e.completed++;
      if (isPending(r)) {
        e.pending++;
        const age = pendingAgeDays(r, now);
        if (Number.isFinite(age) && age > 7) e.pending7d++;
      }
      const h = hours(r);
      if (done && Number.isFinite(h)) {
        e.withHrs++;
        e.hrsSum += h;
      }
      map.set(k, e);
    }
    return map;
  }, [filteredRows]);

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
      const h = hours(r);
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
        rate24: pct(s.u24, s.withHrs),
        rate48: pct(s.u48, s.withHrs),
        rate72: pct(s.u72, s.withHrs),
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

  // ---- Monthly scorecard layout (matches uploaded reference) ----
  const MONTH_COLS: Array<{ key: string; label: string; kind: "m" | "ttl" | "sep" }> = [
    { key: "2024-01", label: "24' Jan", kind: "m" },
    { key: "2024-02", label: "Feb", kind: "m" },
    { key: "2024-03", label: "Mar", kind: "m" },
    { key: "24TTL", label: "24 TTL", kind: "ttl" },
    { key: "2025-01", label: "25' Jan", kind: "m" },
    { key: "2025-02", label: "Feb", kind: "m" },
    { key: "2025-03", label: "Mar", kind: "m" },
    { key: "25TTL", label: "25 TTL", kind: "ttl" },
  ];

  const monthVal = (key: string, field: "total" | "completed" | "pending" | "pending7d" | "rtat"): number | null => {
    const collect = (ks: string[]) => {
      let total = 0, completed = 0, pending = 0, pending7d = 0, withHrs = 0, hrsSum = 0;
      let any = false;
      for (const k of ks) {
        const e = monthly.get(k);
        if (!e) continue;
        any = true;
        total += e.total; completed += e.completed; pending += e.pending;
        pending7d += e.pending7d; withHrs += e.withHrs; hrsSum += e.hrsSum;
      }
      if (!any) return null;
      if (field === "total") return total;
      if (field === "completed") return completed;
      if (field === "pending") return pending;
      if (field === "pending7d") return pending7d;
      if (field === "rtat") return withHrs > 0 ? hrsSum / withHrs / 24 : null;
      return null;
    };
    if (key === "24TTL") return collect(["2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07","2024-08","2024-09","2024-10","2024-11","2024-12"]);
    if (key === "25TTL") return collect(["2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12"]);
    return collect([key]);
  };

  type RowKind = "num" | "pct" | "days" | "k" | "m";
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
    { category: "Sales", label: "Amount(M)", kind: "m", value: empty },
    { label: "Q'ty(K)", kind: "k", value: empty },

    { category: "Strengthen Basic competence", label: "Repair Q'ty (K)", kind: "num",
      value: (c) => { const v = monthVal(c, "completed"); return v === null ? null : v; } },
    { label: "Reclaim Total (%)", kind: "pct", value: empty, bp: 3.5 },

    { label: "RTAT (Day)", bold: true, kind: "days",
      value: (c) => monthVal(c, "rtat"), bp: 3.6 },
    { label: "RTAT (3D Main City)", indent: 1, kind: "days", value: empty },
    { label: "Riyadh", indent: 2, kind: "days", value: empty },
    { label: "Jeddah", indent: 2, kind: "days", value: empty },
    { label: "Khobar", indent: 2, kind: "days", value: empty },

    { label: "TTL Pending Q'ty", bold: true, kind: "num",
      value: (c) => monthVal(c, "pending"), bp: 1742 },
    { label: ">7D", indent: 1, kind: "num",
      value: (c) => monthVal(c, "pending7d"), bp: 997 },
    { label: "Naghi", indent: 2, kind: "num", value: empty, bp: 600 },
    { label: "Shaker", indent: 2, kind: "num", value: empty, bp: 397 },
    { label: "Pending T/O (days)", bold: true, kind: "days", value: empty, bp: 4.2 },

    { category: "Preparation for Future Service", label: "Digital consultation rate (%)", kind: "pct", value: empty, bp: 50 },
    { label: "Digital (K)", indent: 1, kind: "num", value: empty },
    { label: "Call + Digital (K)", indent: 1, kind: "num", value: empty },

    { category: "CIC", label: "Consultation Satisfaction (Point)", kind: "num", value: empty, bp: 4.5 },
    { label: "Consultation resolution (%)", kind: "pct", value: empty },

    { category: "NPS", label: "CIC T NPS", kind: "pct", value: empty },
    { label: "Repair T NPS", kind: "pct", value: empty },

    { category: "VOC", label: "TTL", bold: true, kind: "num", value: empty },
    { label: "Marketing", indent: 1, kind: "num", value: empty },
    { label: "OBS", indent: 1, kind: "num", value: empty },
    { label: "Factory", indent: 1, kind: "num", value: empty },
    { label: "Service", indent: 1, kind: "num", value: empty },

    { category: "Business", label: "Net SVC Cost (M USD)", kind: "num", value: empty, bp: 0.2 },
    { label: "Net SVC Cost rate (%)", kind: "pct", value: empty, bp: 0.49 },
  ];

  const fmtCell = (v: number | null, kind: RowKind): string => {
    if (v === null || !Number.isFinite(v)) return "—";
    if (kind === "pct") return `${v.toFixed(1)}%`;
    if (kind === "days") return v.toFixed(1);
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
        subtitle={`Targets — 24h ≥ ${TARGETS.rate24h}% · 48h ≥ ${TARGETS.rate48h}% · 72h ≥ ${TARGETS.rate72h}%`}
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
                  <th rowSpan={2} className="py-2 px-3 text-start font-semibold border border-border" colSpan={2}>Category</th>
                  <th rowSpan={2} className="py-2 px-2 text-center font-semibold border border-border">vs PY</th>
                  <th colSpan={4} className="py-2 px-2 text-center font-semibold border border-border">2024</th>
                  <th colSpan={4} className="py-2 px-2 text-center font-semibold border border-border">2025</th>
                  <th colSpan={3} className="py-2 px-2 text-center font-semibold border border-border bg-muted/70">Target</th>
                </tr>
                <tr className="bg-muted/30 text-muted-foreground">
                  {MONTH_COLS.map((c) => (
                    <th key={c.key} className={cn("py-1.5 px-2 text-center font-medium border border-border", c.kind === "ttl" && "bg-accent/40")}>
                      {c.label}
                    </th>
                  ))}
                  <th className="py-1.5 px-2 text-center font-medium border border-border">vs BP</th>
                  <th className="py-1.5 px-2 text-center font-medium border border-border">BP</th>
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
                    const ttl25 = r.value("25TTL");
                    const vsBP = r.bp != null && ttl25 != null && r.bp !== 0 ? (ttl25 / r.bp) * 100 : null;
                    return (
                      <tr key={idx} className="border border-border hover:bg-muted/20">
                        {showCat && (
                          <td rowSpan={catCounts.get(lastCat)} className="py-2 px-3 font-semibold text-foreground bg-muted/20 border border-border align-middle text-center">
                            {lastCat}
                          </td>
                        )}
                        <td className={cn("py-1.5 px-3 border border-border whitespace-nowrap", r.bold && "font-semibold", r.indent === 1 && "pl-6", r.indent === 2 && "pl-10 text-muted-foreground")}>
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
                          {vsBP != null ? <span className={cn("inline-block rounded px-1.5 py-0.5", vsBP >= 100 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>{vsBP.toFixed(0)}%</span> : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-center tabular-nums border border-border text-muted-foreground">
                          {r.bp != null ? r.bp : "—"}
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