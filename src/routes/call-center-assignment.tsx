import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Building2, Target, UserCheck, Users } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { assignmentQueryOptions } from "@/lib/aux/queries";
import { SortableTh, useSort } from "@/components/ui/sortable-th";

export const Route = createFileRoute("/call-center-assignment")({
  loader: ({ context }) => context.queryClient.ensureQueryData(assignmentQueryOptions),
  head: () => ({
    meta: [
      { title: "Call Center Assignment — AUX ASC Dashboard" },
      { name: "description", content: "Auto-assignment log: agents dispatching tickets to service centers with scoring." },
      { property: "og:title", content: "Call Center Assignment — AUX ASC Dashboard" },
      { property: "og:description", content: "Agent workload and service-center selection scoring." },
    ],
  }),
  component: AssignmentPage,
});

const num = new Intl.NumberFormat("en-US");

function AssignmentPage() {
  const { data } = useSuspenseQuery(assignmentQueryOptions);
  const recentSort = useSort(data.recent, {
    timestamp: (r) => r.timestamp,
    agent: (r) => r.agent,
    ticket: (r) => r.ticket,
    customer: (r) => r.customer,
    center: (r) => r.center,
    status: (r) => r.status ?? "",
    worker: (r) => r.worker ?? "",
    score: (r) => r.score,
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
      title="Call Center Assignment"
      subtitle={`${data.activeAgents} agents · ${data.activeCenters} centers · avg score ${data.avgScore}`}
    >
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Assignments" value={num.format(data.totalAssignments)} icon={Target} tone="primary" />
        <KpiCard label="Active Agents" value={num.format(data.activeAgents)} icon={Users} tone="accent" />
        <KpiCard label="Service Centers Used" value={num.format(data.activeCenters)} icon={Building2} tone="success" />
        <KpiCard label="Avg Selection Score" value={data.avgScore.toFixed(1)} hint="From auto-assignment engine" icon={UserCheck} tone="warning" />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Assignments by Agent"
          subtitle="Total tickets dispatched per operator"
          exportRows={data.byAgent.map((a) => ({
            Agent: a.agent, Assignments: a.assignments,
            "Avg Score": a.avgScore, "Distinct Centers": a.centers,
          }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.byAgent.slice(0, 15)} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="agent" stroke="var(--color-muted-foreground)" fontSize={11} width={160} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="assignments" fill="var(--color-chart-2)" name="Assignments" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Assignments by Service Center"
          subtitle="Where tickets are being routed"
          exportRows={data.byCenter.map((c) => ({
            Center: c.center, Assignments: c.assignments, "Avg Score": c.avgScore,
          }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.byCenter.slice(0, 15)} margin={{ top: 8, right: 16, bottom: 24, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="center" stroke="var(--color-muted-foreground)" fontSize={11} angle={-30} textAnchor="end" height={60} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="assignments" fill="var(--color-chart-3)" name="Assignments" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Daily Assignment Volume"
          subtitle="Ticket dispatch trend"
          className="xl:col-span-2"
          exportRows={data.byDay.map((d) => ({ Date: d.date, Assignments: d.assignments }))}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.byDay} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="assignments" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Recent Assignments"
          subtitle={`Last ${data.recent.length} dispatches`}
          exportRows={data.recent.map((r) => ({
            Timestamp: r.timestamp, Agent: r.agent, Ticket: r.ticket,
            Customer: r.customer, Center: r.center, Score: r.score, Reason: r.reason,
            Branch: r.branch ?? "", Status: r.status ?? "", Worker: r.worker ?? "",
          }))}
        >
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <SortableTh sortKey="timestamp" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Timestamp</SortableTh>
                  <SortableTh sortKey="agent" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Agent</SortableTh>
                  <SortableTh sortKey="ticket" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Ticket</SortableTh>
                  <SortableTh sortKey="customer" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Customer</SortableTh>
                  <SortableTh sortKey="center" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Center</SortableTh>
                  <SortableTh sortKey="status" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Status</SortableTh>
                  <SortableTh sortKey="worker" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-start">Worker</SortableTh>
                  <SortableTh sortKey="score" align="end" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="py-2 pr-4 text-end">Score</SortableTh>
                </tr>
              </thead>
              <tbody>
                {recentSort.sorted.map((r, i) => (
                  <tr key={`${r.timestamp}-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 text-muted-foreground text-xs whitespace-nowrap">{r.timestamp.slice(0, 19).replace("T", " ")}</td>
                    <td className="py-2 pr-4 text-xs">{r.agent}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.ticket}</td>
                    <td className="py-2 pr-4">{r.customer}</td>
                    <td className="py-2 pr-4 font-medium">{r.center}</td>
                    <td className="py-2 pr-4 text-xs">{r.status || "—"}</td>
                    <td className="py-2 pr-4 text-xs">{r.worker || "—"}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{r.score.toFixed(1)}</td>
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
    </DashboardLayout>
  );
}
