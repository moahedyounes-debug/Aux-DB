import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Building2, Trophy, AlertTriangle, Timer } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TARGETS } from "@/lib/aux/mock-data";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/asc-performance")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "ASC Performance — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Authorized service centers ranked by 48h and 72h completion rates, pending backlog, and workload — with SLA reference lines.",
      },
      { property: "og:title", content: "ASC Performance — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Ranking, backlog and SLA compliance for every service center.",
      },
    ],
  }),
  component: AscPerformancePage,
});

const fmt = new Intl.NumberFormat("en-US");

function Badge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "destructive" | "muted";
  children: React.ReactNode;
}) {
  const map = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        map[tone],
      )}
    >
      {children}
    </span>
  );
}

function AscPerformancePage() {
  const { data } = useSuspenseQuery(kpiQueryOptions());
  const branches = data.branches;

  const ranked = [...branches].sort((a, b) => b.rate48h - a.rate48h);
  const top = ranked[0];
  const worst = [...branches]
    .filter((b) => b.total >= 3)
    .sort((a, b) => a.rate48h - b.rate48h)[0];
  const backlog = [...branches].sort((a, b) => b.pending - a.pending)[0];

  const totalPending = branches.reduce((sum, b) => sum + b.pending, 0);
  const belowTarget = branches.filter((b) => b.rate48h < TARGETS.rate48h).length;

  const chart48 = ranked.slice(0, 15).map((b) => ({
    branch: b.branch,
    rate: b.rate48h,
  }));

  const backlogChart = [...branches]
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 15)
    .map((b) => ({ branch: b.branch, pending: b.pending, total: b.total }));

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="ASC Performance"
      subtitle="Service center ranking, SLA compliance and workload"
    >
      <section aria-label="ASC KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Service Centers"
          value={fmt.format(branches.length)}
          hint="Active branches"
          icon={Building2}
          tone="primary"
        />
        <KpiCard
          label="Top Performer"
          value={top?.branch ?? "—"}
          hint={top ? `${top.rate48h}% at 48h` : ""}
          icon={Trophy}
          tone="success"
        />
        <KpiCard
          label="Below 48h Target"
          value={`${fmt.format(belowTarget)} / ${fmt.format(branches.length)}`}
          hint={`Target ≥ ${TARGETS.rate48h}%`}
          icon={AlertTriangle}
          tone="warning"
        />
        <KpiCard
          label="Total Pending"
          value={fmt.format(totalPending)}
          hint={backlog ? `Top: ${backlog.branch} (${backlog.pending})` : ""}
          icon={Timer}
          tone="destructive"
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="48h Completion Rate — Top 15"
          subtitle={`Target ≥ ${TARGETS.rate48h}%`}
          exportRows={ranked.map((b) => ({
            Branch: b.branch,
            Total: b.total,
            Completed: b.completed,
            Pending: b.pending,
            "48h %": b.rate48h,
            "72h %": b.rate72h,
            CSAT: b.csat,
          }))}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={chart48}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 0, left: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                stroke="var(--color-muted-foreground)"
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="branch"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                width={170}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <ReferenceLine
                x={TARGETS.rate48h}
                stroke="var(--color-destructive)"
                strokeDasharray="4 4"
                label={{
                  value: `Target ${TARGETS.rate48h}%`,
                  position: "top",
                  fill: "var(--color-destructive)",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                {chart48.map((d) => (
                  <Cell
                    key={d.branch}
                    fill={
                      d.rate >= TARGETS.rate48h
                        ? "var(--color-success)"
                        : "var(--color-destructive)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Pending Backlog — Top 15"
          subtitle="Open tickets per branch"
          exportRows={backlogChart}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={backlogChart}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 0, left: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis
                type="category"
                dataKey="branch"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                width={170}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pending" fill="var(--color-chart-4)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="mt-6">
        <ChartCard
          title="ASC Ranking"
          subtitle={`${branches.length} branches — sorted by 48h compliance`}
          exportRows={ranked.map((b, i) => ({
            Rank: i + 1,
            Branch: b.branch,
            Total: b.total,
            Completed: b.completed,
            Pending: b.pending,
            "48h %": b.rate48h,
            "72h %": b.rate72h,
            CSAT: b.csat,
          }))}
        >
          {ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No branch data.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 text-start w-10">#</th>
                    <th className="py-2 pr-4 text-start">Branch</th>
                    <th className="py-2 pr-4 text-end">Total</th>
                    <th className="py-2 pr-4 text-end">Completed</th>
                    <th className="py-2 pr-4 text-end">Pending</th>
                    <th className="py-2 pr-4 text-end">48h</th>
                    <th className="py-2 pr-4 text-end">72h</th>
                    <th className="py-2 pr-4 text-end">CSAT</th>
                    <th className="py-2 pr-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((b, i) => {
                    const pRate = b.total > 0 ? (b.pending / b.total) * 100 : 0;
                    const okAll =
                      b.rate48h >= TARGETS.rate48h &&
                      b.rate72h >= TARGETS.rate72h &&
                      pRate <= TARGETS.pendingRate;
                    const badAny =
                      b.rate48h < TARGETS.rate48h * 0.8 ||
                      pRate > TARGETS.pendingRate * 1.5;
                    const tone: "success" | "warning" | "destructive" = okAll
                      ? "success"
                      : badAny
                        ? "destructive"
                        : "warning";
                    const label = okAll ? "On track" : badAny ? "Critical" : "Watch";
                    return (
                      <tr
                        key={b.branch}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-foreground">
                          {b.branch}
                        </td>
                        <td className="py-2.5 pr-4 text-end tabular-nums">
                          {fmt.format(b.total)}
                        </td>
                        <td className="py-2.5 pr-4 text-end tabular-nums text-success">
                          {fmt.format(b.completed)}
                        </td>
                        <td className="py-2.5 pr-4 text-end">
                          <Badge tone={pRate <= TARGETS.pendingRate ? "success" : "destructive"}>
                            {fmt.format(b.pending)} · {pRate.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-end">
                          <Badge tone={b.rate48h >= TARGETS.rate48h ? "success" : "destructive"}>
                            {b.rate48h}%
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-end">
                          <Badge tone={b.rate72h >= TARGETS.rate72h ? "success" : "destructive"}>
                            {b.rate72h}%
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-end tabular-nums text-muted-foreground">
                          {b.csat > 0 ? `${b.csat}%` : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          <Badge tone={tone}>{label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </section>

      {worst && (
        <p className="mt-4 text-xs text-muted-foreground">
          Lowest 48h compliance (≥3 tickets): <span className="text-foreground font-medium">{worst.branch}</span> at {worst.rate48h}%.
        </p>
      )}
    </DashboardLayout>
  );
}