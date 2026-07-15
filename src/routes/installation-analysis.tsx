import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Hammer, CalendarClock, CheckCircle2, Timer } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/installation-analysis")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions),
  head: () => ({
    meta: [
      { title: "Installation Analysis — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "New installation tickets: volume by product and city, average lead time from creation to install, and today's schedule.",
      },
      { property: "og:title", content: "Installation Analysis — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Installation workload, lead time and scheduled visits.",
      },
    ],
  }),
  component: InstallationPage,
});

const fmt = new Intl.NumberFormat("en-US");

function InstallationPage() {
  const { data } = useSuspenseQuery(kpiQueryOptions);
  const inst = data.installation;

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Installation Analysis"
      subtitle="New-unit installation tickets — separated from repair KPI"
    >
      <section aria-label="Installation KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Installations"
          value={fmt.format(inst.total)}
          hint="All service centers"
          icon={Hammer}
          tone="primary"
        />
        <KpiCard
          label="Pending"
          value={fmt.format(inst.pending)}
          hint="Not yet completed"
          icon={Timer}
          tone="warning"
        />
        <KpiCard
          label="Completed"
          value={fmt.format(inst.completed)}
          hint="Closed installations"
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Scheduled Today"
          value={fmt.format(inst.scheduledToday)}
          hint={`Avg lead ${inst.avgLeadDays}d`}
          icon={CalendarClock}
          tone="primary"
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="By Product Line"
          subtitle="Installations per product"
          exportRows={inst.byProduct.map((p) => ({ Product: p.product, Count: p.count }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={inst.byProduct}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 0, left: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis
                type="category"
                dataKey="product"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                width={160}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="By City — Top 15"
          subtitle="Installations vs pending"
          exportRows={inst.byCity.map((c) => ({ City: c.city, Total: c.count, Pending: c.pending }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={inst.byCity}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 0, left: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis
                type="category"
                dataKey="city"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                width={130}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" stackId="a" fill="var(--color-chart-2)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pending" stackId="b" fill="var(--color-warning)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="mt-6">
        <ChartCard
          title="Installation Tickets"
          subtitle={`${inst.tickets.length} tickets — sorted by newest`}
          exportRows={inst.tickets.map((t) => ({
            Ticket: t.ticket,
            Branch: t.branch,
            City: t.city,
            Product: t.productLine,
            Type: t.productType,
            Status: t.status,
            Worker: t.worker,
            Created: t.createdAt,
            "Install Date": t.installationDate,
            "Age (d)": t.ageDays,
            Completed: t.completed ? "Yes" : "No",
          }))}
        >
          {inst.tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No installation tickets.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 text-start">Ticket #</th>
                    <th className="py-2 pr-4 text-start">City · Branch</th>
                    <th className="py-2 pr-4 text-start">Product</th>
                    <th className="py-2 pr-4 text-start">Worker</th>
                    <th className="py-2 pr-4 text-start">Created</th>
                    <th className="py-2 pr-4 text-start">Install Date</th>
                    <th className="py-2 pr-4 text-end">Age (d)</th>
                    <th className="py-2 pr-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inst.tickets.slice(0, 150).map((t) => (
                    <tr key={t.ticket} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{t.ticket}</td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{t.city}</div>
                        <div className="text-xs text-muted-foreground">{t.branch}</div>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">{t.productLine}</td>
                      <td className="py-2 pr-4 text-xs">{t.worker}</td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">{t.createdAt}</td>
                      <td className="py-2 pr-4 tabular-nums">{t.installationDate}</td>
                      <td className="py-2 pr-4 text-end tabular-nums">{t.ageDays}</td>
                      <td className="py-2 pr-4 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                            t.completed
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning",
                          )}
                        >
                          {t.completed ? "Done" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {inst.tickets.length > 150 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Showing first 150 of {inst.tickets.length} — export CSV for the full list.
                </p>
              )}
            </div>
          )}
        </ChartCard>
      </section>
    </DashboardLayout>
  );
}