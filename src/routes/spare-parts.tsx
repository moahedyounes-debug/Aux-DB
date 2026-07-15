import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Package, PackageCheck, Timer, Layers } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { partsQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/spare-parts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(partsQueryOptions),
  head: () => ({
    meta: [
      { title: "Spare Parts — AUX ASC Dashboard" },
      { name: "description", content: "Spare-parts request log from the ops sheet: status, branches, top parts and monthly demand." },
    ],
  }),
  component: SparePartsPage,
});

const num = new Intl.NumberFormat("en-US");

function SparePartsPage() {
  const { data } = useSuspenseQuery(partsQueryOptions);
  return (
    <DashboardLayout title="Spare Parts" subtitle="Parts request pipeline (live from Parts tab)">
      {data.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Sheet error: {data.error}
        </div>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Requests" value={num.format(data.total)} icon={Package} tone="primary" />
        <KpiCard label="Received" value={num.format(data.received)} icon={PackageCheck} tone="success" hint={`${data.dispatched} dispatched`} />
        <KpiCard label="Pending" value={num.format(data.pending)} icon={Timer} tone="warning" />
        <KpiCard label="Unique Parts" value={num.format(data.uniqueParts)} icon={Layers} tone="accent" hint={`${num.format(data.totalQty)} units`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Requests by Status" exportRows={data.byStatus as unknown as Array<Record<string, unknown>>}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Requests" exportRows={data.byMonth as unknown as Array<Record<string, unknown>>}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="By Branch" exportRows={data.byBranch as unknown as Array<Record<string, unknown>>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Branch</th>
                  <th className="p-2 text-right">Requests</th>
                  <th className="p-2 text-right">Received</th>
                  <th className="p-2 text-right">Pending</th>
                  <th className="p-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.byBranch.slice(0, 15).map((b) => (
                  <tr key={b.branch} className="border-t border-border">
                    <td className="p-2">{b.branch}</td>
                    <td className="p-2 text-right">{num.format(b.requests)}</td>
                    <td className="p-2 text-right text-success">{num.format(b.received)}</td>
                    <td className="p-2 text-right text-warning">{num.format(b.pending)}</td>
                    <td className="p-2 text-right">{num.format(b.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        <ChartCard title="Top Requested Parts" exportRows={data.topParts as unknown as Array<Record<string, unknown>>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Part #</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {data.topParts.map((p) => (
                  <tr key={p.part} className="border-t border-border">
                    <td className="p-2 font-mono text-xs">{p.part}</td>
                    <td className="p-2">{p.description}</td>
                    <td className="p-2 text-right">{num.format(p.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>

      <ChartCard title="Recent Requests" exportRows={data.recent as unknown as Array<Record<string, unknown>>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Order</th>
                <th className="p-2 text-left">Part #</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Branch</th>
                <th className="p-2 text-left">Requested</th>
                <th className="p-2 text-left">Received</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.slice(0, 50).map((r, i) => (
                <tr key={`${r.order}-${i}`} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{r.order}</td>
                  <td className="p-2 font-mono text-xs">{r.partNumber}</td>
                  <td className="p-2">{r.description}</td>
                  <td className="p-2">{r.branch}</td>
                  <td className="p-2">{r.requestDate}</td>
                  <td className="p-2">{r.receivingDate}</td>
                  <td className="p-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </DashboardLayout>
  );
}
