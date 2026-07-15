import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Phone, PhoneIncoming, PhoneOff, Target } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ComposedChart,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { callsQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/call-events")({
  loader: ({ context }) => context.queryClient.ensureQueryData(callsQueryOptions),
  head: () => ({
    meta: [
      { title: "Call Events — AUX ASC Dashboard" },
      { name: "description", content: "Inbound and outbound call events with SLA, answer rate, and peak-hour analysis." },
      { property: "og:title", content: "Call Events — AUX ASC Dashboard" },
      { property: "og:description", content: "Live call-center performance from the Calls sheet." },
    ],
  }),
  component: CallEventsPage,
});

const num = new Intl.NumberFormat("en-US");

function CallEventsPage() {
  const { data } = useSuspenseQuery(callsQueryOptions);
  const c = data.calls;

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Call Events"
      subtitle={`${num.format(c.totalCalls)} calls · Answer ${c.answerRate}% · SLA ${c.slaRate}%`}
    >
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Calls" value={num.format(c.totalCalls)} hint={`${num.format(c.inbound)} IB · ${num.format(c.outbound)} OB`} icon={Phone} tone="primary" />
        <KpiCard label="Answered" value={num.format(c.answered)} hint={`${c.answerRate}%`} icon={PhoneIncoming} tone="success" />
        <KpiCard label="Abandoned" value={num.format(c.abandoned)} icon={PhoneOff} tone="destructive" />
        <KpiCard label="Within SLA" value={`${c.slaRate}%`} hint={`${num.format(c.withinSla)} calls`} icon={Target} tone="accent" />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Monthly Call Volume"
          subtitle="Inbound vs outbound + answer rate"
          exportRows={c.byMonth.map((m) => ({
            Month: m.month, IB: m.inbound, OB: m.outbound, Answered: m.answered,
            "Answer %": m.answerRate, "SLA %": m.slaRate,
          }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={c.byMonth} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis yAxisId="l" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="l" dataKey="inbound" fill="var(--color-chart-2)" name="IB" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="l" dataKey="outbound" fill="var(--color-chart-3)" name="OB" radius={[6, 6, 0, 0]} />
              <Line yAxisId="r" dataKey="answerRate" stroke="var(--color-primary)" strokeWidth={2.5} name="Answer %" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Calls by Hour"
          subtitle="Peak hour distribution"
          exportRows={c.byHour.map((h) => ({ Hour: h.hour, Calls: h.calls, Answered: h.answered }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={c.byHour} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}:00`} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${v}:00`} />
              <Bar dataKey="calls" fill="var(--color-chart-2)" name="Total" radius={[6, 6, 0, 0]} />
              <Bar dataKey="answered" fill="var(--color-success)" name="Answered" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Calls by Day of Week"
          subtitle="Sun → Sat"
          exportRows={c.byDay.map((d) => ({ Day: d.day, Calls: d.calls, Answered: d.answered }))}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={c.byDay} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line dataKey="calls" stroke="var(--color-primary)" strokeWidth={2.5} name="Calls" />
              <Line dataKey="answered" stroke="var(--color-success)" strokeWidth={2} name="Answered" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top Agents"
          subtitle={`${c.byAgent.length} agents · by call volume`}
          exportRows={c.byAgent.map((a) => ({
            Agent: a.agent, Calls: a.calls, Answered: a.answered, Abandoned: a.abandoned, "Answer %": a.answerRate,
          }))}
        >
          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Agent</th>
                  <th className="py-2 pr-4 text-end">Calls</th>
                  <th className="py-2 pr-4 text-end">Answered</th>
                  <th className="py-2 pr-4 text-end">Abandoned</th>
                  <th className="py-2 pr-4 text-end">Answer %</th>
                </tr>
              </thead>
              <tbody>
                {c.byAgent.map((a) => (
                  <tr key={a.agent} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 text-xs font-medium">{a.agent}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(a.calls)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-success">{num.format(a.answered)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-destructive">{num.format(a.abandoned)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums font-semibold">{a.answerRate}%</td>
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