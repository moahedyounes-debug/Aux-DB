import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { XCircle, RotateCcw, AlertTriangle, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useKpiData } from "@/hooks/use-kpi-data";

export const Route = createFileRoute("/rejected-returned")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Rejected / Returned — AUX ASC Dashboard" },
      { name: "description", content: "Rescheduled, rejected and cancelled tickets analyzed by reason, branch and product." },
      { property: "og:title", content: "Rejected / Returned — AUX ASC Dashboard" },
      { property: "og:description", content: "Understand why tickets get rescheduled or returned." },
    ],
  }),
  component: RejectedPage,
});

const num = new Intl.NumberFormat("en-US");
const COLORS = ["#ef4444", "#f97316", "#eab308", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899", "#6366f1"];

function RejectedPage() {
  const { data } = useKpiData();
  const rescheduledCount = data.snapshot.rescheduled;
  const totalTickets = data.snapshot.total;
  const reschedRate = totalTickets > 0
    ? Math.round((rescheduledCount / totalTickets) * 1000) / 10 : 0;

  // Cancellations from call center + pending with cancel status
  const cancelledTickets = data.callCenter.tickets.filter((t) =>
    t.status.toLowerCase().includes("cancel") || t.status.toLowerCase().includes("reject"),
  );

  // Reasons breakdown (from pending reasons that are rejection/reschedule related)
  const reasons = data.pending.reasons.filter((r) =>
    r.reason !== "(No reason)" && r.reason !== "—",
  ).slice(0, 10);

  const branchReasons = data.pendingByBranch.slice(0, 12);

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout title="Rejected / Returned" subtitle="Rescheduling, rejections and cancellations analysis">
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Rescheduled" value={num.format(rescheduledCount)} hint={`${reschedRate}% of tickets`} icon={RotateCcw} tone="warning" />
        <KpiCard label="Cancelled / Rejected" value={num.format(cancelledTickets.length)} icon={XCircle} tone="destructive" />
        <KpiCard label="Reason Categories" value={num.format(reasons.length)} icon={AlertTriangle} tone="accent" />
        <KpiCard label="Rejection Rate" value={`${reschedRate}%`} hint="Rescheduled / total" icon={TrendingDown} tone="primary" />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Top Rejection Reasons"
          subtitle="From rescheduled + pending tickets"
          exportRows={reasons.map((r) => ({ Reason: r.reason, Count: r.count }))}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={reasons} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="reason" stroke="var(--color-muted-foreground)" fontSize={10} width={180} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-destructive)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Reason Distribution"
          subtitle="Share of top reasons"
          exportRows={reasons.map((r) => ({ Reason: r.reason, Count: r.count }))}
        >
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie data={reasons} dataKey="count" nameKey="reason" outerRadius={110} label={(e) => `${e.count}`}>
                {reasons.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Pending Pressure by Branch"
          subtitle="Branches with most stuck tickets"
          exportRows={branchReasons.map((b) => ({ Branch: b.branch, Pending: b.count }))}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={branchReasons} margin={{ top: 8, right: 8, bottom: 60, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="branch" stroke="var(--color-muted-foreground)" fontSize={10} angle={-35} textAnchor="end" height={80} interval={0} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-warning)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Recent Cancellations"
          subtitle={`${cancelledTickets.length} tickets · latest first`}
          exportRows={cancelledTickets.map((t) => ({
            Ticket: t.ticket, Branch: t.branch, Type: t.serviceType, Status: t.status,
            Reason: t.reason, Created: t.createdAt, Worker: t.worker,
          }))}
        >
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Ticket</th>
                  <th className="py-2 pr-4 text-start">Branch</th>
                  <th className="py-2 pr-4 text-start">Status</th>
                  <th className="py-2 pr-4 text-start">Reason</th>
                </tr>
              </thead>
              <tbody>
                {cancelledTickets.slice(0, 100).map((t) => (
                  <tr key={t.ticket} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-mono text-[11px] text-muted-foreground">{t.ticket}</td>
                    <td className="py-2 pr-4 text-xs">{t.branch}</td>
                    <td className="py-2 pr-4 text-xs">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] bg-destructive/15 text-destructive">{t.status}</span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground truncate max-w-[240px]">{t.reason}</td>
                  </tr>
                ))}
                {cancelledTickets.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">No cancelled tickets found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}