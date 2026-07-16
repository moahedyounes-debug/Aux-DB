import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ticket-repair-history")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Ticket Repair History — AUX ASC Dashboard" },
      { name: "description", content: "Searchable full history of repair tickets with status, branch, worker and SLA." },
      { property: "og:title", content: "Ticket Repair History — AUX ASC Dashboard" },
      { property: "og:description", content: "Search, filter and export the full ticket log." },
    ],
  }),
  component: HistoryPage,
});

const num = new Intl.NumberFormat("en-US");

function HistoryPage() {
  const { data } = useSuspenseQuery(kpiQueryOptions());
  // Combine all ticket sources into one searchable log
  const all = useMemo(() => {
    const rows: Array<{
      ticket: string; branch: string; worker: string; status: string;
      createdAt: string; completedAt: string; type: string; product: string;
      completed: boolean;
    }> = [];
    for (const t of data.pending.tickets) {
      rows.push({
        ticket: t.ticket, branch: t.branch, worker: t.worker, status: t.status,
        createdAt: t.appointedDate, completedAt: "—", type: "Repair",
        product: t.parts, completed: false,
      });
    }
    for (const w of data.warranty.recentClaims) {
      rows.push({
        ticket: w.ticket, branch: w.branch, worker: "—", status: w.status,
        createdAt: w.createdAt, completedAt: w.completedAt, type: `Repair · ${w.tierLabel}`,
        product: w.productLine, completed: w.status !== "submitted",
      });
    }
    for (const i of data.installation.tickets) {
      rows.push({
        ticket: i.ticket, branch: i.branch, worker: i.worker, status: i.status,
        createdAt: i.createdAt, completedAt: i.completed ? i.installationDate : "—",
        type: "Installation", product: i.productLine, completed: i.completed,
      });
    }
    // dedupe by ticket, prefer completed record
    const seen = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      const prev = seen.get(r.ticket);
      if (!prev || (r.completed && !prev.completed)) seen.set(r.ticket, r);
    }
    return Array.from(seen.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [data]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "completed" | "pending">("all");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((r) => {
      if (status === "completed" && !r.completed) return false;
      if (status === "pending" && r.completed) return false;
      if (!term) return true;
      return (
        r.ticket.toLowerCase().includes(term) ||
        r.branch.toLowerCase().includes(term) ||
        r.worker.toLowerCase().includes(term) ||
        r.product.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term)
      );
    });
  }, [all, q, status]);

  return (
    <DashboardLayout title="Ticket Repair History" subtitle={`${num.format(all.length)} unique tickets · searchable + exportable`}>
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Tickets" value={num.format(all.length)} icon={History} tone="primary" />
        <KpiCard label="Completed" value={num.format(all.filter((r) => r.completed).length)} icon={History} tone="success" />
        <KpiCard label="Pending" value={num.format(all.filter((r) => !r.completed).length)} icon={History} tone="warning" />
        <KpiCard label="Showing" value={num.format(filtered.length)} hint="After filters" icon={Search} tone="accent" />
      </section>

      <div className="mt-6">
        <ChartCard
          title="Ticket Log"
          subtitle="Full searchable history — export the filtered rows"
          exportRows={filtered.map((r) => ({
            Ticket: r.ticket, Branch: r.branch, Worker: r.worker, Type: r.type,
            Product: r.product, Status: r.status, Created: r.createdAt, Completed: r.completedAt,
          }))}
        >
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ticket, branch, worker, product…"
                className="w-full ps-10 pe-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {(["all", "completed", "pending"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md capitalize transition-colors",
                    status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Ticket</th>
                  <th className="py-2 pr-4 text-start">Type</th>
                  <th className="py-2 pr-4 text-start">Branch</th>
                  <th className="py-2 pr-4 text-start">Worker</th>
                  <th className="py-2 pr-4 text-start">Product</th>
                  <th className="py-2 pr-4 text-start">Status</th>
                  <th className="py-2 pr-4 text-start">Created</th>
                  <th className="py-2 pr-4 text-start">Completed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r) => (
                  <tr key={r.ticket} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-mono text-[11px] text-muted-foreground">{r.ticket}</td>
                    <td className="py-2 pr-4 text-xs">{r.type}</td>
                    <td className="py-2 pr-4 text-xs">{r.branch}</td>
                    <td className="py-2 pr-4 text-xs">{r.worker}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground truncate max-w-[200px]">{r.product}</td>
                    <td className="py-2 pr-4">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                        r.completed ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                      )}>{r.status}</span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{r.createdAt}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{r.completedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <p className="text-center py-3 text-xs text-muted-foreground">
                Showing first 500 of {num.format(filtered.length)} · use export for the full set
              </p>
            )}
          </div>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}