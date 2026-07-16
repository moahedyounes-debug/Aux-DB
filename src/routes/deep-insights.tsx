import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  AlertTriangle,
  Wrench,
  Sparkles,
  UserX,
  Timer,
  MapPin,
  Package,
  Route as RouteIcon,
  HelpCircle,
  CalendarClock,
  Users,
  Lightbulb,
  Target,
  FileWarning,
  ClipboardList,
  Gauge,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  Cell as PieCell,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { readTable } from "@/lib/sheets-client";
import { useAccess, applyAccessFilter } from "@/hooks/use-access";
import { useGlobalFilters, applyGlobalFilters, shortBranch } from "@/hooks/use-global-filters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/deep-insights")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Deep Insights — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Closed tickets >48h — root cause analysis, delay drivers, branch performance, and strategic recommendations.",
      },
      { property: "og:title", content: "Deep Insights — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Why closures exceeded 48h — patterns, causes, and priorities.",
      },
    ],
  }),
  component: DeepInsightsPage,
});

const fmt = new Intl.NumberFormat("en-US");

// Maintenance sheet column headers
const M = {
  ticket: "Ticket Number",
  asc: "Service Provider Name",
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
  reason: "Reason For Rescheduling",
  remark: "Reasons Supplemented",
  notes: "Maintenance Instructions",
  mileage: "Mileage",
  serviceInfo: "Service Information",
} as const;

type Row = Record<string, string>;

function isCompletedRow(r: Row): boolean {
  const s = (r[M.status] || "").toLowerCase();
  const p = (r[M.phase] || "").toLowerCase();
  return (
    s.includes("completed") ||
    s.includes("finished") ||
    s.includes("closed") ||
    p.includes("completed") ||
    !!r[M.completedAt]?.trim()
  );
}
function isCancelled(r: Row): boolean {
  const s = (r[M.status] || "").toLowerCase();
  return /cancel|reject|return/.test(s);
}
function hrs(r: Row): number {
  const v = parseFloat(r[M.hours] || "");
  return Number.isFinite(v) ? v : NaN;
}
function mileage(r: Row): number {
  const v = parseFloat(String(r[M.mileage] || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(v) ? v : 0;
}
function branchFromServiceProvider(r: Row): string {
  return shortBranch(r[M.asc]) || "—";
}

// Completion type classification
function completionType(r: Row): "Troubleshooting" | "Value Added" | "Other" {
  const s = (r[M.completionResult] || "").toLowerCase();
  if (/trouble|fault|repair|إصلاح|تركيب|فحص/.test(s)) return "Troubleshooting";
  if (/value|added|freon|فريون|إضافي/.test(s)) return "Value Added";
  return "Other";
}

type Cause = "Distance" | "Parts" | "CustomerDelay" | "Dispatch" | "Unspecified";

function classifyCause(r: Row): Cause {
  if (mileage(r) > 60) return "Distance";
  const text = [
    r[M.reason],
    r[M.remark],
    r[M.notes],
    r[M.completionResult],
    r[M.serviceInfo],
  ]
    .join(" ")
    .toLowerCase();
  if (/part|freon|قطع|فريون|كمبروسر|compressor|refriger|spare|بيرد/.test(text))
    return "Parts";
  if (/customer|عميل|زبون|reschedul|postpone|تأجيل|موعد|no answer|not available|unavailable|absent|غياب/.test(text))
    return "CustomerDelay";
  if (/dispatch|routing|توجيه|assign|إسناد/.test(text)) return "Dispatch";
  return "Unspecified";
}

function DeepInsightsPage() {
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
    return applyGlobalFilters(
      scoped,
      { spn: M.asc, worker: M.worker, createdAt: M.createdAt },
      gFilters,
    );
  }, [maint.data, access, gFilters]);

  const analysis = useMemo(() => {
    const nonCancelled = rows.filter((r) => !isCancelled(r));
    const closed = nonCancelled.filter((r) => isCompletedRow(r) && Number.isFinite(hrs(r)));
    const totalClosed = closed.length;
    const over48 = closed.filter((r) => hrs(r) > 48);

    // Completion type
    const tsRows = over48.filter((r) => completionType(r) === "Troubleshooting");
    const vaRows = over48.filter((r) => completionType(r) === "Value Added");
    const otherRows = over48.filter((r) => completionType(r) === "Other");

    // Causes
    const causeMap: Record<Cause, Row[]> = {
      Distance: [],
      Parts: [],
      CustomerDelay: [],
      Dispatch: [],
      Unspecified: [],
    };
    for (const r of over48) causeMap[classifyCause(r)].push(r);
    const causeStats = (c: Cause) => {
      const arr = causeMap[c];
      const avg = arr.length ? arr.reduce((s, r) => s + hrs(r), 0) / arr.length : 0;
      const share = over48.length ? (arr.length / over48.length) * 100 : 0;
      return { count: arr.length, avg, share };
    };

    // Service hours buckets
    const buckets = [
      { label: "48h–72h", min: 48, max: 72 },
      { label: "72h–96h", min: 72, max: 96 },
      { label: "96h–120h", min: 96, max: 120 },
      { label: ">120h", min: 120, max: Infinity },
    ].map((b) => ({
      label: b.label,
      count: over48.filter((r) => hrs(r) > b.min && hrs(r) <= b.max).length,
    }));

    // Delay cause distribution
    const delayDist = [
      { cause: "Distance >60km", count: causeMap.Distance.length, color: "hsl(var(--destructive))" },
      { cause: "Parts / Freon", count: causeMap.Parts.length, color: "hsl(var(--accent-foreground))" },
      { cause: "Customer Delay", count: causeMap.CustomerDelay.length, color: "hsl(var(--warning))" },
      { cause: "Dispatch / Routing", count: causeMap.Dispatch.length, color: "hsl(var(--primary))" },
      { cause: "Unspecified", count: causeMap.Unspecified.length, color: "hsl(var(--muted-foreground))" },
    ];

    // Top branches (>48h)
    const branchMap = new Map<string, { branch: string; over48: number; total: number; totalHrs: number; parts: number; customer: number }>();
    for (const r of closed) {
      const b = branchFromServiceProvider(r);
      const e = branchMap.get(b) ?? { branch: b, over48: 0, total: 0, totalHrs: 0, parts: 0, customer: 0 };
      e.total++;
      if (hrs(r) > 48) {
        e.over48++;
        e.totalHrs += hrs(r);
        const c = classifyCause(r);
        if (c === "Parts") e.parts++;
        if (c === "CustomerDelay") e.customer++;
      }
      branchMap.set(b, e);
    }
    const branches = Array.from(branchMap.values())
      .filter((b) => b.over48 > 0)
      .map((b) => ({
        ...b,
        avgHrs: b.over48 ? b.totalHrs / b.over48 : 0,
        pctClosed: b.total ? (b.over48 / b.total) * 100 : 0,
      }));
    const topBranches = [...branches].sort((a, b) => b.over48 - a.over48).slice(0, 10);
    const perfBranches = [...branches].sort((a, b) => b.pctClosed - a.pctClosed);

    // Reschedule impact (over 48h)
    const withReschedule = over48.filter((r) => (r[M.reason] || "").trim().length > 0);
    const withoutReschedule = over48.filter((r) => !(r[M.reason] || "").trim());
    const avgWith = withReschedule.length
      ? withReschedule.reduce((s, r) => s + hrs(r), 0) / withReschedule.length
      : 0;
    const avgWithout = withoutReschedule.length
      ? withoutReschedule.reduce((s, r) => s + hrs(r), 0) / withoutReschedule.length
      : 0;
    const extraFromReschedule = avgWith - avgWithout;

    // Top workers >48h
    const workerMap = new Map<string, number>();
    for (const r of over48) {
      const w = (r[M.worker] || "").trim() || "—";
      workerMap.set(w, (workerMap.get(w) ?? 0) + 1);
    }
    const topWorkers = Array.from(workerMap.entries())
      .map(([worker, count]) => ({ worker, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Avg hours (>48h)
    const avg48 = over48.length ? over48.reduce((s, r) => s + hrs(r), 0) / over48.length : 0;

    // Over 60 KM table
    const over60km = closed
      .filter((r) => mileage(r) > 60)
      .sort((a, b) => String(b[M.createdAt] || "").localeCompare(String(a[M.createdAt] || "")))
      .slice(0, 50);

    // Technician notes sample
    const notesSample = over48
      .filter((r) => (r[M.notes] || "").trim().length > 5)
      .sort((a, b) => String(b[M.completedAt] || "").localeCompare(String(a[M.completedAt] || "")))
      .slice(0, 15);

    return {
      totalClosed,
      over48Count: over48.length,
      tsCount: tsRows.length,
      vaCount: vaRows.length,
      otherCount: otherRows.length,
      customerDelayCount: causeMap.CustomerDelay.length,
      avg48,
      cause: {
        distance: causeStats("Distance"),
        parts: causeStats("Parts"),
        customer: causeStats("CustomerDelay"),
        dispatch: causeStats("Dispatch"),
        unspecified: causeStats("Unspecified"),
      },
      buckets,
      delayDist,
      topBranches,
      perfBranches,
      withReschedule: withReschedule.length,
      withoutReschedule: withoutReschedule.length,
      avgWith,
      avgWithout,
      extraFromReschedule,
      topWorkers,
      over60km,
      notesSample,
      over48Rows: over48,
    };
  }, [rows]);

  const a = analysis;
  const targetRate = 85; // 48h target %
  const overallCompliance = a.totalClosed ? ((a.totalClosed - a.over48Count) / a.totalClosed) * 100 : 0;

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Deep Insights"
      subtitle="Closed Tickets Analysis >48h"
    >
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary via-primary to-primary/70 p-6 text-primary-foreground shadow-lg animate-rise">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative flex items-start gap-4">
          <div className="rounded-xl bg-white/15 p-3">
            <FileWarning className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold tracking-tight">
              Deep Insights — Closed Tickets Analysis (&gt;48h)
            </h2>
            <p className="text-sm text-primary-foreground/85 mt-1">
              {fmt.format(a.over48Count)} tickets closed after 48h out of {fmt.format(a.totalClosed)} total closed
              {" · "}
              <span className="font-semibold">
                {a.totalClosed ? ((a.over48Count / a.totalClosed) * 100).toFixed(1) : "0"}% exceeded 48h target
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Top KPIs */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <TopKpi color="destructive" label="Closed >48h" value={fmt.format(a.over48Count)} sub="Exceeded target" icon={AlertTriangle} />
        <TopKpi color="warning" label="Troubleshooting" value={fmt.format(a.tsCount)} sub="Device fault / parts" icon={Wrench} />
        <TopKpi color="primary" label="Value Added" value={fmt.format(a.vaCount)} sub="Extra service / freon" icon={Sparkles} />
        <TopKpi color="success" label="Customer Delay" value={fmt.format(a.customerDelayCount)} sub="Postponed / no answer" icon={UserX} />
        <TopKpi color="accent" label="Avg Service Hours" value={a.avg48.toFixed(1)} sub="For >48h tickets" icon={Timer} />
      </section>

      {/* ROOT CAUSE */}
      <section className="mt-6">
        <SectionHeader
          title="Root Cause Analysis — Why Did It Take >48h?"
          right={<span className="text-xs text-muted-foreground">{fmt.format(a.over48Count)} tickets</span>}
        />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <CauseCard tint="destructive" icon={MapPin} label="Distance >60km" count={a.cause.distance.count} share={a.cause.distance.share} avg={a.cause.distance.avg} />
          <CauseCard tint="accent" icon={Package} label="Parts / Freon" count={a.cause.parts.count} share={a.cause.parts.share} avg={a.cause.parts.avg} />
          <CauseCard tint="warning" icon={UserX} label="Customer Delay" count={a.cause.customer.count} share={a.cause.customer.share} avg={a.cause.customer.avg} />
          <CauseCard tint="primary" icon={RouteIcon} label="Dispatch / Routing" count={a.cause.dispatch.count} share={a.cause.dispatch.share} avg={a.cause.dispatch.avg} />
          <CauseCard tint="muted" icon={HelpCircle} label="Unspecified" count={a.cause.unspecified.count} share={a.cause.unspecified.share} avg={a.cause.unspecified.avg} />
        </div>
      </section>

      {/* Distribution + Completion */}
      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Service Hours Distribution (>48h tickets)"
          subtitle="How long beyond 48h did they take?"
          exportRows={a.buckets}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={a.buckets} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {a.buckets.map((_, i) => (
                  <Cell
                    key={i}
                    fill={
                      i === 0
                        ? "hsl(var(--warning))"
                        : i === 1
                        ? "hsl(var(--destructive))"
                        : i === 2
                        ? "hsl(var(--accent-foreground))"
                        : "hsl(var(--foreground))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Completion Type Breakdown"
          subtitle="Troubleshooting vs Value Added vs Other"
          exportRows={[
            { type: "Troubleshooting", count: a.tsCount },
            { type: "Value Added", count: a.vaCount },
            { type: "Other", count: a.otherCount },
          ]}
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: "Troubleshooting", value: a.tsCount },
                  { name: "Value Added", value: a.vaCount },
                  { name: "Other", value: a.otherCount },
                ]}
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                <PieCell fill="hsl(var(--primary))" />
                <PieCell fill="hsl(var(--warning))" />
                <PieCell fill="hsl(var(--muted-foreground))" />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Delay cause + top branches */}
      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard title="Delay Cause Distribution" exportRows={a.delayDist}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={a.delayDist} layout="vertical" margin={{ top: 5, right: 24, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="cause" width={130} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {a.delayDist.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Branches — Most >48h Tickets" exportRows={a.topBranches}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={a.topBranches} layout="vertical" margin={{ top: 5, right: 24, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="branch" width={140} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
              <Bar dataKey="over48" fill="hsl(var(--destructive))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Appointment & Rescheduling */}
      <section className="mt-8">
        <SectionHeader title="Appointment & Rescheduling Analysis" icon={CalendarClock} />
        <div className="grid gap-5 grid-cols-1 xl:grid-cols-3">
          <ChartCard
            title="Reschedule Impact on Closure Time"
            subtitle="Tickets rescheduled vs not — avg service hours"
            className="xl:col-span-2"
            exportRows={[
              { group: "Had reschedule reason", count: a.withReschedule, avgHrs: a.avgWith },
              { group: "No reschedule reason", count: a.withoutReschedule, avgHrs: a.avgWithout },
            ]}
          >
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
                <div className="text-4xl font-bold text-destructive tabular-nums">{fmt.format(a.withReschedule)}</div>
                <p className="mt-2 text-sm text-foreground/80">Had reschedule reason</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Avg: {a.avgWith.toFixed(1)}h</p>
              </div>
              <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center">
                <div className="text-4xl font-bold text-success tabular-nums">{fmt.format(a.withoutReschedule)}</div>
                <p className="mt-2 text-sm text-foreground/80">No reschedule reason</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Avg: {a.avgWithout.toFixed(1)}h</p>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {fmt.format(a.withReschedule)} tickets were delayed because customer postponed, didn't answer, or was unavailable.
              Average extra hours added by rescheduling: <span className="font-semibold text-foreground">{Math.abs(a.extraFromReschedule).toFixed(1)}h</span>
            </p>
          </ChartCard>

          <ChartCard title="Top Workers — Most >48h Closures" exportRows={a.topWorkers}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={a.topWorkers} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="worker" width={130} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
                <Bar dataKey="count" fill="hsl(var(--warning))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* Branch performance table */}
      <section className="mt-8">
        <SectionHeader
          title="Branch Performance — Tickets Closed >48h"
          icon={Gauge}
          right={<span className="text-xs text-primary font-medium">Strategic View</span>}
        />
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 text-start font-semibold">Branch</th>
                  <th className="py-3 px-4 text-end font-semibold">Total &gt;48h</th>
                  <th className="py-3 px-4 text-center font-semibold">% of Closed</th>
                  <th className="py-3 px-4 text-end font-semibold">Avg Hours</th>
                  <th className="py-3 px-4 text-end font-semibold">Parts Delay</th>
                  <th className="py-3 px-4 text-end font-semibold">Customer Delay</th>
                  <th className="py-3 px-4 text-center font-semibold">Action Priority</th>
                </tr>
              </thead>
              <tbody>
                {a.perfBranches.slice(0, 15).map((b) => {
                  const priority = b.pctClosed >= 45 ? "Critical" : b.pctClosed >= 30 ? "High" : "Medium";
                  const barColor =
                    b.pctClosed >= 45 ? "bg-destructive" : b.pctClosed >= 30 ? "bg-warning" : "bg-primary";
                  return (
                    <tr key={b.branch} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{b.branch}</td>
                      <td className="py-3 px-4 text-end tabular-nums">{fmt.format(b.over48)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[100px]">
                            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(100, b.pctClosed)}%` }} />
                          </div>
                          <span className="tabular-nums text-xs text-muted-foreground w-12 text-end">{b.pctClosed.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-end tabular-nums text-muted-foreground">{b.avgHrs.toFixed(1)}h</td>
                      <td className="py-3 px-4 text-end tabular-nums">{fmt.format(b.parts)}</td>
                      <td className="py-3 px-4 text-end tabular-nums">{fmt.format(b.customer)}</td>
                      <td className="py-3 px-4 text-center">
                        <PriorityBadge level={priority} />
                      </td>
                    </tr>
                  );
                })}
                {a.perfBranches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">
                      {maint.isLoading ? "Loading…" : "No branches with >48h tickets."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Over 60 KM */}
      <section className="mt-8">
        <SectionHeader
          title="Over 60 KM (Mileage)"
          icon={MapPin}
          right={<span className="text-xs text-muted-foreground">{fmt.format(a.over60km.length)} tickets</span>}
        />
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-muted/40 z-10">
                <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-start font-semibold">Ticket #</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Branch</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Worker</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Ticket Status</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Aging</th>
                  <th className="py-2.5 px-3 text-end font-semibold">Mileage</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Date</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Remark</th>
                </tr>
              </thead>
              <tbody>
                {a.over60km.map((r, i) => {
                  const h = hrs(r);
                  const aging = h <= 12 ? "≤ 12 Hours" : h <= 24 ? "≤ 24 Hours" : h <= 48 ? "≤ 48 Hours" : h <= 72 ? "≤ 72 Hours" : "> 72 Hours";
                  const agingClass = h <= 24 ? "bg-success/15 text-success" : h <= 48 ? "bg-primary/15 text-primary" : h <= 72 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
                  return (
                    <tr key={`${r[M.ticket]}-${i}`} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="py-2 px-3 font-mono">{r[M.ticket]}</td>
                      <td className="py-2 px-3">{branchFromServiceProvider(r)}</td>
                      <td className="py-2 px-3">{r[M.worker] || "—"}</td>
                      <td className="py-2 px-3 text-center">
                        <StatusPill status={r[M.status]} />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", agingClass)}>{aging}</span>
                      </td>
                      <td className="py-2 px-3 text-end tabular-nums font-semibold">{fmt.format(mileage(r))} KM</td>
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{r[M.createdAt]?.split(" ")[0] || "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground truncate max-w-[300px]">{(r[M.remark] || "—").slice(0, 80)}</td>
                    </tr>
                  );
                })}
                {a.over60km.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">No mileage &gt;60 KM tickets.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Technician notes */}
      <section className="mt-8">
        <SectionHeader
          title="Technician Notes — Maintenance Instructions Sample"
          icon={ClipboardList}
          right={<span className="text-xs text-primary font-medium">Latest {a.notesSample.length} tickets</span>}
        />
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-3 text-start font-semibold">Ticket #</th>
                  <th className="py-3 px-3 text-start font-semibold">Branch</th>
                  <th className="py-3 px-3 text-start font-semibold">Worker</th>
                  <th className="py-3 px-3 text-start font-semibold">Service Info (Problem)</th>
                  <th className="py-3 px-3 text-center font-semibold">Completion Type</th>
                  <th className="py-3 px-3 text-end font-semibold">Hours</th>
                  <th className="py-3 px-3 text-start font-semibold">Technician Notes</th>
                </tr>
              </thead>
              <tbody>
                {a.notesSample.map((r, i) => {
                  const type = completionType(r);
                  const typeClass =
                    type === "Troubleshooting"
                      ? "bg-warning/15 text-warning"
                      : type === "Value Added"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground";
                  return (
                    <tr key={`${r[M.ticket]}-${i}`} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="py-3 px-3 font-mono">{r[M.ticket]}</td>
                      <td className="py-3 px-3">{branchFromServiceProvider(r)}</td>
                      <td className="py-3 px-3">{r[M.worker] || "—"}</td>
                      <td className="py-3 px-3 max-w-[220px] truncate text-muted-foreground">{r[M.serviceInfo] || r[M.completionResult] || "—"}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", typeClass)}>{type}</span>
                      </td>
                      <td className="py-3 px-3 text-end tabular-nums font-semibold text-warning">{hrs(r).toFixed(1)}h</td>
                      <td className="py-3 px-3 text-muted-foreground max-w-[400px]">{r[M.notes]}</td>
                    </tr>
                  );
                })}
                {a.notesSample.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">No technician notes available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Strategic Recommendations */}
      <section className="mt-8">
        <SectionHeader title="Strategic Recommendations" icon={Lightbulb} right={<span className="text-xs text-primary font-medium">Data-Driven</span>} />
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Recommendation
            tint="warning"
            icon={AlertTriangle}
            title="48h Repair Rate"
            body={`Rate is ${overallCompliance.toFixed(1)}% — ${overallCompliance >= targetRate ? "meeting" : "below"} ${targetRate}% target. Focus on reducing dispatch-to-acceptance lag and customer scheduling delays.`}
            action='Review "Dispatched → Not Accepted" phase tickets and escalate same-day.'
          />
          <Recommendation
            tint="accent"
            icon={Package}
            title="Parts & Supply Chain Delay"
            body={`${fmt.format(a.cause.parts.count)} tickets (${a.cause.parts.share.toFixed(0)}%) required parts or freon. Avg closure: ${a.cause.parts.avg.toFixed(1)}h.`}
            action="Pre-stock common spare parts in high-demand branches. Track freon levels monthly."
          />
          {a.perfBranches[0] && (
            <Recommendation
              tint="destructive"
              icon={Target}
              title={`Critical Branch: ${a.perfBranches[0].branch}`}
              body={`${a.perfBranches[0].pctClosed.toFixed(1)}% of ${a.perfBranches[0].branch}'s closed tickets exceeded 48h. Avg time: ${a.perfBranches[0].avgHrs.toFixed(1)}h.`}
              action="Assign dedicated supervisor. Weekly performance review. Check technician workload distribution."
            />
          )}
          <Recommendation
            tint="success"
            icon={Wrench}
            title="Troubleshooting Pattern"
            body={`${fmt.format(a.tsCount)} troubleshooting tickets exceeded 48h. These indicate complex faults or part availability issues.`}
            action="Build a fault knowledge base from Maintenance Instructions. Train technicians on common diagnoses."
          />
          <Recommendation
            tint="destructive"
            icon={MapPin}
            title="Distance Delays (>60km)"
            body={`${fmt.format(a.cause.distance.count)} tickets affected by distance. Consider regional technician deployment.`}
            action="Map customer locations and assign nearest certified technician automatically."
          />
        </div>
      </section>
    </DashboardLayout>
  );
}

/* ----------------------------- sub components ----------------------------- */

type ToneKey = "destructive" | "warning" | "primary" | "success" | "accent" | "muted";

const STRIPE_BG: Record<ToneKey, string> = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
  accent: "bg-accent-foreground",
  muted: "bg-muted-foreground",
};

const CAUSE_TINT: Record<ToneKey, string> = {
  destructive: "bg-destructive/10 border-destructive/25",
  warning: "bg-warning/10 border-warning/25",
  primary: "bg-primary/10 border-primary/25",
  success: "bg-success/10 border-success/25",
  accent: "bg-accent/40 border-accent-foreground/20",
  muted: "bg-muted border-border",
};

const CAUSE_TEXT: Record<ToneKey, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  primary: "text-primary",
  success: "text-success",
  accent: "text-accent-foreground",
  muted: "text-muted-foreground",
};

function TopKpi({
  color,
  label,
  value,
  sub,
  icon: Icon,
}: {
  color: ToneKey;
  label: string;
  value: string;
  sub: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <div className="surface-card animate-rise relative overflow-hidden p-4 pt-5 flex flex-col items-center text-center gap-2">
      <div className={cn("absolute inset-x-0 top-0 h-1.5", STRIPE_BG[color])} aria-hidden />
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", CAUSE_TEXT[color])} />
        {label}
      </div>
      <div className="text-3xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function CauseCard({
  tint,
  icon: Icon,
  label,
  count,
  share,
  avg,
}: {
  tint: ToneKey;
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  share: number;
  avg: number;
}) {
  return (
    <div className={cn("rounded-xl border p-4 animate-rise", CAUSE_TINT[tint])}>
      <div className={cn("flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider", CAUSE_TEXT[tint])}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{fmt.format(count)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{share.toFixed(0)}% of &gt;48h tickets</div>
      <div className="mt-0.5 text-xs text-muted-foreground">Avg: {avg.toFixed(1)}h</div>
    </div>
  );
}

function SectionHeader({
  title,
  right,
  icon: Icon,
}: {
  title: string;
  right?: React.ReactNode;
  icon?: typeof AlertTriangle;
}) {
  return (
    <div className="mb-3 flex items-center justify-between border-l-4 border-primary pl-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function PriorityBadge({ level }: { level: "Critical" | "High" | "Medium" }) {
  const map: Record<string, string> = {
    Critical: "bg-destructive/15 text-destructive border-destructive/30",
    High: "bg-warning/15 text-warning border-warning/30",
    Medium: "bg-primary/15 text-primary border-primary/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", map[level])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", level === "Critical" ? "bg-destructive" : level === "High" ? "bg-warning" : "bg-primary")} />
      {level}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let cls = "bg-muted text-muted-foreground";
  if (/completed|closed|finished/.test(s)) cls = "bg-success/15 text-success";
  else if (/reject/.test(s)) cls = "bg-destructive/15 text-destructive";
  else if (/accept/.test(s)) cls = "bg-warning/15 text-warning";
  else if (/pending|processing/.test(s)) cls = "bg-primary/15 text-primary";
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>
      {status || "—"}
    </span>
  );
}

function Recommendation({
  tint,
  icon: Icon,
  title,
  body,
  action,
}: {
  tint: ToneKey;
  icon: typeof AlertTriangle;
  title: string;
  body: string;
  action: string;
}) {
  return (
    <div className={cn("rounded-xl border p-5 animate-rise", CAUSE_TINT[tint])}>
      <div className={cn("flex items-center gap-2 font-semibold", CAUSE_TEXT[tint])}>
        <Icon className="h-4 w-4" />
        <h3 className="text-sm">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-foreground/85 leading-relaxed">{body}</p>
      <p className={cn("mt-3 text-xs font-medium border-t pt-2", CAUSE_TEXT[tint])}>→ {action}</p>
    </div>
  );
}