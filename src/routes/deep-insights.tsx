import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Microscope, TrendingUp, TrendingDown, Zap } from "lucide-react";
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
import { TARGETS } from "@/lib/aux/mock-data";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/deep-insights")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions),
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

function DeepInsightsPage() {
  const { data } = useSuspenseQuery(kpiQueryOptions);
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
      subtitle="Patterns behind the numbers — weekday load, trends and branch efficiency"
    >
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