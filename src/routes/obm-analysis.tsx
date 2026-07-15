import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Building, Target, AlertOctagon, Clock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/obm-analysis")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions),
  head: () => ({
    meta: [
      { title: "OBM Analysis — AUX ASC Dashboard" },
      { name: "description", content: "Operations Branch Management analysis: branch scoring, SLA compliance and pending pressure." },
      { property: "og:title", content: "OBM Analysis — AUX ASC Dashboard" },
      { property: "og:description", content: "Branch-level operations performance and risk heatmap." },
    ],
  }),
  component: OBMPage,
});

const num = new Intl.NumberFormat("en-US");

function OBMPage() {
  const { data } = useSuspenseQuery(kpiQueryOptions);
  const branches = data.branches;

  // OBM composite score: 60% SLA72h + 40% completion rate
  const scored = branches
    .filter((b) => b.total >= 5)
    .map((b) => {
      const completionRate = b.total > 0 ? (b.completed / b.total) * 100 : 0;
      const score = Math.round((b.rate72h * 0.6 + completionRate * 0.4) * 10) / 10;
      return { ...b, completionRate: Math.round(completionRate * 10) / 10, score };
    })
    .sort((a, b) => b.score - a.score);

  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, b) => s + b.score, 0) / scored.length * 10) / 10 : 0;
  const risky = scored.filter((b) => b.score < 60);
  const totalPending = branches.reduce((s, b) => s + b.pending, 0);

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  const scoreColor = (s: number) => s >= 80 ? "var(--color-success)" : s >= 60 ? "var(--color-warning)" : "var(--color-destructive)";

  return (
    <DashboardLayout title="OBM Analysis" subtitle={`${scored.length} branches scored · composite = 60% SLA + 40% completion`}>
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Branches" value={num.format(scored.length)} icon={Building} tone="primary" />
        <KpiCard label="Avg OBM Score" value={`${avgScore}`} hint="Higher is better" icon={Target} tone="accent" />
        <KpiCard label="At-Risk (<60)" value={num.format(risky.length)} icon={AlertOctagon} tone="destructive" />
        <KpiCard label="Total Pending" value={num.format(totalPending)} icon={Clock} tone="warning" />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="OBM Score by Branch"
          subtitle="Top 20 · green ≥ 80, amber ≥ 60, red < 60"
          exportRows={scored.slice(0, 20).map((b) => ({
            Branch: b.branch, Score: b.score, "72h %": b.rate72h,
            "Completion %": b.completionRate, Total: b.total, Pending: b.pending,
          }))}
        >
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={scored.slice(0, 20)} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="branch" stroke="var(--color-muted-foreground)" fontSize={10} width={130} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                {scored.slice(0, 20).map((b) => (
                  <Cell key={b.branch} fill={scoreColor(b.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Volume vs SLA"
          subtitle="Bar = tickets, line-like risk by 72h SLA"
          exportRows={branches.slice(0, 15).map((b) => ({
            Branch: b.branch, Total: b.total, "72h %": b.rate72h,
          }))}
        >
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={branches.slice(0, 15)} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="branch" stroke="var(--color-muted-foreground)" fontSize={10} angle={-30} textAnchor="end" height={70} interval={0} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="total" fill="var(--color-chart-2)" name="Tickets" radius={[6, 6, 0, 0]} />
              <Bar dataKey="pending" fill="var(--color-chart-4)" name="Pending" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="mt-6">
        <ChartCard
          title="Full OBM Scorecard"
          subtitle="All branches with ≥5 tickets"
          exportRows={scored.map((b) => ({
            Branch: b.branch, Total: b.total, Completed: b.completed, Pending: b.pending,
            "48h %": b.rate48h, "72h %": b.rate72h, "Completion %": b.completionRate, "OBM Score": b.score,
          }))}
        >
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Rank</th>
                  <th className="py-2 pr-4 text-start">Branch</th>
                  <th className="py-2 pr-4 text-end">Total</th>
                  <th className="py-2 pr-4 text-end">Done</th>
                  <th className="py-2 pr-4 text-end">Pending</th>
                  <th className="py-2 pr-4 text-end">Completion</th>
                  <th className="py-2 pr-4 text-end">72h SLA</th>
                  <th className="py-2 pr-4 text-end">OBM Score</th>
                </tr>
              </thead>
              <tbody>
                {scored.map((b, i) => (
                  <tr key={b.branch} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 tabular-nums text-muted-foreground">#{i + 1}</td>
                    <td className="py-2 pr-4 font-medium">{b.branch}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(b.total)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-success">{num.format(b.completed)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-warning">{num.format(b.pending)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{b.completionRate}%</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{b.rate72h}%</td>
                    <td className="py-2 pr-4 text-end tabular-nums font-semibold" style={{ color: scoreColor(b.score) }}>
                      {b.score}
                    </td>
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