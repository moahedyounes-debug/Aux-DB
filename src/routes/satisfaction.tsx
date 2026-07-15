import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Star, Users, Award, MessageCircle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { cicQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/satisfaction")({
  loader: ({ context }) => context.queryClient.ensureQueryData(cicQueryOptions),
  head: () => ({
    meta: [
      { title: "Satisfaction / CIC Evaluation — AUX ASC Dashboard" },
      { name: "description", content: "Call-center quality scores per agent and criteria category from the CIC evaluation sheet." },
      { property: "og:title", content: "Satisfaction / CIC Evaluation — AUX ASC Dashboard" },
      { property: "og:description", content: "Weighted CIC scoring, category breakdown and evaluator comments." },
    ],
  }),
  component: SatisfactionPage,
});

const num = new Intl.NumberFormat("en-US");

function SatisfactionPage() {
  const { data } = useSuspenseQuery(cicQueryOptions);

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  const scoreColor = (pct: number) => pct >= 85 ? "var(--color-success)" : pct >= 70 ? "var(--color-warning)" : "var(--color-destructive)";

  return (
    <DashboardLayout
      title="Satisfaction · CIC Evaluation"
      subtitle={`${num.format(data.totalEvaluations)} evaluations · avg ${data.avgScorePct}% · top: ${data.topAgent}`}
    >
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg Score" value={`${data.avgScorePct}%`} icon={Star} tone="primary" />
        <KpiCard label="Evaluations" value={num.format(data.totalEvaluations)} icon={Award} tone="accent" />
        <KpiCard label="Agents Reviewed" value={num.format(new Set(data.agents.map((a) => a.agent)).size)} icon={Users} tone="success" />
        <KpiCard label="Comments Logged" value={num.format(data.comments.length)} icon={MessageCircle} tone="warning" />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Score by Criteria Category"
          subtitle="Average performance across evaluation dimensions"
          exportRows={data.byCategory.map((c) => ({
            Category: c.category, "Avg Score": c.avgScore, "%": c.pct, Evaluations: c.evaluations,
          }))}
        >
          <ResponsiveContainer width="100%" height={340}>
            <RadarChart data={data.byCategory}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar dataKey="pct" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Agent Ranking"
          subtitle="Latest evaluation month · weighted score"
          exportRows={data.agents.map((a) => ({
            Agent: a.agent, Month: a.month, Score: `${a.pct}%`,
            "Total Points": a.totalScore, "Max": a.maxScore, Evaluations: a.evaluations,
          }))}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.agents.slice(0, 12)} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="agent" stroke="var(--color-muted-foreground)" fontSize={11} width={100} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="pct" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-3">
        <ChartCard title="Full Agent Scorecard" subtitle="All months" className="xl:col-span-2"
          exportRows={data.agents.map((a) => ({
            Agent: a.agent, Month: a.month, "Score %": a.pct,
            "Total": a.totalScore, "Max": a.maxScore, Evaluations: a.evaluations,
          }))}
        >
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Agent</th>
                  <th className="py-2 pr-4 text-start">Month</th>
                  <th className="py-2 pr-4 text-end">Evaluations</th>
                  <th className="py-2 pr-4 text-end">Score</th>
                  <th className="py-2 pr-4 text-end">Total / Max</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a, i) => (
                  <tr key={`${a.agent}-${a.month}-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium">{a.agent}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{a.month}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(a.evaluations)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums font-semibold" style={{ color: scoreColor(a.pct) }}>
                      {a.pct}%
                    </td>
                    <td className="py-2 pr-4 text-end tabular-nums text-xs text-muted-foreground">
                      {a.totalScore} / {a.maxScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Evaluator Comments" subtitle="Coaching notes" className="xl:col-span-1" disableExport>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {data.comments.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No comments logged.</p>
            )}
            {data.comments.map((c, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm" dir="rtl">
                {c.evaluator && <p className="text-foreground leading-relaxed">{c.evaluator}</p>}
                {c.agent && (
                  <p className="mt-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                    {c.agent}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}