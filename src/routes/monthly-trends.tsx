import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { MONTHLY } from "@/lib/aux/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/monthly-trends")({
  head: () => ({
    meta: [
      { title: "Monthly Trends — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Multi-metric monthly trends: volume, completion, pending backlog and rescheduled tickets.",
      },
      { property: "og:title", content: "Monthly Trends — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Volume and completion trends over time.",
      },
    ],
  }),
  component: MonthlyTrendsPage,
});

const METRICS = [
  { key: "total", label: "Total", color: "var(--color-chart-1)" },
  { key: "completed", label: "Completed", color: "var(--color-chart-5)" },
  { key: "pending", label: "Pending", color: "var(--color-chart-2)" },
  { key: "rescheduled", label: "Rescheduled", color: "var(--color-chart-3)" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

function MonthlyTrendsPage() {
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>({
    total: true,
    completed: true,
    pending: true,
    rescheduled: false,
  });

  const toggle = (k: MetricKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Monthly Trends"
      subtitle="Compare volume and completion metrics across months"
    >
      <div className="grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Multi-metric Trend"
          subtitle="Toggle series to focus"
          action={
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => toggle(m.key)}
                  className={cn(
                    "text-xs font-medium rounded-md px-2 py-1 border transition-colors",
                    visible[m.key]
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          }
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={MONTHLY} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {visible.total && (
                <Bar dataKey="total" name="Total" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              )}
              {visible.completed && (
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="var(--color-chart-5)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              )}
              {visible.pending && (
                <Line
                  type="monotone"
                  dataKey="pending"
                  name="Pending"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              )}
              {visible.rescheduled && (
                <Line
                  type="monotone"
                  dataKey="rescheduled"
                  name="Rescheduled"
                  stroke="var(--color-chart-3)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Completion Rate %" subtitle="48h and 72h completion over time">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={MONTHLY} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="g48" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g72" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="rate48h"
                name="48h %"
                stroke="var(--color-chart-1)"
                fill="url(#g48)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="rate72h"
                name="72h %"
                stroke="var(--color-chart-3)"
                fill="url(#g72)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pending Backlog" subtitle="Month-end open tickets">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={MONTHLY} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pending" fill="var(--color-chart-2)" name="Pending" radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}