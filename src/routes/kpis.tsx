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
  branch: "Affiliated Service Center",
  status: "Ticket Status",
  phase: "Processing Phase",
  hours: "Service hours(H)",
  timeliness: "Service Timeliness",
  serviceType: "Service Type",
  createdAt: "Order Creation Time",
  completedAt: "Completion time",
  completionResult: "Completion Result",
} as const;

const fmt = new Intl.NumberFormat("en-US");
const sar = new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

type Row = Record<string, string>;

function isCompleted(r: Row): boolean {
  const s = (r[COL.status] || "").toLowerCase();
  const p = (r[COL.phase] || "").toLowerCase();
  return (
    s.includes("completed") ||
    s.includes("finished") ||
    s.includes("closed") ||
    p.includes("completed") ||
    !!r[COL.completedAt]?.trim()
  );
}
function isPending(r: Row): boolean {
  if (isCompleted(r)) return false;
  const s = (r[COL.status] || "").toLowerCase();
  return (
    s.includes("pending") ||
    s.includes("not assigned") ||
    s.includes("assigned") ||
    s.includes("in progress") ||
    s.includes("processing") ||
    s.trim().length > 0
  );
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

  const kpiQuery = useQuery({ ...kpiQueryOptions, enabled: ready });

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

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter(isCompleted).length;
    const pending = rows.filter(isPending).length;
    const completedRows = rows.filter(isCompleted);
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
    const branches = new Set(rows.map((r) => r[COL.branch]).filter(Boolean)).size;
    return {
      total, completed, pending, rate24, rate48, rate72, avgHours, branches,
      pendingRate: pct(pending, total),
      completionRate: pct(completed, total),
      u24: under24,
      u48: under48,
      u72: under72,
      withHrs: withHrs.length,
    };
  }, [rows]);

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
    for (const r of rows) {
      const key = r[COL.branch] || "—";
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
  }, [rows, kpiQuery.data]);

  const scope = access
    ? access.isAllAccess
      ? "All service centres"
      : `${access.asc}${access.branch ? " · " + access.branch : ""}`
    : "—";

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
        ) : branchTable.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <BarChart3 className="h-8 w-8 opacity-40" />
            No tickets in your access scope yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                  <th className="py-2 pr-4 text-start">KPIs</th>
                  <th className="py-2 pr-4 text-end">Value</th>
                  <th className="py-2 pr-4 text-end">Target</th>
                  <th className="py-2 pr-4 text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totals = branchTable.reduce(
                    (a, b) => ({
                      u24: a.u24 + b.u24, u48: a.u48 + b.u48, u72: a.u72 + b.u72,
                      withHrs: a.withHrs + b.withHrs, hrsSum: a.hrsSum + b.hrsSum,
                      pending3d: a.pending3d + b.pending3d, pending7d: a.pending7d + b.pending7d,
                      wtyQty: a.wtyQty + b.wtyQty, wtyAmount: a.wtyAmount + b.wtyAmount,
                      csatSum: a.csatSum + (b.csat > 0 ? b.csat : 0),
                      csatN: a.csatN + (b.csat > 0 ? 1 : 0),
                    }),
                    { u24: 0, u48: 0, u72: 0, withHrs: 0, hrsSum: 0, pending3d: 0, pending7d: 0, wtyQty: 0, wtyAmount: 0, csatSum: 0, csatN: 0 },
                  );
                  const r24 = pct(totals.u24, totals.withHrs);
                  const r48 = pct(totals.u48, totals.withHrs);
                  const r72 = pct(totals.u72, totals.withHrs);
                  const rtat = totals.withHrs > 0 ? totals.hrsSum / totals.withHrs : 0;
                  const csatAvg = totals.csatN > 0 ? totals.csatSum / totals.csatN : 0;
                  const kpis: Array<{ label: string; value: string; target: string; ok: boolean | null; group?: string }> = [
                    { label: "24Hr Rate", value: totals.withHrs > 0 ? `${r24.toFixed(1)}%` : "—", target: `≥ ${TARGETS.rate24h}%`, ok: totals.withHrs > 0 ? r24 >= TARGETS.rate24h : null },
                    { label: "48Hr Rate", value: totals.withHrs > 0 ? `${r48.toFixed(1)}%` : "—", target: `≥ ${TARGETS.rate48h}%`, ok: totals.withHrs > 0 ? r48 >= TARGETS.rate48h : null },
                    { label: "72Hr Rate", value: totals.withHrs > 0 ? `${r72.toFixed(1)}%` : "—", target: `≥ ${TARGETS.rate72h}%`, ok: totals.withHrs > 0 ? r72 >= TARGETS.rate72h : null },
                    { label: "RTAT", value: totals.withHrs > 0 ? `${rtat.toFixed(1)}h` : "—", target: `≤ ${SLA_48}h`, ok: totals.withHrs > 0 ? rtat <= SLA_48 : null },
                    { label: "Pending Q'ty > 3 Day", value: fmt.format(totals.pending3d), target: "0", ok: totals.pending3d === 0, group: "Pending Order Q'ty (closed over)" },
                    { label: "Pending Q'ty > 7 Day", value: fmt.format(totals.pending7d), target: "0", ok: totals.pending7d === 0 },
                    { label: "CSAT", value: csatAvg > 0 ? csatAvg.toFixed(2) : "—", target: "≥ 4.5", ok: csatAvg > 0 ? csatAvg >= 4.5 : null },
                    { label: "W'ty Q'ty", value: fmt.format(totals.wtyQty), target: "—", ok: null, group: "Warranty" },
                    { label: "W'ty Amount", value: totals.wtyAmount > 0 ? sar.format(totals.wtyAmount) : "—", target: "—", ok: null },
                  ];
                  return kpis.map((k, i) => (
                    <tr key={k.label} className={cn("border-b border-border/60 last:border-0", k.group && i > 0 && "border-t-2 border-t-border/80")}>
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {k.group && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{k.group}</div>}
                        {k.label}
                      </td>
                      <td className="py-2.5 pr-4 text-end tabular-nums font-semibold">{k.value}</td>
                      <td className="py-2.5 pr-4 text-end text-xs text-muted-foreground tabular-nums">{k.target}</td>
                      <td className="py-2.5 pr-4 text-end">
                        {k.ok === null ? <span className="text-xs text-muted-foreground">—</span> : <Badge ok={k.ok}>{k.ok ? "On Target" : "Off Target"}</Badge>}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </DashboardLayout>
  );
}