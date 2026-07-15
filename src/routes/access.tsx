import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ShieldCheck, Users, Wrench, Headphones } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { accessQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/access")({
  loader: ({ context }) => context.queryClient.ensureQueryData(accessQueryOptions),
  head: () => ({
    meta: [
      { title: "Access — AUX ASC Dashboard" },
      { name: "description", content: "User accounts, roles and branch permissions from the Access tab." },
    ],
  }),
  component: AccessPage,
});

const num = new Intl.NumberFormat("en-US");

function badge(v: string) {
  const s = (v || "").trim();
  const yes = s.toLowerCase() === "yes";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${yes ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
      {s || "—"}
    </span>
  );
}

function AccessPage() {
  const { data } = useSuspenseQuery(accessQueryOptions);
  return (
    <DashboardLayout title="Access" subtitle="Users, roles and branch permissions (live from Access tab)">
      {data.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Sheet error: {data.error}</div>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Users" value={num.format(data.total)} icon={Users} tone="primary" />
        <KpiCard label="Admins" value={num.format(data.admins)} icon={ShieldCheck} tone="accent" />
        <KpiCard label="Call Center" value={num.format(data.callCenter)} icon={Headphones} tone="success" />
        <KpiCard label="Parts Access" value={num.format(data.partsAccess)} icon={Wrench} tone="warning" />
      </section>

      <ChartCard title="Users by ASC" exportRows={data.byASC}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">ASC</th>
                <th className="p-2 text-right">Users</th>
              </tr>
            </thead>
            <tbody>
              {data.byASC.map((r) => (
                <tr key={r.asc} className="border-t border-border">
                  <td className="p-2">{r.asc}</td>
                  <td className="p-2 text-right">{num.format(r.users)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard title="User Directory" exportRows={data.users}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">ASC</th>
                <th className="p-2 text-left">Pending Branch</th>
                <th className="p-2 text-left">Admin</th>
                <th className="p-2 text-left">Parts</th>
                <th className="p-2 text-left">Call Center</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.email} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{u.email}</td>
                  <td className="p-2">{u.asc}</td>
                  <td className="p-2 text-muted-foreground">{u.pendingBranch || "—"}</td>
                  <td className="p-2">{badge(u.adminAccess)}</td>
                  <td className="p-2">{badge(u.parts)}</td>
                  <td className="p-2">{badge(u.callCenter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </DashboardLayout>
  );
}
