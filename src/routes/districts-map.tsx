import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, Globe2, Building2, Activity } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useKpiData } from "@/hooks/use-kpi-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/districts-map")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Districts Map — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Region-level distribution of ticket volume, SLA compliance and backlog across Saudi Arabia.",
      },
    ],
  }),
  component: DistrictsPage,
});

const num = new Intl.NumberFormat("en-US");

function DistrictsPage() {
  const { data } = useKpiData();
  const cities = data.cities;

  const regionMap = new Map<string, { total: number; completed: number; pending: number; cities: number; sla48Sum: number; sla72Sum: number }>();
  for (const c of cities) {
    let r = regionMap.get(c.region);
    if (!r) {
      r = { total: 0, completed: 0, pending: 0, cities: 0, sla48Sum: 0, sla72Sum: 0 };
      regionMap.set(c.region, r);
    }
    r.total += c.total;
    r.completed += c.completed;
    r.pending += c.pending;
    r.cities += 1;
    r.sla48Sum += c.rate48h * c.total;
    r.sla72Sum += c.rate72h * c.total;
  }
  const regions = Array.from(regionMap.entries())
    .map(([region, s]) => ({
      region,
      total: s.total,
      pending: s.pending,
      completed: s.completed,
      cities: s.cities,
      rate48h: s.total ? Math.round(s.sla48Sum / s.total) : 0,
      rate72h: s.total ? Math.round(s.sla72Sum / s.total) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const totalTickets = regions.reduce((s, r) => s + r.total, 0);
  const totalPending = regions.reduce((s, r) => s + r.pending, 0);
  const netSla = totalTickets ? Math.round(regions.reduce((s, r) => s + r.rate72h * r.total, 0) / totalTickets) : 0;

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Districts Map"
      subtitle={`${num.format(cities.length)} cities · ${num.format(regions.length)} regions · ${num.format(totalTickets)} tickets tracked`}
    >
      <section aria-label="Coverage KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Regions" value={num.format(regions.length)} hint="Active service regions" icon={Globe2} tone="primary" />
        <KpiCard label="Cities" value={num.format(cities.length)} hint="With at least one ticket" icon={MapPin} tone="accent" />
        <KpiCard label="Total Backlog" value={num.format(totalPending)} hint="Pending across all districts" icon={Building2} tone="warning" />
        <KpiCard label="Network SLA (72h)" value={`${netSla}%`} hint="Weighted by ticket volume" icon={Activity} tone={netSla >= 90 ? "success" : netSla >= 75 ? "warning" : "destructive"} />
      </section>

      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-6">
        <ChartCard title="Tickets by region" subtitle="Volume and backlog per region" exportRows={regions}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regions} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="region" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                <Bar dataKey="pending" stackId="a" fill="#ef4444" name="Pending" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="SLA compliance by region" subtitle="48h vs 72h achievement" exportRows={regions.map((r) => ({ region: r.region, rate48h: r.rate48h, rate72h: r.rate72h }))}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regions} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="region" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="rate48h" fill="#3b82f6" name="48h" radius={[6, 6, 0, 0]} />
                <Bar dataKey="rate72h" fill="#10b981" name="72h" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <section className="mt-6">
        <ChartCard title="City heatmap" subtitle="Sorted by ticket volume · color = SLA (72h)" exportRows={cities.map((c) => ({ ...c }))}>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 max-h-[560px] overflow-auto pr-1">
            {[...cities].sort((a, b) => b.total - a.total).map((c) => {
              const tone = c.rate72h >= 90 ? "bg-success/15 border-success/40" : c.rate72h >= 75 ? "bg-warning/15 border-warning/40" : "bg-destructive/15 border-destructive/40";
              return (
                <div key={`${c.region}-${c.city}`} className={cn("rounded-lg border p-3 flex flex-col gap-1", tone)}>
                  <div className="text-xs text-muted-foreground truncate">{c.region}</div>
                  <div className="text-sm font-semibold truncate">{c.city}</div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold">{num.format(c.total)}</span>
                    <span className="text-xs">{c.rate72h}%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">Pending {num.format(c.pending)} · {c.topProduct || "—"}</div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </section>
    </DashboardLayout>
  );
}