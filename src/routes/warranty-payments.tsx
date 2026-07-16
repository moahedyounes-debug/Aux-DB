import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Line,
} from "recharts";
import { Wallet, CheckCircle2, Clock3, TrendingDown } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useKpiData } from "@/hooks/use-kpi-data";
import {
  WARRANTY_TIERS,
  WARRANTY_SLA_DEDUCTION_PCT,
} from "@/lib/aux/sheets.functions";
import { cn } from "@/lib/utils";
import { SortableTh, useSort } from "@/components/ui/sortable-th";

export const Route = createFileRoute("/warranty-payments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Warranty Payments — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Warranty payouts derived from completed repair tickets: paid, approved with SLA deduction, and pending submission.",
      },
      { property: "og:title", content: "Warranty Payments — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Estimated warranty payouts per ASC, product line and month.",
      },
    ],
  }),
  component: WarrantyPaymentsPage,
});

const sar = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-US");

function WarrantyPaymentsPage() {
  const { data } = useKpiData();
  const w = data.warranty;

  const branchSort = useSort(w.byBranch, {
    branch: (b) => b.branch,
    claims: (b) => b.claims,
    paid: (b) => b.paid,
    approved: (b) => b.approved,
    submitted: (b) => b.submitted,
    gross: (b) => b.gross,
    deduction: (b) => b.deduction,
    net: (b) => b.net,
  });
  const claimRows = w.recentClaims.slice(0, 60);
  const claimsSort = useSort(claimRows, {
    ticket: (c) => c.ticket,
    branch: (c) => c.branch,
    tier: (c) => c.tierLabel,
    status: (c) => c.status,
    net: (c) => c.net,
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
      title="Warranty Payments"
      subtitle={`Derived from ${num.format(w.totalClaims)} repair claims · ${WARRANTY_SLA_DEDUCTION_PCT}% deduction on SLA misses`}
    >
      <section aria-label="Warranty KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Net Payout"
          value={sar.format(w.net)}
          hint={`Gross ${sar.format(w.gross)}`}
          icon={Wallet}
          tone="primary"
        />
        <KpiCard
          label="Paid Claims"
          value={num.format(w.paid)}
          hint={`${w.paidRate}% of total`}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Pending Submission"
          value={num.format(w.submitted)}
          hint="Ticket not yet completed"
          icon={Clock3}
          tone="warning"
        />
        <KpiCard
          label="SLA Deductions"
          value={sar.format(w.deduction)}
          hint={`${num.format(w.approved)} claims out of 72h`}
          icon={TrendingDown}
          tone="destructive"
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Monthly Payout Trend"
          subtitle="Gross vs net after SLA deduction"
          exportRows={w.byMonth.map((m) => ({
            Month: m.month,
            Claims: m.claims,
            Gross: m.gross,
            Deduction: m.deduction,
            Net: m.net,
          }))}
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={w.byMonth} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sar.format(v)} />
              <Bar dataKey="gross" name="Gross" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              <Line
                dataKey="net"
                name="Net"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Payout by Job Tier"
          subtitle="Net claim value per warranty tariff tier"
          exportRows={w.byTier.map((t) => ({
            Tier: t.tier,
            Label: t.label,
            Rate: t.rate,
            Claims: t.claims,
            Paid: t.paid,
            Approved: t.approved,
            Submitted: t.submitted,
            Gross: t.gross,
            Deduction: t.deduction,
            Net: t.net,
          }))}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={w.byTier}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 0, left: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis
                type="number"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <YAxis
                type="category"
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                width={170}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => sar.format(v)} />
              <Bar dataKey="net" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="mt-6">
        <ChartCard
          title="Payout by ASC"
          subtitle="Net warranty payout per service center — top 20"
          exportRows={w.byBranch.map((b) => ({
            Branch: b.branch,
            Claims: b.claims,
            Paid: b.paid,
            Approved: b.approved,
            Submitted: b.submitted,
            Gross: b.gross,
            Deduction: b.deduction,
            Net: b.net,
          }))}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <SortableTh sortKey="branch" currentKey={branchSort.sortKey} currentDir={branchSort.sortDir} onSort={branchSort.toggle} className="py-2 pr-4 text-start">Branch</SortableTh>
                  <SortableTh sortKey="claims" align="end" currentKey={branchSort.sortKey} currentDir={branchSort.sortDir} onSort={branchSort.toggle} className="py-2 pr-4 text-end">Claims</SortableTh>
                  <SortableTh sortKey="paid" align="end" currentKey={branchSort.sortKey} currentDir={branchSort.sortDir} onSort={branchSort.toggle} className="py-2 pr-4 text-end">Paid</SortableTh>
                  <SortableTh sortKey="approved" align="end" currentKey={branchSort.sortKey} currentDir={branchSort.sortDir} onSort={branchSort.toggle} className="py-2 pr-4 text-end">Approved</SortableTh>
                  <SortableTh sortKey="submitted" align="end" currentKey={branchSort.sortKey} currentDir={branchSort.sortDir} onSort={branchSort.toggle} className="py-2 pr-4 text-end">Pending</SortableTh>
                  <SortableTh sortKey="gross" align="end" currentKey={branchSort.sortKey} currentDir={branchSort.sortDir} onSort={branchSort.toggle} className="py-2 pr-4 text-end">Gross</SortableTh>
                  <SortableTh sortKey="deduction" align="end" currentKey={branchSort.sortKey} currentDir={branchSort.sortDir} onSort={branchSort.toggle} className="py-2 pr-4 text-end">Deduction</SortableTh>
                  <SortableTh sortKey="net" align="end" currentKey={branchSort.sortKey} currentDir={branchSort.sortDir} onSort={branchSort.toggle} className="py-2 pr-4 text-end">Net</SortableTh>
                </tr>
              </thead>
              <tbody>
                {branchSort.sorted.map((b) => (
                  <tr key={b.branch} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{b.branch}</td>
                    <td className="py-2.5 pr-4 text-end tabular-nums">{num.format(b.claims)}</td>
                    <td className="py-2.5 pr-4 text-end tabular-nums text-success">
                      {num.format(b.paid)}
                    </td>
                    <td className="py-2.5 pr-4 text-end tabular-nums text-warning">
                      {num.format(b.approved)}
                    </td>
                    <td className="py-2.5 pr-4 text-end tabular-nums text-muted-foreground">
                      {num.format(b.submitted)}
                    </td>
                    <td className="py-2.5 pr-4 text-end tabular-nums">{sar.format(b.gross)}</td>
                    <td className="py-2.5 pr-4 text-end tabular-nums text-destructive">
                      {b.deduction > 0 ? `−${sar.format(b.deduction)}` : sar.format(0)}
                    </td>
                    <td className="py-2.5 pr-4 text-end tabular-nums font-semibold">
                      {sar.format(b.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-3">
        <ChartCard
          title="Warranty Rate Card"
          subtitle="Official tariff per repair job tier"
          className="xl:col-span-1"
        >
          <ul className="space-y-2">
            {WARRANTY_TIERS.map((t) => {
              const row = w.byTier.find((x) => x.tier === t.tier);
              return (
                <li
                  key={t.tier}
                  className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{t.label}</span>
                    <span className="tabular-nums text-primary font-semibold">
                      {sar.format(t.rate)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug" dir="rtl">
                    {t.description}
                  </p>
                  {row && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{num.format(row.claims)} claims</span>
                      <span className="tabular-nums">Net {sar.format(row.net)}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Tier is auto-detected from <em>Maintenance Instructions</em>, <em>Reasons Supplemented</em>,{" "}
            and <em>Completion Result</em> using Arabic + English keywords. Tickets with no match fall
            back to the base 220 SAR service tier. A {WARRANTY_SLA_DEDUCTION_PCT}% deduction applies
            when completion exceeds 72h.
          </p>
        </ChartCard>

        <ChartCard
          title="Recent Claims"
          subtitle={`Latest ${w.recentClaims.length} — export CSV for the full list`}
          className="xl:col-span-2"
          exportRows={w.recentClaims.map((c) => ({
            Ticket: c.ticket,
            Branch: c.branch,
            City: c.city,
            Product: c.productLine,
            Tier: c.tierLabel,
            Status: c.status,
            Created: c.createdAt,
            Completed: c.completedAt,
            Hours: c.serviceHours,
            Gross: c.gross,
            Deduction: c.deduction,
            Net: c.net,
          }))}
        >
          {w.recentClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No warranty claims yet.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <SortableTh sortKey="ticket" currentKey={claimsSort.sortKey} currentDir={claimsSort.sortDir} onSort={claimsSort.toggle} className="py-2 pr-4 text-start">Ticket</SortableTh>
                    <SortableTh sortKey="branch" currentKey={claimsSort.sortKey} currentDir={claimsSort.sortDir} onSort={claimsSort.toggle} className="py-2 pr-4 text-start">Branch</SortableTh>
                    <SortableTh sortKey="tier" currentKey={claimsSort.sortKey} currentDir={claimsSort.sortDir} onSort={claimsSort.toggle} className="py-2 pr-4 text-start">Tier</SortableTh>
                    <SortableTh sortKey="status" align="center" currentKey={claimsSort.sortKey} currentDir={claimsSort.sortDir} onSort={claimsSort.toggle} className="py-2 pr-4 text-center">Status</SortableTh>
                    <SortableTh sortKey="net" align="end" currentKey={claimsSort.sortKey} currentDir={claimsSort.sortDir} onSort={claimsSort.toggle} className="py-2 pr-4 text-end">Net</SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {claimsSort.sorted.map((c) => (
                    <tr key={c.ticket} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4 font-mono text-[11px] text-muted-foreground">
                        {c.ticket}
                      </td>
                      <td className="py-2 pr-4 text-xs">{c.branch}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{c.tierLabel}</td>
                      <td className="py-2 pr-4 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                            c.status === "paid" && "bg-success/15 text-success",
                            c.status === "approved" && "bg-warning/15 text-warning",
                            c.status === "submitted" && "bg-muted text-muted-foreground",
                          )}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-end tabular-nums font-medium">
                        {sar.format(c.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}