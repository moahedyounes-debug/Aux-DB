import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, Building, TrendingUp, Package } from "lucide-react";
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
import { TARGETS } from "@/lib/aux/mock-data";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useKpiData } from "@/hooks/use-kpi-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/city")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "City Breakdown — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Ticket volumes, backlog and SLA compliance per city and region across Saudi Arabia.",
      },
      { property: "og:title", content: "City Breakdown — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Where the workload is: city-level view of tickets, pending and completion rates.",
      },
    ],
  }),
  component: CityPage,
});

const fmt = new Intl.NumberFormat("en-US");

function CityPage() {
  const { data } = useKpiData();
  const cities = data.cities;

  const totalCities = cities.length;
  const regionMap = new Map<string, { total: number; pending: number; completed: number }>();
  for (const c of cities) {
    let r = regionMap.get(c.region);
    if (!r) {
      r = { total: 0, pending: 0, completed: 0 };
      regionMap.set(c.region, r);
    }
    r.total += c.total;
    r.pending += c.pending;
    r.completed += c.completed;
  }
  const regions = Array.from(regionMap.entries())
    .map(([region, s]) => ({ region, ...s }))
    .sort((a, b) => b.total - a.total);

  const topCity = cities[0];
  const topRegion = regions[0];

  const topByVolume = cities.slice(0, 15);
  const topByPending = [...cities].sort((a, b) => b.pending - a.pending).slice(0, 15);

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="City Breakdown"
      subtitle="Geographic distribution of tickets, backlog and SLA compliance"
    >
      <section aria-label="City KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Cities Covered"
          value={fmt.format(totalCities)}
          hint={`${regions.length} regions`}
          icon={MapPin}
          tone="primary"
        />
        <KpiCard
          label="Top Region"
          value={topRegion?.region ?? "—"}
          hint={topRegion ? `${fmt.format(topRegion.total)} tickets` : ""}
          icon={Building}
          tone="primary"
        />
        <KpiCard
          label="Top City"
          value={topCity?.city ?? "—"}
          hint={topCity ? `${fmt.format(topCity.total)} tickets` : ""}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Top Product"
          value={topCity?.topProduct ?? "—"}
          hint={topCity ? `in ${topCity.city}` : ""}
          icon={Package}
          tone="primary"
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Top Cities by Volume"
          subtitle="15 highest-ticket cities"
          exportRows={topByVolume.map((c) => ({
            City: c.city,
            Region: c.region,
            Total: c.total,
            Pending: c.pending,
          }))}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={topByVolume}
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
                width={140}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="total" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Cities by Pending Backlog"
          subtitle="Where tickets are stuck"
          exportRows={topByPending.map((c) => ({
            City: c.city,
            Region: c.region,
            Pending: c.pending,
            Total: c.total,
          }))}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={topByPending}
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
                width={140}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pending" radius={[0, 6, 6, 0]}>
                {topByPending.map((c) => (
                  <Cell
                    key={`${c.region}-${c.city}`}
                    fill={c.pending > 10 ? "var(--color-destructive)" : "var(--color-warning)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="mt-6">
        <ChartCard
          title="Region Summary"
          subtitle={`${regions.length} regions`}
          exportRows={regions}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Region</th>
                  <th className="py-2 pr-4 text-end">Total</th>
                  <th className="py-2 pr-4 text-end">Completed</th>
                  <th className="py-2 pr-4 text-end">Pending</th>
                  <th className="py-2 pr-4 text-end">Completion %</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => {
                  const pct = r.total > 0 ? (r.completed / r.total) * 100 : 0;
                  return (
                    <tr key={r.region} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-4 font-medium">{r.region}</td>
                      <td className="py-2.5 pr-4 text-end tabular-nums">{fmt.format(r.total)}</td>
                      <td className="py-2.5 pr-4 text-end tabular-nums text-success">
                        {fmt.format(r.completed)}
                      </td>
                      <td className="py-2.5 pr-4 text-end tabular-nums text-warning">
                        {fmt.format(r.pending)}
                      </td>
                      <td className="py-2.5 pr-4 text-end tabular-nums">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>

      <section className="mt-6">
        <ChartCard
          title="All Cities"
          subtitle={`${cities.length} cities — sorted by volume`}
          exportRows={cities.map((c) => ({
            Region: c.region,
            City: c.city,
            Total: c.total,
            Completed: c.completed,
            Pending: c.pending,
            "48h %": c.rate48h,
            "72h %": c.rate72h,
            "Top Product": c.topProduct,
          }))}
        >
          {cities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No city data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 text-start">Region</th>
                    <th className="py-2 pr-4 text-start">City</th>
                    <th className="py-2 pr-4 text-end">Total</th>
                    <th className="py-2 pr-4 text-end">Completed</th>
                    <th className="py-2 pr-4 text-end">Pending</th>
                    <th className="py-2 pr-4 text-end">48h</th>
                    <th className="py-2 pr-4 text-end">72h</th>
                    <th className="py-2 pr-4 text-start">Top Product</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((c) => {
                    const ok48 = c.rate48h >= TARGETS.rate48h;
                    const ok72 = c.rate72h >= TARGETS.rate72h;
                    return (
                      <tr
                        key={`${c.region}-${c.city}`}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-2.5 pr-4 text-muted-foreground">{c.region}</td>
                        <td className="py-2.5 pr-4 font-medium">{c.city}</td>
                        <td className="py-2.5 pr-4 text-end tabular-nums">{fmt.format(c.total)}</td>
                        <td className="py-2.5 pr-4 text-end tabular-nums text-success">
                          {fmt.format(c.completed)}
                        </td>
                        <td className="py-2.5 pr-4 text-end tabular-nums text-warning">
                          {fmt.format(c.pending)}
                        </td>
                        <td className="py-2.5 pr-4 text-end">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                              ok48 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                            )}
                          >
                            {c.rate48h}%
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-end">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                              ok72 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                            )}
                          >
                            {c.rate72h}%
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground text-xs">{c.topProduct}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </section>
    </DashboardLayout>
  );
}