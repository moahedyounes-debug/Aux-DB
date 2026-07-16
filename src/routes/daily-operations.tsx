import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Package, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { checkPartStock, type StockCheckResult } from "@/lib/aux/parts-stock.functions";
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
import { CalendarCheck2, Clock, Users, Send, UserX } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useKpiData } from "@/hooks/use-kpi-data";
import { cn } from "@/lib/utils";
import { SortableTh, useSort } from "@/components/ui/sortable-th";

export const Route = createFileRoute("/daily-operations")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kpiQueryOptions()),
  head: () => ({
    meta: [
      { title: "Daily Operations — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Today's pending work queue: visits scheduled for today, aging distribution, reschedule reasons, per-branch pivot and alerts.",
      },
      { property: "og:title", content: "Daily Operations — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Pending-tickets work queue with branch pivot and alerts.",
      },
    ],
  }),
  component: DailyOpsPage,
});

const fmt = new Intl.NumberFormat("en-US");
const AGING_COLORS: Record<string, string> = {
  "≤ 12 Hours": "var(--color-success)",
  "≤ 24 Hours": "var(--color-chart-2)",
  "≤ 48 Hours": "var(--color-warning)",
  "≤ 72 Hours": "var(--color-destructive)",
  "> 72 Hours": "var(--color-foreground)",
};

function AgingBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (count / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[110px_1fr_40px] items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${count > 0 ? pct : 0}%`, background: AGING_COLORS[label] ?? "var(--color-chart-1)" }}
        />
      </div>
      <span className="text-xs font-medium text-end tabular-nums">{count}</span>
    </div>
  );
}

function AgingBadge({ bucket }: { bucket: string }) {
  const s = bucket;
  const tone = s === "≤ 12 Hours"
    ? "bg-success/15 text-success"
    : s === "≤ 24 Hours"
      ? "bg-primary/15 text-primary"
      : s === "≤ 48 Hours"
        ? "bg-warning/15 text-warning"
        : s === "≤ 72 Hours"
          ? "bg-destructive/15 text-destructive"
          : "bg-foreground/10 text-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>
      {bucket}
    </span>
  );
}

function DailyOpsPage() {
  const { data } = useKpiData();
  const p = data.pending;
  const maxAging = Math.max(1, ...p.aging.map((a) => a.count));
  const pivotSort = useSort(p.branchPivot, {
    branch: (r) => r.branch,
    b12: (r) => r.b12,
    b24: (r) => r.b24,
    b48: (r) => r.b48,
    b72: (r) => r.b72,
    over72: (r) => r.over72,
    total: (r) => r.total,
  });
  const alertsSort = useSort(p.branchAlerts, {
    branch: (r) => r.branch,
    pending: (r) => r.pending,
    noReason: (r) => r.noReason,
    visitToday: (r) => (r.visitToday ? 1 : 0),
  });
  const [reqTarget, setReqTarget] = useState<import("@/lib/aux/sheets.functions").PendingTicket | null>(null);
  const [partCode, setPartCode] = useState("");
  const [model, setModel] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stock, setStock] = useState<StockCheckResult | null>(null);

  const openRequest = (t: import("@/lib/aux/sheets.functions").PendingTicket) => {
    setReqTarget(t);
    setPartCode("");
    setModel("");
    setQty("1");
    setNotes("");
    setStock(null);
  };

  const runStockCheck = async (): Promise<StockCheckResult | null> => {
    if (!reqTarget) return null;
    setChecking(true);
    try {
      const res = await checkPartStock({ data: { branch: reqTarget.branch, partCode: partCode.trim(), model: model.trim() } });
      setStock(res);
      return res;
    } catch (e) {
      toast.error(`Stock check failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    } finally {
      setChecking(false);
    }
  };

  const submitRequest = async () => {
    if (!reqTarget) return;
    if (!partCode.trim() && !model.trim()) { toast.error("Part Code or Model required"); return; }
    if (!qty.trim() || Number(qty) <= 0) { toast.error("Quantity must be > 0"); return; }
    // Run stock check first (unless already run for these values)
    let s = stock;
    if (!s) {
      s = await runStockCheck();
      if (!s) return;
    }
    if (s.totalReceivedQty > 0) {
      // Warn; require another click to confirm
      toast.warning(`Branch already has ${s.totalReceivedQty} in stock — review then click Submit again to proceed.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/spare-part-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: reqTarget.ticket,
          branch: reqTarget.branch,
          worker: reqTarget.worker,
          partCode: partCode.trim(),
          model: model.trim(),
          quantity: qty.trim(),
          notes: notes.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`);
      toast.success(`Spare part request submitted (${d.requestId})`);
      setReqTarget(null);
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const forceSubmit = async () => {
    if (!reqTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/spare-part-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: reqTarget.ticket,
          branch: reqTarget.branch,
          worker: reqTarget.worker,
          partCode: partCode.trim(),
          model: model.trim(),
          quantity: qty.trim(),
          notes: notes.trim(),
          confirmed: true,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`);
      toast.success(`Spare part request submitted (${d.requestId})`);
      setReqTarget(null);
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout title="Daily Operations" subtitle="Today's Work Queue">
      <section aria-label="Today KPIs" className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Today's Visits"
          value={fmt.format(p.todayVisits)}
          hint="Rescheduled to today"
          icon={CalendarCheck2}
          tone="primary"
        />
        <KpiCard
          label="Total Pending"
          value={fmt.format(p.totalPending)}
          hint="Completion Result blank"
          icon={Clock}
          tone="warning"
        />
        <KpiCard
          label="Active Workers"
          value={fmt.format(p.activeWorkers)}
          hint="On today's schedule"
          icon={Users}
          tone="primary"
        />
        <KpiCard
          label="Dispatched (not accepted)"
          value={fmt.format(p.dispatched)}
          hint="Status = Dispatched Work"
          icon={Send}
          tone="warning"
        />
        <KpiCard
          label="No Worker Assigned"
          value={fmt.format(p.unassigned)}
          hint="Worker Name = blank"
          icon={UserX}
          tone="destructive"
        />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard title="Aging Distribution (Pending)" subtitle="Bucketed by ticket age">
          <div className="pt-2">
            {p.aging.map((a) => (
              <AgingBar key={a.bucket} label={a.bucket} count={a.count} max={maxAging} />
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Reschedule Reasons" subtitle="Top reasons for pending tickets">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={p.reasons.slice(0, 6)} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="reason"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 12) + "…" : v)}
              />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {p.reasons.slice(0, 6).map((r, i) => (
                  <Cell key={r.reason} fill={i === 0 ? "var(--color-destructive)" : "var(--color-primary)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="mt-6">
        <ChartCard
          title="Today's Visits (from Rescheduling date)"
          subtitle={`${p.todayTickets.length} tickets`}
          exportRows={p.todayTickets.map((t) => ({
            Ticket: t.ticket,
            Branch: t.branch,
            Worker: t.worker,
            Aging: t.ageBucket,
            Reason: t.reason,
            Date: t.appointedDate,
            Remark: t.remark,
          }))}
        >
          <PendingTable rows={p.todayTickets} emptyLabel="No visits scheduled for today." onRequestParts={openRequest} />
        </ChartCard>
      </section>

      <section className="mt-6">
        <ChartCard
          title="All Pending Tickets"
          subtitle={`${p.tickets.length} tickets`}
          exportRows={p.tickets.map((t) => ({
            Ticket: t.ticket,
            Branch: t.branch,
            Worker: t.worker,
            Aging: t.ageBucket,
            Reason: t.reason,
            Date: t.appointedDate,
            Remark: t.remark,
          }))}
        >
          <PendingTable rows={p.tickets} emptyLabel="No pending tickets." limit={50} onRequestParts={openRequest} />
        </ChartCard>
      </section>

      <section className="mt-6">
        <ChartCard
          title="Pending Summary — Pivot (Branch × Aging)"
          subtitle={`Pending by Service Center & Aging · ${p.totalPending} Pending`}
          exportRows={p.branchPivot.map((r) => ({
            Branch: r.branch,
            "≤12H": r.b12,
            "≤24H": r.b24,
            "≤48H": r.b48,
            "≤72H": r.b72,
            ">72H": r.over72,
            Total: r.total,
          }))}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <SortableTh sortKey="branch" currentKey={pivotSort.sortKey} currentDir={pivotSort.sortDir} onSort={pivotSort.toggle} className="py-2 pr-4 text-start">Branch</SortableTh>
                  <SortableTh sortKey="b12" align="end" currentKey={pivotSort.sortKey} currentDir={pivotSort.sortDir} onSort={pivotSort.toggle} className="py-2 pr-4 text-end">≤ 12H</SortableTh>
                  <SortableTh sortKey="b24" align="end" currentKey={pivotSort.sortKey} currentDir={pivotSort.sortDir} onSort={pivotSort.toggle} className="py-2 pr-4 text-end">≤ 24H</SortableTh>
                  <SortableTh sortKey="b48" align="end" currentKey={pivotSort.sortKey} currentDir={pivotSort.sortDir} onSort={pivotSort.toggle} className="py-2 pr-4 text-end">≤ 48H</SortableTh>
                  <SortableTh sortKey="b72" align="end" currentKey={pivotSort.sortKey} currentDir={pivotSort.sortDir} onSort={pivotSort.toggle} className="py-2 pr-4 text-end">≤ 72H</SortableTh>
                  <SortableTh sortKey="over72" align="end" currentKey={pivotSort.sortKey} currentDir={pivotSort.sortDir} onSort={pivotSort.toggle} className="py-2 pr-4 text-end">&gt; 72H</SortableTh>
                  <SortableTh sortKey="total" align="end" currentKey={pivotSort.sortKey} currentDir={pivotSort.sortDir} onSort={pivotSort.toggle} className="py-2 pr-4 text-end">Total</SortableTh>
                </tr>
              </thead>
              <tbody>
                {pivotSort.sorted.map((r) => (
                  <tr key={r.branch} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium text-foreground">{r.branch}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-muted-foreground">{r.b12 || ""}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-muted-foreground">{r.b24 || ""}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-muted-foreground">{r.b48 || ""}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-muted-foreground">{r.b72 || ""}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-muted-foreground">{r.over72 || ""}</td>
                    <td className="py-2 pr-4 text-end tabular-nums font-semibold">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>

      <section className="mt-6">
        <ChartCard
          title="Branch Alerts — Pending Notification"
          subtitle="Admin Only"
          exportRows={p.branchAlerts.map((r) => ({
            Branch: r.branch,
            Pending: r.pending,
            "No Reason": r.noReason,
            "Visit Today": r.visitToday ? "Yes" : "No",
          }))}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <SortableTh sortKey="branch" currentKey={alertsSort.sortKey} currentDir={alertsSort.sortDir} onSort={alertsSort.toggle} className="py-2 pr-4 text-start">Branch</SortableTh>
                  <SortableTh sortKey="pending" align="end" currentKey={alertsSort.sortKey} currentDir={alertsSort.sortDir} onSort={alertsSort.toggle} className="py-2 pr-4 text-end">Pending</SortableTh>
                  <SortableTh sortKey="noReason" align="end" currentKey={alertsSort.sortKey} currentDir={alertsSort.sortDir} onSort={alertsSort.toggle} className="py-2 pr-4 text-end">No Reason</SortableTh>
                  <SortableTh sortKey="visitToday" align="center" currentKey={alertsSort.sortKey} currentDir={alertsSort.sortDir} onSort={alertsSort.toggle} className="py-2 pr-4 text-center">Visit Today</SortableTh>
                  <th className="py-2 pr-4 text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {alertsSort.sorted.map((r) => (
                  <tr key={r.branch} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{r.branch}</td>
                    <td className="py-2.5 pr-4 text-end tabular-nums">{r.pending}</td>
                    <td className={cn(
                      "py-2.5 pr-4 text-end tabular-nums font-semibold",
                      r.noReason > 0 ? "text-destructive" : "text-muted-foreground",
                    )}>{r.noReason}</td>
                    <td className="py-2.5 pr-4 text-center">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        r.visitToday ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                      )}>
                        {r.visitToday ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-end">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-success-foreground hover:opacity-90 transition-opacity"
                        onClick={() =>
                          alert(
                            `Alert queued for ${r.branch}\nPending: ${r.pending}\nNo reason: ${r.noReason}`,
                          )
                        }
                      >
                        <Send className="h-3.5 w-3.5" /> Send Alert
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>

      <Dialog open={!!reqTarget} onOpenChange={(o) => { if (!o) setReqTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Spare Part</DialogTitle>
          </DialogHeader>
          {reqTarget && (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div><span className="block text-[10px] uppercase">Ticket</span><span className="font-mono text-foreground">{reqTarget.ticket}</span></div>
                <div><span className="block text-[10px] uppercase">Branch</span><span className="text-foreground">{reqTarget.branch}</span></div>
                <div><span className="block text-[10px] uppercase">Worker</span><span className="text-foreground">{reqTarget.worker}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="part-model">Model</Label>
                  <Input
                    id="part-model"
                    value={model}
                    onChange={(e) => { setModel(e.target.value); setStock(null); }}
                    placeholder="e.g. ASWH-24"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="part-code">Part Code</Label>
                  <Input
                    id="part-code"
                    value={partCode}
                    onChange={(e) => { setPartCode(e.target.value); setStock(null); }}
                    placeholder="e.g. 12220030043971"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="part-qty">Quantity</Label>
                <Input id="part-qty" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="part-notes">Notes</Label>
                <Textarea id="part-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional" />
              </div>
              {stock && (
                stock.totalReceivedQty > 0 ? (
                  <div className="rounded-md border border-warning/40 bg-warning/10 text-warning p-3 text-xs flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="grid gap-1">
                      <p className="font-medium">
                        Branch already has {stock.totalReceivedQty} unit(s) in stock ({stock.matchCount} record{stock.matchCount === 1 ? "" : "s"}).
                      </p>
                      <ul className="text-[11px] opacity-90 list-disc ps-4 max-h-24 overflow-y-auto">
                        {stock.matches.slice(0, 5).map((m, i) => (
                          <li key={i}>
                            {m.partNumber || "—"} {m.model && `· ${m.model}`} · Qty {m.qty} · Rcvd {m.receivingDate || "—"}
                          </li>
                        ))}
                      </ul>
                      <p className="opacity-80">Use existing stock, or press "Request Anyway" to proceed.</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-success/40 bg-success/10 text-success p-3 text-xs flex gap-2 items-center">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>No matching stock at this branch — safe to request.</span>
                  </div>
                )
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReqTarget(null)} disabled={submitting || checking}>Cancel</Button>
            <Button variant="secondary" onClick={runStockCheck} disabled={submitting || checking || (!partCode.trim() && !model.trim())}>
              {checking ? (<><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Checking…</>) : "Check Stock"}
            </Button>
            {stock && stock.totalReceivedQty > 0 ? (
              <Button variant="destructive" onClick={forceSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Request Anyway"}
              </Button>
            ) : (
              <Button onClick={submitRequest} disabled={submitting || checking}>
                {submitting ? "Submitting…" : "Submit Request"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function PendingTable({
  rows,
  emptyLabel,
  limit,
  onRequestParts,
}: {
  rows: import("@/lib/aux/sheets.functions").PendingTicket[];
  emptyLabel: string;
  limit?: number;
  onRequestParts?: (t: import("@/lib/aux/sheets.functions").PendingTicket) => void;
}) {
  const view = limit ? rows.slice(0, limit) : rows;
  const sort = useSort(view, {
    ticket: (t) => t.ticket,
    branch: (t) => t.branch,
    worker: (t) => t.worker,
    aging: (t) => t.ageBucket,
    reason: (t) => t.reason,
    date: (t) => t.appointedDate,
    remark: (t) => t.remark,
    parts: (t) => t.parts,
  });
  if (view.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <SortableTh sortKey="ticket" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} className="py-2 pr-4 text-start">Ticket #</SortableTh>
            <SortableTh sortKey="branch" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} className="py-2 pr-4 text-start">Branch</SortableTh>
            <SortableTh sortKey="worker" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} className="py-2 pr-4 text-start">Worker</SortableTh>
            <SortableTh sortKey="aging" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} className="py-2 pr-4 text-start">Aging</SortableTh>
            <SortableTh sortKey="reason" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} className="py-2 pr-4 text-start">Reason</SortableTh>
            <SortableTh sortKey="date" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} className="py-2 pr-4 text-start">Date</SortableTh>
            <SortableTh sortKey="remark" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} className="py-2 pr-4 text-start">Remark</SortableTh>
            <SortableTh sortKey="parts" currentKey={sort.sortKey} currentDir={sort.sortDir} onSort={sort.toggle} className="py-2 pr-4 text-start">Parts</SortableTh>
            {onRequestParts && <th className="py-2 pr-4 text-end">Action</th>}
          </tr>
        </thead>
        <tbody>
          {sort.sorted.map((t) => (
            <tr key={t.ticket} className="border-b border-border/60 last:border-0 align-middle">
              <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{t.ticket}</td>
              <td className="py-2.5 pr-4">{t.branch}</td>
              <td className="py-2.5 pr-4">
                {t.unassigned ? (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium bg-destructive/15 text-destructive">
                    Not Assigned
                  </span>
                ) : (
                  t.worker
                )}
              </td>
              <td className="py-2.5 pr-4"><AgingBadge bucket={t.ageBucket} /></td>
              <td className="py-2.5 pr-4">
                {!t.reason || t.reason === "—" ? (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium bg-destructive/15 text-destructive">
                    No Reason
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t.reason}</span>
                )}
              </td>
              <td className="py-2.5 pr-4 tabular-nums">
                {t.appointedDate !== "—" ? (
                  <span className="inline-flex rounded-md bg-warning/15 text-warning px-2 py-0.5 text-[11px] font-medium">
                    {t.appointedDate}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2.5 pr-4 text-muted-foreground max-w-[220px] truncate">{t.remark}</td>
              <td className="py-2.5 pr-4 text-muted-foreground">{t.parts}</td>
              {onRequestParts && (
                <td className="py-2.5 pr-4 text-end">
                  <button
                    type="button"
                    onClick={() => onRequestParts(t)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    <Package className="h-3.5 w-3.5" /> Request Parts
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Showing first {limit} of {rows.length} — export CSV for the full list.
        </p>
      )}
    </div>
  );
}