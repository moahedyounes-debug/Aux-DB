import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Award, MessageCircle, Star, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { satisfactionQueryOptions } from "@/lib/aux/queries";
import { SortableTh, useSort } from "@/components/ui/sortable-th";

export const Route = createFileRoute("/satisfaction")({
  loader: ({ context }) => context.queryClient.ensureQueryData(satisfactionQueryOptions),
  head: () => ({
    meta: [
      { title: "Satisfaction Surveys — AUX ASC Dashboard" },
      { name: "description", content: "Customer satisfaction scores from post-service surveys stored in the main sheet." },
      { property: "og:title", content: "Satisfaction Surveys — AUX ASC Dashboard" },
      { property: "og:description", content: "NPS, per-question averages and agent breakdown." },
    ],
  }),
  component: SatisfactionPage,
});

const num = new Intl.NumberFormat("en-US");

function SatisfactionPage() {
  const { data } = useSuspenseQuery(satisfactionQueryOptions);

  const agentSort = useSort(data.byAgent, {
    agent: (a) => a.agent,
    surveys: (a) => a.surveys,
    avgScore: (a) => a.avgScore,
    promoters: (a) => a.promoters,
    detractors: (a) => a.detractors,
  });
  const recentSort = useSort(data.recent, {
    ticket: (r) => r.ticket,
    customer: (r) => r.customer,
    avg: (r) => r.avg,
    branch: (r) => r.branch ?? "",
    status: (r) => r.status ?? "",
    worker: (r) => r.worker ?? "",
    agent: (r) => r.agent ?? "",
    savedAt: (r) => r.savedAt,
  });

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Satisfaction Surveys"
      subtitle={`${num.format(data.totalSurveys)} responses · avg ${data.avgScore}/10 · NPS ${data.nps}`}
    >
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Responses" value={num.format(data.totalSurveys)} icon={MessageCircle} tone="primary" />
        <KpiCard label="Avg Score" value={`${data.avgScore}/10`} icon={Star} tone="warning" />
        <KpiCard label="Promoters" value={num.format(data.promoters)} hint="≥ 9/10" icon={Award} tone="success" />
        <KpiCard label="NPS" value={String(data.nps)} hint="Promoters − Detractors" icon={TrendingUp} tone={data.nps >= 50 ? "success" : "warning"} />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Score per Question"
          subtitle="Where customers rate you"
          exportRows={data.perQuestion.map((q) => ({ Question: q.label, Avg: q.avg }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={data.perQuestion}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} />
              <PolarRadiusAxis domain={[0, 10]} stroke="var(--color-muted-foreground)" fontSize={10} />
              <Radar name="Avg" dataKey="avg" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.4} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Sentiment Distribution"
          subtitle="Promoters / Passives / Detractors"
          exportRows={[
            { Bucket: "Promoters (9-10)", Count: data.promoters },
            { Bucket: "Passives (7-8)", Count: data.passives },
            { Bucket: "Detractors (≤6)", Count: data.detractors },
          ]}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={[
                { bucket: "Promoters", count: data.promoters, fill: "var(--color-chart-5)" },
                { bucket: "Passives", count: data.passives, fill: "var(--color-chart-3)" },
                { bucket: "Detractors", count: data.detractors, fill: "var(--color-chart-2)" },
              ]}
              margin={{ top: 8, right: 16, bottom: 0, left: -8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="bucket" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Responses" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Monthly Trend"
          subtitle="Average satisfaction over time"
          className="xl:col-span-2"
          exportRows={data.byMonth.map((m) => ({ Month: m.month, Surveys: m.surveys, "Avg Score": m.avgScore }))}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.byMonth} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis yAxisId="l" stroke="var(--color-muted-foreground)" fontSize={12} domain={[0, 10]} />
              <YAxis yAxisId="r" orientation="right" stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line yAxisId="l" type="monotone" dataKey="avgScore" stroke="var(--color-chart-1)" strokeWidth={2.5} name="Avg Score" dot={{ r: 3 }} />
              <Line yAxisId="r" type="monotone" dataKey="surveys" stroke="var(--color-chart-3)" strokeWidth={2} name="Responses" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Agent Breakdown"
          subtitle="Who is collecting the surveys"
          exportRows={data.byAgent.map((a) => ({
            Agent: a.agent, Surveys: a.surveys, "Avg Score": a.avgScore,
            Promoters: a.promoters, Detractors: a.detractors,
          }))}
        >
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <SortableTh sortKey="agent" currentKey={agentSort.sortKey} currentDir={agentSort.sortDir} onSort={agentSort.toggle} className="py-2 pr-4 text-start">Agent</SortableTh>
                  <SortableTh sortKey="surveys" align="end" currentKey={agentSort.sortKey} currentDir={agentSort.sortDir} onSort={agentSort.toggle} className="py-2 pr-4 text-end">Surveys</SortableTh>
                  <SortableTh sortKey="avgScore" align="end" currentKey={agentSort.sortKey} currentDir={agentSort.sortDir} onSort={agentSort.toggle} className="py-2 pr-4 text-end">Avg</SortableTh>
                  <SortableTh sortKey="promoters" align="end" currentKey={agentSort.sortKey} currentDir={agentSort.sortDir} onSort={agentSort.toggle} className="py-2 pr-4 text-end">Promoters</SortableTh>
                  <SortableTh sortKey="detractors" align="end" currentKey={agentSort.sortKey} currentDir={agentSort.sortDir} onSort={agentSort.toggle} className="py-2 pr-4 text-end">Detractors</SortableTh>
                </tr>
              </thead>
              <tbody>
                {agentSort.sorted.map((a) => (
                  <tr key={a.agent} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium">{a.agent}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(a.surveys)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{a.avgScore}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-success">{num.format(a.promoters)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-destructive">{num.format(a.detractors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {data.error && (
        <p className="mt-4 text-xs text-destructive">Data error: {data.error}</p>
      )}

      <div className="mt-6">
        <ChartCard
          title="Recent Surveys"
          subtitle="Merged with live ticket status from the main sheet"
          exportRows={data.recent.map((r) => ({
            Ticket: r.ticket, Customer: r.customer, Avg: r.avg, Agent: r.agent,
            Branch: r.branch ?? "", Status: r.status ?? "", Worker: r.worker ?? "",
            Saved: r.savedAt,
          }))}
        >
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <SortableTh sortKey="ticket" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Ticket</SortableTh>
                  <SortableTh sortKey="customer" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Customer</SortableTh>
                  <SortableTh sortKey="avg" align="end" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-end">Avg</SortableTh>
                  <SortableTh sortKey="branch" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Branch</SortableTh>
                  <SortableTh sortKey="status" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Status</SortableTh>
                  <SortableTh sortKey="worker" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Worker</SortableTh>
                  <SortableTh sortKey="agent" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Agent</SortableTh>
                  <SortableTh sortKey="savedAt" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Saved</SortableTh>
                </tr>
              </thead>
              <tbody>
                {recentSort.sorted.map((r, i) => (
                  <tr key={`${r.ticket}-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{r.ticket}</td>
                    <td className="py-2 pr-4">{r.customer}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{r.avg}</td>
                    <td className="py-2 pr-4 text-xs">{r.branch || "—"}</td>
                    <td className="py-2 pr-4 text-xs">{r.status || "—"}</td>
                    <td className="py-2 pr-4 text-xs">{r.worker || "—"}</td>
                    <td className="py-2 pr-4 text-xs">{r.agent || "—"}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{r.savedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}
