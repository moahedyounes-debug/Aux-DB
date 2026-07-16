import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Package, ArrowDownToLine, ArrowUpFromLine, Layers } from "lucide-react";
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
        <KpiCard label="Total Transactions" value={num.format(data.total)} icon={Package} tone="primary" />
        <KpiCard label="In (Received)" value={num.format(data.inCount)} icon={ArrowDownToLine} tone="success" />
        <KpiCard label="Out (Delivered)" value={num.format(data.outCount)} icon={ArrowUpFromLine} tone="warning" />
        <KpiCard label="Unique Parts" value={num.format(data.uniqueParts)} icon={Layers} tone="accent" hint={`${num.format(data.totalQty)} units`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Trading Direction" exportRows={data.byStatus as unknown as Array<Record<string, unknown>>}>
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
        <ChartCard title="Requests by Type" exportRows={data.byType as unknown as Array<Record<string, unknown>>}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byType} layout="vertical" margin={{ left: 24, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={160} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
            </BarChart>
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
                  <th className="p-2 text-right">Transactions</th>
                  <th className="p-2 text-right">In Qty</th>
                  <th className="p-2 text-right">Out Qty</th>
                  <th className="p-2 text-right">Total Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.byBranch.slice(0, 15).map((b) => (
                  <tr key={b.branch} className="border-t border-border">
                    <td className="p-2">{b.branch}</td>
                    <td className="p-2 text-right">{num.format(b.transactions)}</td>
                    <td className="p-2 text-right text-success">{num.format(b.inQty)}</td>
                    <td className="p-2 text-right text-warning">{num.format(b.outQty)}</td>
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
                <th className="p-2 text-left">Model</th>
                <th className="p-2 text-left">Branch</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-left">Direction</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.slice(0, 50).map((r, i) => (
                <tr key={`${r.order}-${i}`} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{r.order}</td>
                  <td className="p-2 font-mono text-xs">{r.partNumber}</td>
                  <td className="p-2">{r.description}</td>
                  <td className="p-2 text-xs">{r.model}</td>
                  <td className="p-2">{r.branch}</td>
                  <td className="p-2 text-right">{num.format(r.qty)}</td>
                  <td className="p-2 text-xs">{r.direction}</td>
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
