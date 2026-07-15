import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Coins, TrendingDown, Building2, Percent } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/costs")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions),
  head: () => ({
    meta: [
      { title: "Cost Center — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Warranty cost breakdown across the ASC network: gross payout, SLA deductions, and net cost per branch and month.",
      },
    ],
  }),
  component: CostsPage,
});

const sar = new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-US");

function CostsPage() {
  const { data } = useSuspenseQuery(kpiQueryOptions);
  const w = data.warranty;
  const dedRate = w.gross ? Math.round((w.deduction / w.gross) * 100) : 0;
  const costPerTicket = w.totalClaims ? Math.round(w.net / w.totalClaims) : 0;
  const topBranches = [...w.byBranch].sort((a, b) => b.net - a.net).slice(0, 12);
  const monthRows = w.byMonth.map((m) => ({ month: m.label, gross: m.gross, deduction: m.deduction, net: m.net }));

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Cost Center"
      subtitle={`${num.format(w.totalClaims)} warranty claims · net payout ${sar.format(w.net)}`}
    >
      <section aria-label="Cost KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Gross Payout" value={sar.format(w.gross)} hint="Warranty cost before SLA deductions" icon={Coins} tone="primary" />
        <KpiCard label="SLA Deductions" value={sar.format(w.deduction)} hint={`${dedRate}% of gross`} icon={TrendingDown} tone="destructive" />
        <KpiCard label="Net Cost" value={sar.format(w.net)} hint="Payable to ASC network" icon={Building2} tone="success" />
        <KpiCard label="Cost / Ticket" value={sar.format(costPerTicket)} hint={`Across ${num.format(w.totalClaims)} claims`} icon={Percent} tone="accent" />
      </section>

      <section className="grid gap-6 grid-cols-1 mt-6">
        <ChartCard title="Monthly cost — gross vs net" subtitle="SLA deductions overlaid as a line" exportRows={monthRows}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sar.format(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="gross" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Gross" />
                <Bar yAxisId="left" dataKey="net" fill="#10b981" radius={[6, 6, 0, 0]} name="Net" />
                <Line yAxisId="right" dataKey="deduction" stroke="#ef4444" strokeWidth={2} name="Deduction" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-6">
        <ChartCard title="Top-cost ASCs" subtitle="Net warranty cost per branch" exportRows={topBranches}>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBranches} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                <YAxis type="category" dataKey="branch" width={150} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sar.format(v)} />
                <Bar dataKey="net" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Cost by parts tier" subtitle="Where the warranty budget goes" exportRows={w.byTier.map((t) => ({ tier: t.label, rate: t.rate, claims: t.claims, net: t.net }))}>
          <div className="h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b sticky top-0 bg-card">
                <tr>
                  <th className="text-start py-2 px-2">Tier</th>
                  <th className="text-end py-2 px-2">Rate</th>
                  <th className="text-end py-2 px-2">Claims</th>
                  <th className="text-end py-2 px-2">Net Cost</th>
                </tr>
              </thead>
              <tbody>
                {w.byTier.map((t) => (
                  <tr key={t.tier} className="border-b last:border-0">
                    <td className="py-2 px-2">
                      <div className="font-medium">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </td>
                    <td className="py-2 px-2 text-end">{sar.format(t.rate)}</td>
                    <td className="py-2 px-2 text-end">{num.format(t.claims)}</td>
                    <td className="py-2 px-2 text-end font-semibold">{sar.format(t.net)}</td>
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