import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { CalendarDays, Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/daily-operations")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions),
  head: () => ({
    meta: [
      { title: "Daily Operations — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Day-by-day operational load: incoming tickets, completions, backlog and reschedules over the last 30 days.",
      },
      { property: "og:title", content: "Daily Operations — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "30-day operational load view.",
      },
    ],
  }),
  component: DailyOpsPage,
});

const fmt = new Intl.NumberFormat("en-US");

function DailyOpsPage() {
  const { data } = useSuspenseQuery(kpiQueryOptions);
  const DAILY = data.daily;
  const totalIn = DAILY.reduce((s, d) => s + d.incoming, 0);
  const totalDone = DAILY.reduce((s, d) => s + d.completed, 0);
  const totalPending = DAILY.reduce((s, d) => s + d.pending, 0);
  const avgDaily = DAILY.length ? totalIn / DAILY.length : 0;
  const last7 = DAILY.slice(-7).reduce((s, d) => s + d.incoming, 0) / 7;
  const prev7 = DAILY.slice(-14, -7).reduce((s, d) => s + d.incoming, 0) / 7;
  const wowDelta = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;
  const trendUp = wowDelta >= 0;

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Daily Operations"
      subtitle="Last 30 days of ticket flow"
    >
      <section
        aria-label="Daily KPIs"
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard label="Incoming (30d)" value={fmt.format(totalIn)} icon={CalendarDays} tone="primary" />
        <KpiCard label="Completed (30d)" value={fmt.format(totalDone)} icon={Activity} tone="success" />
        <KpiCard label="Pending (30d)" value={fmt.format(totalPending)} icon={TrendingDown} tone="warning" />
        <KpiCard
          label="WoW Change"
          value={`${trendUp ? "+" : ""}${wowDelta.toFixed(1)}%`}
          hint={`Avg ${avgDaily.toFixed(0)} / day`}
          icon={trendUp ? TrendingUp : TrendingDown}
          tone={trendUp ? "success" : "destructive"}
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Incoming vs Completed"
          subtitle="30-day daily flow"
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={DAILY} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="incoming"
                name="Incoming"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke="var(--color-chart-5)"
                strokeWidth={2.5}
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Rescheduled per day"
          subtitle="Reschedule volume — lower is better"
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DAILY} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="rescheduled"
                name="Rescheduled"
                fill="var(--color-chart-3)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}