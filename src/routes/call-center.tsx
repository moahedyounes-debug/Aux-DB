import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Headphones, CheckCircle2, Clock3, PhoneCall } from "lucide-react";
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
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useKpiData } from "@/hooks/use-kpi-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/call-center")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Call Center — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Non-repair tickets handled by call center agents: Consultation, Easy Repair and similar service types — kept out of the ASC KPI.",
      },
      { property: "og:title", content: "Call Center — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Consultation and Easy-repair tickets handled by call center agents.",
      },
    ],
  }),
  component: CallCenterPage,
});

const fmt = new Intl.NumberFormat("en-US");

function CallCenterPage() {
  const { data } = useKpiData();
  const cc = data.callCenter;

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Call Center"
      subtitle="Non-repair tickets — handled by agents, excluded from ASC KPI"
    >
      <section aria-label="Call Center KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total" value={fmt.format(cc.total)} hint="Non-repair tickets" icon={Headphones} tone="primary" />
        <KpiCard label="Pending" value={fmt.format(cc.pending)} hint="Open" icon={Clock3} tone="warning" />
        <KpiCard label="Completed" value={fmt.format(cc.completed)} hint="Closed by agent" icon={CheckCircle2} tone="success" />
        <KpiCard
          label="Top Type"
          value={cc.byType[0]?.type ?? "—"}
          hint={cc.byType[0] ? `${fmt.format(cc.byType[0].count)} tickets` : ""}
          icon={PhoneCall}
          tone="primary"
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="By Service Type"
          subtitle="Consultation / Easy repair / etc."
          exportRows={cc.byType.map((t) => ({ Type: t.type, Count: t.count }))}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cc.byType} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="type" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {cc.byType.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "var(--color-primary)" : "var(--color-chart-2)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="By Branch"
          subtitle="Top 15 origins"
          exportRows={cc.byBranch.map((b) => ({ Branch: b.branch, Count: b.count }))}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={cc.byBranch}
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
                width={160}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="mt-6">
        <ChartCard
          title="All Call-Center Tickets"
          subtitle={`${cc.tickets.length} tickets`}
          exportRows={cc.tickets.map((t) => ({
            Ticket: t.ticket,
            Branch: t.branch,
            Type: t.serviceType,
            Status: t.status,
            Reason: t.reason,
            Created: t.createdAt,
            Worker: t.worker,
            Completed: t.completed ? "Yes" : "No",
          }))}
        >
          {cc.tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No call-center tickets.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 text-start">Ticket #</th>
                    <th className="py-2 pr-4 text-start">Branch</th>
                    <th className="py-2 pr-4 text-start">Type</th>
                    <th className="py-2 pr-4 text-start">Status</th>
                    <th className="py-2 pr-4 text-start">Reason</th>
                    <th className="py-2 pr-4 text-start">Created</th>
                    <th className="py-2 pr-4 text-center">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {cc.tickets.slice(0, 100).map((t) => (
                    <tr key={t.ticket} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{t.ticket}</td>
                      <td className="py-2 pr-4">{t.branch}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary/15 text-primary">
                          {t.serviceType}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{t.status}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{t.reason}</td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">{t.createdAt}</td>
                      <td className="py-2 pr-4 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                            t.completed ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                          )}
                        >
                          {t.completed ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cc.tickets.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Showing first 100 of {cc.tickets.length} — export CSV for full list.
                </p>
              )}
            </div>
          )}
        </ChartCard>
      </section>
    </DashboardLayout>
  );
}