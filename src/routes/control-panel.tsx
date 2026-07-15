import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Settings2, UploadCloud, CheckCircle2, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { uploadsQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/control-panel")({
  loader: ({ context }) => context.queryClient.ensureQueryData(uploadsQueryOptions),
  head: () => ({
    meta: [
      { title: "Control Panel — AUX ASC Dashboard" },
      { name: "description", content: "Data pipeline health from the UploadLogs tab: last runs, row counts and errors." },
    ],
  }),
  component: ControlPanelPage,
});

const num = new Intl.NumberFormat("en-US");

function statusPill(s: string) {
  const t = (s || "").toLowerCase();
  const cls = t.includes("success")
    ? "bg-success/15 text-success"
    : t.includes("fail") || t.includes("error")
    ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{s || "—"}</span>;
}

function ControlPanelPage() {
  const { data } = useSuspenseQuery(uploadsQueryOptions);
  return (
    <DashboardLayout title="Control Panel" subtitle="Data pipeline health (live from UploadLogs tab)">
      {data.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Sheet error: {data.error}</div>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Runs" value={num.format(data.total)} icon={UploadCloud} tone="primary" />
        <KpiCard label="Successful" value={num.format(data.success)} icon={CheckCircle2} tone="success" />
        <KpiCard label="Failed" value={num.format(data.failed)} icon={XCircle} tone="destructive" />
        <KpiCard label="Last Run" value={data.lastStatus} hint={`${num.format(data.lastRows)} rows`} icon={Settings2} tone="accent" />
      </section>

      <ChartCard title="Pipelines" exportRows={data.byAction}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Action</th>
                <th className="p-2 text-right">Runs</th>
                <th className="p-2 text-right">Last Rows</th>
                <th className="p-2 text-left">Last Run</th>
              </tr>
            </thead>
            <tbody>
              {data.byAction.map((a) => (
                <tr key={a.action} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{a.action}</td>
                  <td className="p-2 text-right">{num.format(a.runs)}</td>
                  <td className="p-2 text-right">{num.format(a.lastRows)}</td>
                  <td className="p-2 text-muted-foreground">{a.lastRun}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard title="Recent Upload Runs" exportRows={data.recent}>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Action</th>
                <th className="p-2 text-right">Rows</th>
                <th className="p-2 text-right">Cols</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r, i) => (
                <tr key={`${r.timestamp}-${i}`} className="border-t border-border">
                  <td className="p-2 text-xs text-muted-foreground">{r.timestamp}</td>
                  <td className="p-2 font-mono text-xs">{r.action}</td>
                  <td className="p-2 text-right">{num.format(r.rows)}</td>
                  <td className="p-2 text-right">{num.format(r.columns)}</td>
                  <td className="p-2">{statusPill(r.status)}</td>
                  <td className="p-2 text-muted-foreground">{r.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </DashboardLayout>
  );
}
