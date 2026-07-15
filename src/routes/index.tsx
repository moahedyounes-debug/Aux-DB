import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Ticket,
  Clock3,
  Timer,
  TimerReset,
  CheckCircle2,
  AlertTriangle,
  ClipboardX,
  UserX,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { TARGETS } from "@/lib/aux/mock-data";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions),
  head: () => ({
    meta: [
      { title: "KPI Overview — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Ticket totals, 48h/72h completion rates, pending analysis, and monthly trend charts for AUX ASC operations.",
      },
      { property: "og:title", content: "KPI Overview — AUX ASC Dashboard" },
      {
        property: "og:description",
        content:
          "Live KPI cards, monthly rate trends, rescheduled tickets and pending reason breakdown.",
      },
    ],
  }),
  component: Index,
});

type TimeMode = "percent" | "count";
type KpiFilter = "all" | "pending" | "completed" | "pendingNoReason" | "unassigned";

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function Index() {
  const { data } = useSuspenseQuery(kpiQueryOptions);
  const snap = data.snapshot;
  const MONTHLY = data.monthly;
  const PENDING_BY_REASON = data.pendingByReason;
  const pendingRate = snap.total > 0 ? (snap.pending / snap.total) * 100 : 0;
  const [mode, setMode] = useState<TimeMode>("percent");
  const [filter, setFilter] = useState<KpiFilter>("all");

  const rate48hOk = snap.rate48h >= TARGETS.rate48h;
  const rate72hOk = snap.rate72h >= TARGETS.rate72h;
  const pendingRateOk = pendingRate <= TARGETS.pendingRate;

  const toggle = (f: KpiFilter) => setFilter((cur) => (cur === f ? "all" : f));

  const showCompletionCharts = filter === "all" || filter === "completed";
  const showPendingCharts = filter === "all" || filter === "pending" || filter === "pendingNoReason";

  return (
    <DashboardLayout
      title="KPI Overview"
      subtitle="Live snapshot of AUX ASC ticket performance across all branches"
    >
      <section
        aria-label="Headline KPIs"
        className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-4"
      >
        <KpiCard
          label="Total Tickets"
          value={fmtInt(snap.total)}
          hint="All months, all branches"
          icon={Ticket}
          tone="primary"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <KpiCard
          label="Pending Rate"
          value={fmtPct(pendingRate)}
          hint={`Target ≤ ${TARGETS.pendingRate}%`}
          icon={AlertTriangle}
          tone={pendingRateOk ? "success" : "destructive"}
          active={filter === "pending"}
          onClick={() => toggle("pending")}
        />
        <KpiCard
          label="48h Completion"
          value={fmtPct(snap.rate48h)}
          hint={`Target ≥ ${TARGETS.rate48h}%`}
          icon={Timer}
          tone={rate48hOk ? "success" : "warning"}
        />
        <KpiCard
          label="72h Completion"
          value={fmtPct(snap.rate72h)}
          hint={`Target ≥ ${TARGETS.rate72h}%`}
          icon={TimerReset}
          tone={rate72hOk ? "success" : "warning"}
        />
        <KpiCard
          label="Completed"
          value={fmtInt(snap.completed)}
          hint="Closed tickets"
          icon={CheckCircle2}
          tone="success"
          active={filter === "completed"}
          onClick={() => toggle("completed")}
        />
        <KpiCard
          label="Pending"
          value={fmtInt(snap.pending)}
          hint="Open tickets"
          icon={Clock3}
          tone="warning"
          active={filter === "pending"}
          onClick={() => toggle("pending")}
        />
        <KpiCard
          label="Pending w/o Reason"
          value={fmtInt(snap.pendingNoReason)}
          hint="Missing reschedule reason"
          icon={ClipboardX}
          tone="destructive"
          active={filter === "pendingNoReason"}
          onClick={() => toggle("pendingNoReason")}
        />
        <KpiCard
          label="Unassigned"
          value={fmtInt(snap.unassigned)}
          hint="No worker assigned"
          icon={UserX}
          tone="destructive"
          active={filter === "unassigned"}
          onClick={() => toggle("unassigned")}
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        {showCompletionCharts && (
          <ChartCard
            title="Monthly 48h vs 72h Completion"
            subtitle="Rolling monthly performance versus SLA targets"
            exportRows={MONTHLY.map((m) => ({
              Month: m.label,
              "48h %": m.rate48h,
              "72h %": m.rate72h,
              "48h count": m.count48h,
              "72h count": m.count72h,
            }))}
            action={
              <div
                className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs font-medium"
                role="tablist"
                aria-label="Metric mode"
              >
                {(["percent", "count"] as TimeMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "px-2.5 py-1 rounded transition-colors",
                      mode === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "percent" ? "%" : "Count"}
                  </button>
                ))}
              </div>
            }
            footer={`Source: Google Sheets · ${data.rowCount.toLocaleString()} tickets · updated ${new Date(data.fetchedAt).toLocaleTimeString()}${data.error ? ` · error: ${data.error}` : ""}`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={MONTHLY} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickFormatter={(v) => (mode === "percent" ? `${v}%` : String(v))}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey={mode === "percent" ? "rate48h" : "count48h"}
                  name={mode === "percent" ? "48h %" : "48h count"}
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey={mode === "percent" ? "rate72h" : "count72h"}
                  name={mode === "percent" ? "72h %" : "72h count"}
                  stroke="var(--color-chart-3)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {showCompletionCharts && (
          <ChartCard
            title="Rescheduled Tickets by Month"
            subtitle="Volume of tickets moved to a later date"
            exportRows={MONTHLY.map((m) => ({ Month: m.label, Rescheduled: m.rescheduled }))}
            footer="Lower is better."
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={MONTHLY} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="rescheduled"
                  fill="var(--color-chart-2)"
                  radius={[6, 6, 0, 0]}
                  name="Rescheduled"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {showPendingCharts && PENDING_BY_REASON.length > 0 && (
          <ChartCard
            title="Pending by Reason"
            subtitle="Why open tickets are still open"
            className="xl:col-span-2"
            exportRows={PENDING_BY_REASON.map((r) => ({ Reason: r.reason, Count: r.count }))}
            footer={`Top reason accounts for ~${Math.round(
              (PENDING_BY_REASON[0].count /
                PENDING_BY_REASON.reduce((s, r) => s + r.count, 0)) *
                100,
            )}% of pending volume.`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={PENDING_BY_REASON}
                layout="vertical"
                margin={{ top: 10, right: 16, bottom: 0, left: 32 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  width={160}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-chart-1)"
                  radius={[0, 6, 6, 0]}
                  name="Pending count"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <section className="mt-6">
        <ChartCard
          title="Monthly Comparison"
          subtitle="Month-over-month totals, completion and rescheduled volume"
          exportRows={MONTHLY.map((m) => ({
            Month: m.label,
            Total: m.total,
            Completed: m.completed,
            Pending: m.pending,
            "48h %": m.rate48h,
            "72h %": m.rate72h,
            Rescheduled: m.rescheduled,
          }))}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Month</th>
                  <th className="py-2 pr-4 text-end">Total</th>
                  <th className="py-2 pr-4 text-end">Completed</th>
                  <th className="py-2 pr-4 text-end">Pending</th>
                  <th className="py-2 pr-4 text-end">48h %</th>
                  <th className="py-2 pr-4 text-end">72h %</th>
                  <th className="py-2 pr-4 text-end">Rescheduled</th>
                </tr>
              </thead>
              <tbody>
                {MONTHLY.map((m) => (
                  <tr key={m.month} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium text-foreground">{m.label}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{fmtInt(m.total)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-success">
                      {fmtInt(m.completed)}
                    </td>
                    <td className="py-2 pr-4 text-end tabular-nums text-warning">
                      {fmtInt(m.pending)}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4 text-end tabular-nums",
                        m.rate48h >= TARGETS.rate48h ? "text-success" : "text-destructive",
                      )}
                    >
                      {fmtPct(m.rate48h)}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4 text-end tabular-nums",
                        m.rate72h >= TARGETS.rate72h ? "text-success" : "text-destructive",
                      )}
                    >
                      {fmtPct(m.rate72h)}
                    </td>
                    <td className="py-2 pr-4 text-end tabular-nums">{fmtInt(m.rescheduled)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>
    </DashboardLayout>
  );
}
