import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Microscope, TrendingUp, TrendingDown, Zap, AlertTriangle, Clock, Timer, Search } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TARGETS } from "@/lib/aux/mock-data";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useKpiData } from "@/hooks/use-kpi-data";
import { readTable } from "@/lib/sheets-client";
import { useAccess, applyAccessFilter } from "@/hooks/use-access";
import { useGlobalFilters, applyGlobalFilters } from "@/hooks/use-global-filters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/deep-insights")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Deep Insights — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Advanced diagnostics: weekday load pattern, month-over-month movement, branch efficiency vs backlog, and top pending reasons.",
      },
      { property: "og:title", content: "Deep Insights — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Patterns behind the numbers — weekday load, trends and branch efficiency.",
      },
    ],
  }),
  component: DeepInsightsPage,
});

const fmt = new Intl.NumberFormat("en-US");

// Maintenance sheet columns
const M = {
  ticket: "Ticket Number",
  asc: "Service Provider Name",
  branch: "Affiliated Service Center",
  status: "Ticket Status",
  phase: "Processing Phase",
  hours: "Service hours(H)",
  createdAt: "Order Creation Time",
  completedAt: "Completion time",
  worker: "Worker Name",
  product: "Product Line",
  productType: "Product Type",
  serviceType: "Service Type",
  user: "User Name",
  city: "Location",
  completionResult: "Completion Result",
} as const;

type Row = Record<string, string>;

function isCompletedRow(r: Row): boolean {
  const s = (r[M.status] || "").toLowerCase();
  const p = (r[M.phase] || "").toLowerCase();
  return s.includes("completed") || s.includes("finished") || s.includes("closed") || p.includes("completed") || !!r[M.completedAt]?.trim();
}
function hrs(r: Row): number {
  const v = parseFloat(r[M.hours] || "");
  return Number.isFinite(v) ? v : NaN;
}

function branchFromServiceProvider(r: Row): string {
  return (r[M.asc] || "").trim() || "—";
}

function DeepInsightsPage() {
  const { data } = useKpiData();
  const { access, ready } = useAccess();
  const { filters: gFilters } = useGlobalFilters();
  const maint = useQuery({
    queryKey: ["maintenance", "Sheet1"],
    queryFn: () => readTable("maintenance", "Sheet1!A1:AE"),
    staleTime: 60_000,
    enabled: ready,
  });

  const rows: Row[] = useMemo(() => {
    if (!maint.data) return [];
    const scoped = applyAccessFilter(maint.data.rows, access, { asc: M.asc, branch: M.asc });
    return applyGlobalFilters(scoped, {
      spn: M.asc, worker: M.worker, createdAt: M.createdAt,
    }, gFilters);
  }, [maint.data, access, gFilters]);

  // Filters
  const [q, setQ] = useState("");
  const [fBranch, setFBranch] = useState("all");
  const [fWorker, setFWorker] = useState("");
  const [fBucket, setFBucket] = useState<"gt48" | "gt72" | "gt7d" | "all">("gt48");
  const [sortBy, setSortBy] = useState<"hours" | "created">("hours");

  const branchOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const branch = branchFromServiceProvider(r);
      if (branch !== "—") s.add(branch);
    }
    return Array.from(s).sort();
  }, [rows]);

  // Completed rows with hours known → subset of interest
  const completed = useMemo(() => rows.filter((r) => isCompletedRow(r) && Number.isFinite(hrs(r))), [rows]);

  const over48 = useMemo(() => completed.filter((r) => hrs(r) > 48), [completed]);
  const over72 = useMemo(() => completed.filter((r) => hrs(r) > 72), [completed]);
  const over7d = useMemo(() => completed.filter((r) => hrs(r) > 24 * 7), [completed]);

  const focusRows = useMemo(() => {
    let base = completed;
    if (fBucket === "gt48") base = over48;
    else if (fBucket === "gt72") base = over72;
    else if (fBucket === "gt7d") base = over7d;
    const qq = q.trim().toLowerCase();
    const w = fWorker.trim().toLowerCase();
    const out = base.filter((r) => {
      const branch = branchFromServiceProvider(r);
      if (fBranch !== "all" && branch !== fBranch) return false;
      if (w && !(r[M.worker] || "").toLowerCase().includes(w)) return false;
      if (qq) {
        const hay = `${r[M.ticket]} ${r[M.user]} ${r[M.product]} ${r[M.productType]} ${branch} ${r[M.worker]}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      if (sortBy === "hours") return hrs(b) - hrs(a);
      return String(b[M.createdAt] || "").localeCompare(String(a[M.createdAt] || ""));
    });
    return out;
  }, [completed, over48, over72, over7d, fBucket, q, fBranch, fWorker, sortBy]);

  // Aggregations for the over-48h focus
  const avg48 = over48.length > 0 ? over48.reduce((s, r) => s + hrs(r), 0) / over48.length : 0;
  const worst = over48.reduce((max, r) => (hrs(r) > max ? hrs(r) : max), 0);

  const byBranch48 = useMemo(() => {
    const map = new Map<string, { branch: string; count: number; totalHrs: number; completed: number }>();
    for (const r of completed) {
      const key = branchFromServiceProvider(r);
      const e = map.get(key) ?? { branch: key, count: 0, totalHrs: 0, completed: 0 };
      e.completed++;
      if (hrs(r) > 48) { e.count++; e.totalHrs += hrs(r); }
      map.set(key, e);
    }
    return Array.from(map.values())
      .map((b) => ({ ...b, avgHrs: b.count > 0 ? b.totalHrs / b.count : 0, share: b.completed > 0 ? (b.count / b.completed) * 100 : 0 }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [completed]);

  const byWorker48 = useMemo(() => {
    const map = new Map<string, { worker: string; count: number; totalHrs: number }>();
    for (const r of over48) {
      const key = r[M.worker] || "—";
      const e = map.get(key) ?? { worker: key, count: 0, totalHrs: 0 };
      e.count++; e.totalHrs += hrs(r);
      map.set(key, e);
    }
    return Array.from(map.values())
      .map((w) => ({ ...w, avgHrs: w.totalHrs / w.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [over48]);

  const daily = data.daily;
  const monthly = data.monthly;
  const branches = data.branches;

  // Weekday load pattern from last 30 days
  const weekdayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const wdMap = new Map<string, { weekday: string; incoming: number; completed: number; days: number }>();
  for (const d of daily) {
    let w = wdMap.get(d.weekday);
    if (!w) {
      w = { weekday: d.weekday, incoming: 0, completed: 0, days: 0 };
      wdMap.set(d.weekday, w);
    }
    w.incoming += d.incoming;
    w.completed += d.completed;
    w.days += 1;
  }
  const weekday = weekdayOrder.map((k) => {
    const w = wdMap.get(k);
    return {
      weekday: k,
      incoming: w ? Math.round((w.incoming / Math.max(1, w.days)) * 10) / 10 : 0,
      completed: w ? Math.round((w.completed / Math.max(1, w.days)) * 10) / 10 : 0,
    };
  });
  const peakDay = [...weekday].sort((a, b) => b.incoming - a.incoming)[0];
  const quietDay = [...weekday].sort((a, b) => a.incoming - b.incoming)[0];

  // MoM movement (last vs previous month)
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const momTotal = last && prev && prev.total ? ((last.total - prev.total) / prev.total) * 100 : 0;
  const mom48 = last && prev ? last.rate48h - prev.rate48h : 0;

  // Branch efficiency scatter: pending rate vs 48h rate
  const scatter = branches
    .filter((b) => b.total >= 3)
    .map((b) => ({
      branch: b.branch,
      pendingRate: b.total > 0 ? Math.round((b.pending / b.total) * 1000) / 10 : 0,
      rate48h: b.rate48h,
      total: b.total,
    }));

  // Quadrant classification
  const stars = scatter.filter((b) => b.rate48h >= TARGETS.rate48h && b.pendingRate <= TARGETS.pendingRate);
  const critical = scatter.filter((b) => b.rate48h < TARGETS.rate48h && b.pendingRate > TARGETS.pendingRate);

  // Top pending reasons
  const reasons = data.pending.reasons.slice(0, 8);

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Deep Insights"
      subtitle="All filed orders — focused on tickets that took over 48 hours"
    >
      {/* Over-48h focus */}
      <section aria-label="Over 48h Focus" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Filed Orders"
          value={maint.isLoading ? "…" : fmt.format(completed.length)}
          hint="Completed tickets with recorded hours"
          icon={Microscope}
          tone="primary"
        />
        <KpiCard
          label="> 48 Hours"
          value={maint.isLoading ? "…" : fmt.format(over48.length)}
          hint={completed.length > 0 ? `${((over48.length / completed.length) * 100).toFixed(1)}% of filed` : ""}
          icon={AlertTriangle}
          tone="destructive"
        />
        <KpiCard
          label="> 72 Hours"
          value={maint.isLoading ? "…" : fmt.format(over72.length)}
          hint={completed.length > 0 ? `${((over72.length / completed.length) * 100).toFixed(1)}% of filed` : ""}
          icon={Clock}
          tone="warning"
        />
        <KpiCard
          label="Avg / Worst (>48h)"
          value={maint.isLoading ? "…" : `${avg48.toFixed(1)}h / ${worst.toFixed(0)}h`}
          hint="Average and worst repair hours in >48h bucket"
          icon={Timer}
          tone="accent"
        />
      </section>

      <ChartCard
        title="Filed Orders — Over 48h Deep-Dive"
        subtitle={`${fmt.format(focusRows.length)} tickets in view`}
        exportRows={focusRows.map((r) => ({
          Ticket: r[M.ticket], Branch: branchFromServiceProvider(r), Worker: r[M.worker],
          Product: r[M.product], "Product Type": r[M.productType],
          Customer: r[M.user], City: r[M.city],
          "Service Type": r[M.serviceType],
          "Hours": hrs(r), "Days": (hrs(r) / 24).toFixed(1),
          Created: r[M.createdAt], Completed: r[M.completedAt],
          Status: r[M.status], Result: r[M.completionResult],
        }))}
      >
        <div className="grid gap-3 md:grid-cols-5 grid-cols-2 mb-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Bucket</Label>
            <Select value={fBucket} onValueChange={(v) => setFBucket(v as typeof fBucket)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gt48">Over 48h</SelectItem>
                <SelectItem value="gt72">Over 72h</SelectItem>
                <SelectItem value="gt7d">Over 7 days</SelectItem>
                <SelectItem value="all">All filed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Branch</Label>
            <Select value={fBranch} onValueChange={setFBranch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branchOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Technician</Label>
            <Input placeholder="Name…" value={fWorker} onChange={(e) => setFWorker(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 md:col-span-1 col-span-2">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7" placeholder="Ticket, customer, product…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sort by</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours (worst first)</SelectItem>
                <SelectItem value="created">Created (newest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[560px]">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-muted-foreground border-b border-border">
                <th className="py-2 px-2 text-start">Ticket</th>
                <th className="py-2 px-2 text-start">Branch</th>
                <th className="py-2 px-2 text-start">Technician</th>
                <th className="py-2 px-2 text-start">Customer</th>
                <th className="py-2 px-2 text-start">Product</th>
                <th className="py-2 px-2 text-end">Hours</th>
                <th className="py-2 px-2 text-end">Days</th>
                <th className="py-2 px-2 text-start">Created</th>
                <th className="py-2 px-2 text-start">Completed</th>
              </tr>
            </thead>
            <tbody>
              {maint.isLoading ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : focusRows.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No tickets match the current filters.</td></tr>
              ) : (
                focusRows.slice(0, 500).map((r, i) => {
                  const h = hrs(r);
                  return (
                    <tr key={`${r[M.ticket]}-${i}`} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="py-1.5 px-2 font-medium tabular-nums">{r[M.ticket]}</td>
                      <td className="py-1.5 px-2">{branchFromServiceProvider(r)}</td>
                      <td className="py-1.5 px-2">{r[M.worker] || "—"}</td>
                      <td className="py-1.5 px-2 truncate max-w-[160px]">{r[M.user] || "—"}</td>
                      <td className="py-1.5 px-2 truncate max-w-[160px]">{r[M.product]} <span className="text-muted-foreground">{r[M.productType]}</span></td>
                      <td className={cn("py-1.5 px-2 text-end tabular-nums font-semibold", h > 72 ? "text-destructive" : h > 48 ? "text-warning" : "text-foreground")}>{h.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-end tabular-nums text-muted-foreground">{(h / 24).toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{r[M.createdAt]}</td>
                      <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{r[M.completedAt]}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {focusRows.length > 500 && (
            <div className="py-2 text-center text-xs text-muted-foreground">Showing first 500 of {fmt.format(focusRows.length)} — export CSV for the full list.</div>
          )}
        </div>
      </ChartCard>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard title="Over-48h by Branch" subtitle="Which branches contribute most to slow tickets" exportRows={byBranch48}>
          {byBranch48.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No over-48h tickets.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Branch</th>
                  <th className="py-2 pr-4 text-end">&gt;48h</th>
                  <th className="py-2 pr-4 text-end">Share</th>
                  <th className="py-2 pr-4 text-end">Avg h</th>
                </tr>
              </thead>
              <tbody>
                {byBranch48.map((b) => (
                  <tr key={b.branch} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium">{b.branch}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-destructive font-semibold">{fmt.format(b.count)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{b.share.toFixed(1)}%</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-muted-foreground">{b.avgHrs.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>

        <ChartCard title="Over-48h by Technician" subtitle="Top workers with tickets exceeding 48h" exportRows={byWorker48}>
          {byWorker48.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No over-48h tickets.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Technician</th>
                  <th className="py-2 pr-4 text-end">&gt;48h</th>
                  <th className="py-2 pr-4 text-end">Avg h</th>
                </tr>
              </thead>
              <tbody>
                {byWorker48.map((w) => (
                  <tr key={w.worker} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium">{w.worker}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-destructive font-semibold">{fmt.format(w.count)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-muted-foreground">{w.avgHrs.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>
      </div>

      <section aria-label="Insight KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Peak Day"
          value={peakDay?.weekday ?? "—"}
          hint={peakDay ? `avg ${peakDay.incoming} tickets/day` : ""}
          icon={Zap}
          tone="primary"
        />
        <KpiCard
          label="Quiet Day"
          value={quietDay?.weekday ?? "—"}
          hint={quietDay ? `avg ${quietDay.incoming} tickets/day` : ""}
          icon={Microscope}
          tone="primary"
        />
        <KpiCard
          label="MoM Volume"
          value={`${momTotal >= 0 ? "+" : ""}${momTotal.toFixed(1)}%`}
          hint={last && prev ? `${prev.label} → ${last.label}` : "Not enough data"}
          icon={momTotal >= 0 ? TrendingUp : TrendingDown}
          tone={momTotal >= 0 ? "success" : "destructive"}
        />
        <KpiCard
          label="MoM 48h SLA"
          value={`${mom48 >= 0 ? "+" : ""}${mom48.toFixed(1)} pts`}
          hint="Compliance movement"
          icon={mom48 >= 0 ? TrendingUp : TrendingDown}
          tone={mom48 >= 0 ? "success" : "destructive"}
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Weekday Load Pattern"
          subtitle="Average incoming vs completed per weekday (last 30 days)"
          exportRows={weekday}
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={weekday} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="weekday" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="incoming" name="Incoming" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              <Line
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke="var(--color-success)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Branch Efficiency Map"
          subtitle="48h rate vs pending rate — top-right = healthy"
          exportRows={scatter}
        >
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                dataKey="pendingRate"
                name="Pending %"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                unit="%"
                domain={[0, "dataMax"]}
              />
              <YAxis
                type="number"
                dataKey="rate48h"
                name="48h %"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                unit="%"
                domain={[0, 100]}
              />
              <ZAxis type="number" dataKey="total" range={[40, 400]} name="Volume" />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: number | string, key: string) =>
                  key === "Volume" ? [value, "Tickets"] : [`${value}%`, key]
                }
                labelFormatter={() => ""}
              />
              <Scatter data={scatter} fill="var(--color-primary)" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-success mr-1.5" />
              Stars: {stars.length}
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-destructive mr-1.5" />
              Critical: {critical.length}
            </span>
            <span>Bubble size = ticket volume</span>
          </div>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Monthly Trend — Volume & SLA"
          subtitle="Total tickets and 48h compliance"
          exportRows={monthly.map((m) => ({
            Month: m.label,
            Total: m.total,
            Completed: m.completed,
            Pending: m.pending,
            "48h %": m.rate48h,
            "72h %": m.rate72h,
          }))}
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis
                yAxisId="left"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                unit="%"
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="total" name="Total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="rate48h"
                name="48h %"
                stroke="var(--color-success)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top Pending Reasons"
          subtitle="What's blocking tickets"
          exportRows={reasons}
        >
          {reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No pending reasons recorded.</p>
          ) : (
            <ul className="space-y-2">
              {reasons.map((r, i) => {
                const max = reasons[0]?.count || 1;
                const pct = (r.count / max) * 100;
                return (
                  <li key={r.reason} className="text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="truncate pr-3 text-foreground">
                        <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                        {r.reason}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{fmt.format(r.count)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          i === 0 ? "bg-destructive" : i < 3 ? "bg-warning" : "bg-primary",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>
      </div>

      {critical.length > 0 && (
        <section className="mt-6">
          <ChartCard
            title="Branches Needing Attention"
            subtitle="Below 48h target AND above pending threshold"
            exportRows={critical}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 text-start">Branch</th>
                    <th className="py-2 pr-4 text-end">48h</th>
                    <th className="py-2 pr-4 text-end">Pending %</th>
                    <th className="py-2 pr-4 text-end">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {critical
                    .sort((a, b) => b.pendingRate - a.pendingRate)
                    .map((b) => (
                      <tr key={b.branch} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{b.branch}</td>
                        <td className="py-2.5 pr-4 text-end tabular-nums text-destructive">
                          {b.rate48h}%
                        </td>
                        <td className="py-2.5 pr-4 text-end tabular-nums text-destructive">
                          {b.pendingRate}%
                        </td>
                        <td className="py-2.5 pr-4 text-end tabular-nums text-muted-foreground">
                          {fmt.format(b.total)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </section>
      )}
    </DashboardLayout>
  );
}