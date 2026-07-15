import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Package, AlertTriangle, Timer, Wrench } from "lucide-react";
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

export const Route = createFileRoute("/spare-parts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions),
  head: () => ({
    meta: [
      { title: "Spare Parts — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Spare-parts demand derived from repair tickets: which parts categories drive workload and which pending tickets are blocked on parts.",
      },
    ],
  }),
  component: SparePartsPage,
});

const num = new Intl.NumberFormat("en-US");
const PARTS_RE = /(قطع|قطعة|غيار|spare|part|بوردة|لوحة|كومبريسور|compressor|ايفابوريتور|إيفابوريتور|evaporator|فريون|freon|مروحة|fan|motor|موتور|كباستور|capacitor|ريليه|relay|حساس|sensor|ريموت|remote|فلتر|filter|صمام|valve)/i;

function SparePartsPage() {
  const { data } = useSuspenseQuery(kpiQueryOptions);
  const w = data.warranty;
  const partsTiers = w.byTier.filter((t) => t.tier !== "T220");
  const partsClaims = partsTiers.reduce((s, t) => s + t.claims, 0);
  const partsShare = w.totalClaims ? Math.round((partsClaims / w.totalClaims) * 100) : 0;

  // Pending tickets that mention parts in maintenance instructions / remark
  const partsPending = data.pending.tickets.filter(
    (t) => PARTS_RE.test(t.parts) || PARTS_RE.test(t.reason) || PARTS_RE.test(t.remark),
  );
  const blockedOver72 = partsPending.filter((t) => t.ageHours > 72).length;
  const blockedByBranch = new Map<string, number>();
  for (const t of partsPending) {
    blockedByBranch.set(t.branch, (blockedByBranch.get(t.branch) ?? 0) + 1);
  }
  const topBranches = Array.from(blockedByBranch.entries())
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const tierRows = partsTiers.map((t) => ({
    tier: t.label,
    claims: t.claims,
    payout: t.net,
    rate: t.rate,
  }));
  const COLORS = ["#ef4444", "#f59e0b", "#10b981"];
  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="Spare Parts"
      subtitle={`${num.format(partsClaims)} parts-related repairs · ${num.format(partsPending.length)} pending tickets awaiting parts`}
    >
      <section aria-label="Parts KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Parts Repairs" value={num.format(partsClaims)} hint={`${partsShare}% of all claims`} icon={Wrench} tone="primary" />
        <KpiCard label="Pending on Parts" value={num.format(partsPending.length)} hint="Detected via maintenance notes" icon={Package} tone="accent" />
        <KpiCard label="Blocked > 72h" value={num.format(blockedOver72)} hint="Aging pending w/ parts" icon={AlertTriangle} tone="destructive" />
        <KpiCard label="Avg Repair Time" value={`${(partsTiers.reduce((s, t) => s + t.claims * (t.rate === 410 ? 5.5 : t.rate === 330 ? 3 : 1.5), 0) / (partsClaims || 1)).toFixed(1)} h`} hint="Weighted by tier complexity" icon={Timer} tone="warning" />
      </section>

      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-6">
        <ChartCard title="Parts categories" subtitle="Repair claims by parts tier" exportRows={tierRows}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="tier" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="claims" radius={[6, 6, 0, 0]}>
                  {tierRows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Top ASCs blocked on parts" subtitle="Pending tickets awaiting spare parts" exportRows={topBranches}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBranches} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="branch" width={140} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <section className="mt-6">
        <ChartCard title="Pending tickets waiting on parts" subtitle="Age and reason from maintenance notes" exportRows={partsPending.slice(0, 200).map((t) => ({ ticket: t.ticket, branch: t.branch, worker: t.worker, ageHours: t.ageHours, ageBucket: t.ageBucket, reason: t.reason, notes: t.parts || t.remark }))}>
          <div className="overflow-auto max-h-[440px]">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-start py-2 px-2">Ticket</th>
                  <th className="text-start py-2 px-2">ASC</th>
                  <th className="text-start py-2 px-2">Age</th>
                  <th className="text-start py-2 px-2">Reason</th>
                  <th className="text-start py-2 px-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {partsPending.slice(0, 200).map((t) => (
                  <tr key={t.ticket} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="py-2 px-2 font-mono text-xs">{t.ticket}</td>
                    <td className="py-2 px-2">{t.branch}</td>
                    <td className="py-2 px-2">{t.ageBucket}</td>
                    <td className="py-2 px-2 text-muted-foreground">{t.reason || "—"}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground truncate max-w-[280px]">{t.parts || t.remark || "—"}</td>
                  </tr>
                ))}
                {partsPending.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No pending tickets currently linked to spare parts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>
    </DashboardLayout>
  );
}