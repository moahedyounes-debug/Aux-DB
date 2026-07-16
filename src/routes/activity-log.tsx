import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { History, Users, LayoutDashboard, Clock } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { activityQueryOptions } from "@/lib/aux/queries";
import { SortableTh, useSort } from "@/components/ui/sortable-th";

export const Route = createFileRoute("/activity-log")({
  loader: ({ context }) => context.queryClient.ensureQueryData(activityQueryOptions),
  head: () => ({
    meta: [
      { title: "Activity Log — AUX ASC Dashboard" },
      { name: "description", content: "User sessions and page views from the ActiveUsers tab." },
    ],
  }),
  component: ActivityPage,
});

const num = new Intl.NumberFormat("en-US");

function ActivityPage() {
  const { data } = useSuspenseQuery(activityQueryOptions);
  const userSort = useSort(data.byUser, {
    email: (u) => u.email,
    count: (u) => u.count,
    lastSeen: (u) => u.lastSeen,
  });
  const recentView = data.recent.slice(0, 100);
  const recentSort = useSort(recentView, {
    timestamp: (r) => r.timestamp,
    email: (r) => r.email,
    asc: (r) => r.asc,
    page: (r) => r.page,
    action: (r) => r.action,
  });
  return (
    <DashboardLayout title="Activity Log" subtitle="Who's using the dashboard (live from ActiveUsers tab)">
      {data.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Sheet error: {data.error}</div>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Events" value={num.format(data.total)} icon={History} tone="primary" />
        <KpiCard label="Active Users" value={num.format(data.activeUsers)} icon={Users} tone="accent" />
        <KpiCard label="Unique Pages" value={num.format(data.uniquePages)} icon={LayoutDashboard} tone="success" />
        <KpiCard label="Days Tracked" value={num.format(data.byDay.length)} icon={Clock} tone="warning" />
      </section>

      <ChartCard title="Daily Activity (last 30 days)" exportRows={data.byDay as unknown as Array<Record<string, unknown>>}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top Pages" exportRows={data.byPage as unknown as Array<Record<string, unknown>>}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byPage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="page" width={150} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Users" exportRows={data.byUser as unknown as Array<Record<string, unknown>>}>
          <div className="overflow-x-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                <tr>
                  <SortableTh sortKey="email" currentKey={userSort.sortKey} currentDir={userSort.sortDir} onSort={userSort.toggle} className="p-2 text-left">User</SortableTh>
                  <SortableTh sortKey="count" align="end" currentKey={userSort.sortKey} currentDir={userSort.sortDir} onSort={userSort.toggle} className="p-2 text-right">Events</SortableTh>
                  <SortableTh sortKey="lastSeen" currentKey={userSort.sortKey} currentDir={userSort.sortDir} onSort={userSort.toggle} className="p-2 text-left">Last Seen</SortableTh>
                </tr>
              </thead>
              <tbody>
                {userSort.sorted.map((u) => (
                  <tr key={u.email} className="border-t border-border">
                    <td className="p-2 font-mono text-xs">{u.email}</td>
                    <td className="p-2 text-right">{num.format(u.count)}</td>
                    <td className="p-2 text-muted-foreground">{u.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>

      <ChartCard title="Recent Activity" exportRows={data.recent as unknown as Array<Record<string, unknown>>}>
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <SortableTh sortKey="timestamp" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">Time</SortableTh>
                <SortableTh sortKey="email" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">User</SortableTh>
                <SortableTh sortKey="asc" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">ASC</SortableTh>
                <SortableTh sortKey="page" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">Page</SortableTh>
                <SortableTh sortKey="action" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">Action</SortableTh>
              </tr>
            </thead>
            <tbody>
              {recentSort.sorted.map((r, i) => (
                <tr key={`${r.email}-${i}`} className="border-t border-border">
                  <td className="p-2 text-xs text-muted-foreground">{r.timestamp}</td>
                  <td className="p-2 font-mono text-xs">{r.email}</td>
                  <td className="p-2">{r.asc}</td>
                  <td className="p-2">{r.page}</td>
                  <td className="p-2">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </DashboardLayout>
  );
}
