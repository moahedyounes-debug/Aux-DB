import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, TrendingUp, Building2, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/city-breakdown")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions),
  head: () => ({
    meta: [
      { title: "City Breakdown — AUX ASC Dashboard" },
      { name: "description", content: "Repair ticket performance broken down by city and region across Saudi Arabia." },
      { property: "og:title", content: "City Breakdown — AUX ASC Dashboard" },
      { property: "og:description", content: "Per-city SLA rates, volumes and top products." },
    ],
  }),
  component: CityBreakdownPage,
});

const num = new Intl.NumberFormat("en-US");

function CityBreakdownPage() {
  const { data } = useSuspenseQuery(kpiQueryOptions);
  const cities = data.cities;
  const totalCities = cities.length;
  const totalTickets = cities.reduce((s, c) => s + c.total, 0);
  const avg72 = cities.length > 0
    ? Math.round(cities.reduce((s, c) => s + c.rate72h, 0) / cities.length * 10) / 10
    : 0;
  const worst = [...cities].filter((c) => c.total >= 5).sort((a, b) => a.rate72h - b.rate72h)[0];

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout title="City Breakdown" subtitle={`${num.format(totalCities)} cities · ${num.format(totalTickets)} tickets`}>
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Cities" value={num.format(totalCities)} icon={MapPin} tone="primary" />
        <KpiCard label="Total Tickets" value={num.format(totalTickets)} icon={Building2} tone="accent" />
        <KpiCard label="Avg 72h SLA" value={`${avg72}%`} hint="Across all cities" icon={TrendingUp} tone="success" />
        <KpiCard
          label="Weakest City"
          value={worst ? `${worst.rate72h}%` : "—"}
          hint={worst ? `${worst.city} · ${worst.total} tickets` : "—"}
          icon={AlertCircle}
          tone="destructive"
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Top 15 Cities by Volume"
          subtitle="Total repair tickets"
          exportRows={cities.slice(0, 15).map((c) => ({
            City: c.city, Region: c.region, Total: c.total, Completed: c.completed, Pending: c.pending,
          }))}
        >
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={cities.slice(0, 15)} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="city" stroke="var(--color-muted-foreground)" fontSize={11} width={110} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="completed" stackId="s" fill="var(--color-chart-2)" name="Completed" />
              <Bar dataKey="pending" stackId="s" fill="var(--color-chart-4)" name="Pending" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="72h SLA % by City"
          subtitle="Top 15 cities · higher is better"
          exportRows={cities.slice(0, 15).map((c) => ({ City: c.city, "72h %": c.rate72h, "48h %": c.rate48h }))}
        >
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={cities.slice(0, 15)} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="city" stroke="var(--color-muted-foreground)" fontSize={11} width={110} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="rate72h" fill="var(--color-primary)" radius={[0, 6, 6, 0]} name="72h SLA" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="mt-6">
        <ChartCard
          title="All Cities"
          subtitle="Full breakdown"
          exportRows={cities.map((c) => ({
            Region: c.region, City: c.city, Total: c.total, Completed: c.completed,
            Pending: c.pending, "48h %": c.rate48h, "72h %": c.rate72h, "Top Product": c.topProduct,
          }))}
        >
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Region</th>
                  <th className="py-2 pr-4 text-start">City</th>
                  <th className="py-2 pr-4 text-end">Total</th>
                  <th className="py-2 pr-4 text-end">Done</th>
                  <th className="py-2 pr-4 text-end">Pending</th>
                  <th className="py-2 pr-4 text-end">48h %</th>
                  <th className="py-2 pr-4 text-end">72h %</th>
                  <th className="py-2 pr-4 text-start">Top Product</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={`${c.region}-${c.city}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{c.region}</td>
                    <td className="py-2 pr-4 font-medium">{c.city}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(c.total)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-success">{num.format(c.completed)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-warning">{num.format(c.pending)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{c.rate48h}%</td>
                    <td className="py-2 pr-4 text-end tabular-nums font-semibold">{c.rate72h}%</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground truncate max-w-[180px]">{c.topProduct}</td>
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