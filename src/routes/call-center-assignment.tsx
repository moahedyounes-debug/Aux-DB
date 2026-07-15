import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { UserCheck, UserX, Users, Zap } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { callsQueryOptions, kpiQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/call-center-assignment")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(kpiQueryOptions),
      context.queryClient.ensureQueryData(callsQueryOptions),
    ]),
  head: () => ({
    meta: [
      { title: "Call Center Assignment — AUX ASC Dashboard" },
      { name: "description", content: "Agent workload: tickets handled, calls answered, WhatsApp conversations closed." },
      { property: "og:title", content: "Call Center Assignment — AUX ASC Dashboard" },
      { property: "og:description", content: "Balanced view of every call-center agent's load." },
    ],
  }),
  component: AssignmentPage,
});

const num = new Intl.NumberFormat("en-US");

function AssignmentPage() {
  const { data: kpi } = useSuspenseQuery(kpiQueryOptions);
  const { data: calls } = useSuspenseQuery(callsQueryOptions);

  // Build unified workload table
  const workload = useMemo(() => {
    const map = new Map<string, {
      agent: string; tickets: number; calls: number; answered: number;
      whatsapp: number; msgs: number;
    }>();
    // From call-center tickets (worker field)
    for (const t of kpi.callCenter.tickets) {
      const name = t.worker || "Unassigned";
      const r = map.get(name) ?? { agent: name, tickets: 0, calls: 0, answered: 0, whatsapp: 0, msgs: 0 };
      r.tickets++;
      map.set(name, r);
    }
    for (const a of calls.calls.byAgent) {
      const r = map.get(a.agent) ?? { agent: a.agent, tickets: 0, calls: 0, answered: 0, whatsapp: 0, msgs: 0 };
      r.calls += a.calls;
      r.answered += a.answered;
      map.set(a.agent, r);
    }
    for (const wa of calls.whatsapp.agents) {
      const r = map.get(wa.name) ?? { agent: wa.name, tickets: 0, calls: 0, answered: 0, whatsapp: 0, msgs: 0 };
      r.whatsapp += wa.closed;
      r.msgs += wa.msgSent;
      map.set(wa.name, r);
    }
    return Array.from(map.values())
      .filter((r) => r.agent && r.agent !== "—" && r.agent !== "Unassigned")
      .map((r) => ({
        ...r,
        totalLoad: r.tickets + r.answered + r.whatsapp,
      }))
      .sort((a, b) => b.totalLoad - a.totalLoad);
  }, [kpi, calls]);

  const activeAgents = workload.length;
  const totalLoad = workload.reduce((s, r) => s + r.totalLoad, 0);
  const avgLoad = activeAgents > 0 ? Math.round(totalLoad / activeAgents) : 0;
  const unassignedTickets = kpi.callCenter.tickets.filter((t) => !t.worker || t.worker === "—").length;

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout title="Call Center Assignment" subtitle={`${activeAgents} active agents · avg load ${avgLoad} items`}>
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Agents" value={num.format(activeAgents)} icon={Users} tone="primary" />
        <KpiCard label="Total Workload" value={num.format(totalLoad)} hint="Tickets + calls + chats" icon={Zap} tone="accent" />
        <KpiCard label="Avg / Agent" value={num.format(avgLoad)} icon={UserCheck} tone="success" />
        <KpiCard label="Unassigned Tickets" value={num.format(unassignedTickets)} icon={UserX} tone="destructive" />
      </section>

      <div className="mt-6">
        <ChartCard
          title="Workload Distribution (Top 20)"
          subtitle="Stacked: tickets + answered calls + WhatsApp"
          exportRows={workload.map((r) => ({
            Agent: r.agent, Tickets: r.tickets, Calls: r.calls, Answered: r.answered,
            WhatsApp: r.whatsapp, Msgs: r.msgs, "Total Load": r.totalLoad,
          }))}
        >
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={workload.slice(0, 20)} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="agent" stroke="var(--color-muted-foreground)" fontSize={11} width={140} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="tickets" stackId="s" fill="var(--color-chart-2)" name="Tickets" />
              <Bar dataKey="answered" stackId="s" fill="var(--color-chart-3)" name="Calls" />
              <Bar dataKey="whatsapp" stackId="s" fill="var(--color-chart-4)" name="WhatsApp" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Full Agent Roster"
          subtitle="All channels combined"
          exportRows={workload.map((r) => ({
            Agent: r.agent, Tickets: r.tickets, Calls: r.calls, Answered: r.answered,
            WhatsApp: r.whatsapp, Msgs: r.msgs, "Total Load": r.totalLoad,
          }))}
        >
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Agent</th>
                  <th className="py-2 pr-4 text-end">Tickets</th>
                  <th className="py-2 pr-4 text-end">Calls</th>
                  <th className="py-2 pr-4 text-end">Answered</th>
                  <th className="py-2 pr-4 text-end">WhatsApp</th>
                  <th className="py-2 pr-4 text-end">Msgs</th>
                  <th className="py-2 pr-4 text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((r) => (
                  <tr key={r.agent} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.agent}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(r.tickets)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(r.calls)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-success">{num.format(r.answered)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(r.whatsapp)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-muted-foreground">{num.format(r.msgs)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums font-semibold">{num.format(r.totalLoad)}</td>
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