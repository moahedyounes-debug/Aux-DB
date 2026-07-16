import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Settings2, UploadCloud, CheckCircle2, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { uploadsQueryOptions } from "@/lib/aux/queries";
import { SortableTh, useSort } from "@/components/ui/sortable-th";

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
  const actionSort = useSort(data.byAction, {
    action: (a) => a.action,
    runs: (a) => a.runs,
    lastRows: (a) => a.lastRows,
    lastRun: (a) => a.lastRun,
  });
  const recentSort = useSort(data.recent, {
    timestamp: (r) => r.timestamp,
    action: (r) => r.action,
    rows: (r) => r.rows,
    columns: (r) => r.columns,
    status: (r) => r.status,
    notes: (r) => r.notes,
  });
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

      <ChartCard title="Pipelines" exportRows={data.byAction as unknown as Array<Record<string, unknown>>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <SortableTh sortKey="action" currentKey={actionSort.sortKey} currentDir={actionSort.sortDir} onSort={actionSort.toggle} className="p-2 text-left">Action</SortableTh>
                <SortableTh sortKey="runs" align="end" currentKey={actionSort.sortKey} currentDir={actionSort.sortDir} onSort={actionSort.toggle} className="p-2 text-right">Runs</SortableTh>
                <SortableTh sortKey="lastRows" align="end" currentKey={actionSort.sortKey} currentDir={actionSort.sortDir} onSort={actionSort.toggle} className="p-2 text-right">Last Rows</SortableTh>
                <SortableTh sortKey="lastRun" currentKey={actionSort.sortKey} currentDir={actionSort.sortDir} onSort={actionSort.toggle} className="p-2 text-left">Last Run</SortableTh>
              </tr>
            </thead>
            <tbody>
              {actionSort.sorted.map((a) => (
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

      <ChartCard title="Recent Upload Runs" exportRows={data.recent as unknown as Array<Record<string, unknown>>}>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <SortableTh sortKey="timestamp" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">Time</SortableTh>
                <SortableTh sortKey="action" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">Action</SortableTh>
                <SortableTh sortKey="rows" align="end" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-right">Rows</SortableTh>
                <SortableTh sortKey="columns" align="end" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-right">Cols</SortableTh>
                <SortableTh sortKey="status" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">Status</SortableTh>
                <SortableTh sortKey="notes" currentKey={recentSort.sortKey} currentDir={recentSort.sortDir} onSort={recentSort.toggle} className="p-2 text-left">Notes</SortableTh>
              </tr>
            </thead>
            <tbody>
              {recentSort.sorted.map((r, i) => (
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
