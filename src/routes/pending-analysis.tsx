import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { AlarmClock, TimerReset, Building2, ClipboardX } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useKpiData } from "@/hooks/use-kpi-data";

export const Route = createFileRoute("/pending-analysis")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Pending Analysis — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Drill down pending tickets by reason, branch and aging buckets to identify bottlenecks.",
      },
      { property: "og:title", content: "Pending Analysis — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Pending tickets by reason, branch and age.",
      },
    ],
  }),
  component: PendingAnalysisPage,
});

const fmt = new Intl.NumberFormat("en-US");
const AGING_COLORS = [
  "var(--color-chart-5)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-warning)",
  "var(--color-chart-2)",
  "var(--color-destructive)",
];

function PendingAnalysisPage() {
  const { data } = useKpiData();
  const snap = data.snapshot;
  const PENDING_AGING = data.pendingAging;
  const PENDING_BY_BRANCH = data.pendingByBranch;
  const PENDING_BY_REASON = data.pendingByReason;
  const oldest = PENDING_AGING.slice(-2).reduce((s, b) => s + b.count, 0);
  const worstBranch = PENDING_BY_BRANCH[0] ?? { branch: "—", count: 0 };
  const topReason = PENDING_BY_REASON[0] ?? { reason: "—", count: 0 };

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Pending Analysis"
      subtitle="Where is the backlog and why"
    >
      <section
        aria-label="Pending highlights"
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="Total Pending"
          value={fmt.format(snap.pending)}
          icon={AlarmClock}
          tone="warning"
        />
        <KpiCard
          label="Aged 7d+"
          value={fmt.format(oldest)}
          hint="Highest risk backlog"
          icon={TimerReset}
          tone="destructive"
        />
        <KpiCard
          label="Worst Branch"
          value={fmt.format(worstBranch.count)}
          hint={worstBranch.branch}
          icon={Building2}
          tone="destructive"
        />
        <KpiCard
          label="Top Reason"
          value={fmt.format(topReason.count)}
          hint={topReason.reason}
          icon={ClipboardX}
          tone="primary"
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard title="Aging Buckets" subtitle="How long tickets have been pending">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={PENDING_AGING} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="bucket" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {PENDING_AGING.map((_, i) => (
                  <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pending by Branch" subtitle="Backlog volume per ASC">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={PENDING_BY_BRANCH}
              layout="vertical"
              margin={{ top: 10, right: 16, bottom: 0, left: 32 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis
                type="category"
                dataKey="branch"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                width={130}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Pending by Reason"
          subtitle="Root causes of open tickets"
          className="xl:col-span-2"
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
                width={170}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}