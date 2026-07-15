import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { BRANCHES, TARGETS } from "@/lib/aux/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kpis")({
  head: () => ({
    meta: [
      { title: "KPI Scorecard — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Per-branch KPI scorecard: totals, 48h/72h completion vs targets, pending backlog, and CSAT.",
      },
      { property: "og:title", content: "KPI Scorecard — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Branch-by-branch performance vs SLA targets.",
      },
    ],
  }),
  component: KpisPage,
});

const fmt = new Intl.NumberFormat("en-US");

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

function KpisPage() {
  const sorted = [...BRANCHES].sort((a, b) => b.rate48h - a.rate48h);
  return (
    <DashboardLayout
      title="KPI Scorecard"
      subtitle="Branch performance versus SLA targets"
    >
      <ChartCard
        title="Branch Scorecard"
        subtitle={`Targets — 48h ≥ ${TARGETS.rate48h}% · 72h ≥ ${TARGETS.rate72h}% · Pending ≤ ${TARGETS.pendingRate}%`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4 text-start">Branch</th>
                <th className="py-2 pr-4 text-start">City</th>
                <th className="py-2 pr-4 text-end">Total</th>
                <th className="py-2 pr-4 text-end">Completed</th>
                <th className="py-2 pr-4 text-end">Pending</th>
                <th className="py-2 pr-4 text-end">48h</th>
                <th className="py-2 pr-4 text-end">72h</th>
                <th className="py-2 pr-4 text-end">CSAT</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => {
                const pRate = (b.pending / b.total) * 100;
                return (
                  <tr key={b.branch} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{b.branch}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{b.city}</td>
                    <td className="py-2.5 pr-4 text-end tabular-nums">{fmt.format(b.total)}</td>
                    <td className="py-2.5 pr-4 text-end tabular-nums text-success">
                      {fmt.format(b.completed)}
                    </td>
                    <td className="py-2.5 pr-4 text-end">
                      <Badge ok={pRate <= TARGETS.pendingRate}>
                        {fmt.format(b.pending)} · {pRate.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-end">
                      <Badge ok={b.rate48h >= TARGETS.rate48h}>{b.rate48h}%</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-end">
                      <Badge ok={b.rate72h >= TARGETS.rate72h}>{b.rate72h}%</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-end">
                      <Badge ok={b.csat >= 85}>{b.csat}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </DashboardLayout>
  );
}