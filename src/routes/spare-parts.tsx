import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  Warehouse,
  Plus,
  Pencil,
  RefreshCw,
} from "lucide-react";
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
  Legend,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { partsQueryOptions } from "@/lib/aux/queries";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/spare-parts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(partsQueryOptions),
  head: () => ({
    meta: [
      { title: "Spare Parts — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Branch and main-warehouse stock, monthly consumption of the top 10 parts, request pipeline and a supervisor request form.",
      },
    ],
  }),
  component: SparePartsPage,
});

const num = new Intl.NumberFormat("en-US");

// ---------- Requests query ----------
type RequestRow = {
  rowIndex: number;
  requestId: string;
  date: string;
  ticket: string;
  branch: string;
  worker: string;
  partCode: string;
  quantity: string;
  notes: string;
  status: string;
  requestDate: string;
  dispatchDate: string;
  receiveDate: string;
  lastUpdated: string;
  awb: string;
  model: string;
};

const requestsQueryOptions = queryOptions({
  queryKey: ["spare-part-requests"],
  queryFn: async () => {
    const r = await fetch("/api/public/spare-part-request");
    const d = (await r.json()) as { ok: boolean; rows?: RequestRow[]; error?: string };
    if (!d.ok) throw new Error(d.error || "failed");
    return d.rows ?? [];
  },
  staleTime: 60_000,
});

// ---------- Page ----------
function SparePartsPage() {
  const { data } = useSuspenseQuery(partsQueryOptions);
  return (
    <DashboardLayout
      title="Spare Parts"
      subtitle="Stock, consumption, and supervisor requests"
    >
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

      <Tabs defaultValue="branch" className="mt-2">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="branch">Branch Stock</TabsTrigger>
          <TabsTrigger value="main">Main Warehouse</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Consumption</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="branch" className="mt-4">
          <BranchStockTab data={data} />
        </TabsContent>
        <TabsContent value="main" className="mt-4">
          <MainWarehouseTab data={data} />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <MonthlyConsumptionTab data={data} />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <RequestsTab data={data} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

// ---------- Branch Stock ----------
function BranchStockTab({ data }: { data: import("@/lib/aux/tabs.functions").PartsSummary }) {
  const branches = useMemo(
    () =>
      Array.from(new Set(data.branchStock.map((r) => r.location)))
        .filter(Boolean)
        .sort(),
    [data.branchStock],
  );
  const [branch, setBranch] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (branch !== "all" && !branches.includes(branch)) setBranch("all");
  }, [branch, branches]);

  const rows = useMemo(() => {
    const filtered = branch === "all" ? data.branchStock : data.branchStock.filter((r) => r.location === branch);
    const term = q.trim().toLowerCase();
    const searched = term
      ? filtered.filter(
          (r) =>
            r.location.toLowerCase().includes(term) ||
            r.part.toLowerCase().includes(term) ||
            r.description.toLowerCase().includes(term) ||
            r.model.toLowerCase().includes(term),
        )
      : filtered;
    return searched.sort((a, b) => b.stock - a.stock);
  }, [data.branchStock, branch, q]);

  const totalStock = rows.reduce((s, r) => s + Math.max(0, r.stock), 0);
  const outOfStock = rows.filter((r) => r.stock <= 0).length;

  return (
    <ChartCard
      title="Per-Branch Stock"
      subtitle="Net = In − Out per part per branch (from Transaction tab)"
      exportRows={rows as unknown as Array<Record<string, unknown>>}
    >
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="min-w-[240px]">
          <Label>Branch</Label>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[240px] flex-1">
          <Label>Search part / model</Label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Part code, name, or model…" />
        </div>
        <div className="text-xs text-muted-foreground ml-auto">
          <span className="mr-3">Parts: <b>{num.format(rows.length)}</b></span>
          <span className="mr-3">In stock (units): <b className="text-success">{num.format(totalStock)}</b></span>
          <span>Out of stock: <b className="text-destructive">{num.format(outOfStock)}</b></span>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground sticky top-0">
            <tr>
              <th className="p-2 text-left">Branch</th>
              <th className="p-2 text-left">Part #</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Model</th>
              <th className="p-2 text-right">In</th>
              <th className="p-2 text-right">Out</th>
              <th className="p-2 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((r) => (
              <tr key={r.location + r.part + r.model} className="border-t border-border">
                <td className="p-2 text-xs text-muted-foreground">{r.location}</td>
                <td className="p-2 font-mono text-xs">{r.part}</td>
                <td className="p-2">{r.description}</td>
                <td className="p-2 text-xs">{r.model}</td>
                <td className="p-2 text-right text-success">{num.format(r.inQty)}</td>
                <td className="p-2 text-right text-warning">{num.format(r.outQty)}</td>
                <td className={`p-2 text-right font-semibold ${r.stock <= 0 ? "text-destructive" : "text-foreground"}`}>{num.format(r.stock)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No data loaded from Transaction tab.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ---------- Main Warehouse ----------
function MainWarehouseTab({ data }: { data: import("@/lib/aux/tabs.functions").PartsSummary }) {
  const warehouses = data.mainWarehouses;
  const [wh, setWh] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (wh !== "all" && !warehouses.includes(wh)) setWh("all");
  }, [wh, warehouses]);

  const rows = useMemo(() => {
    const mainWarehouseSet = new Set(warehouses);
    const filtered = wh === "all"
      ? data.warehouseStock.filter((r) => mainWarehouseSet.has(r.location))
      : data.warehouseStock.filter((r) => r.location === wh);
    const term = q.trim().toLowerCase();
    const searched = term
      ? filtered.filter((r) => r.location.toLowerCase().includes(term) || r.part.toLowerCase().includes(term) || r.description.toLowerCase().includes(term) || r.model.toLowerCase().includes(term))
      : filtered;
    return searched.sort((a, b) => b.stock - a.stock);
  }, [data.warehouseStock, warehouses, wh, q]);

  return (
    <ChartCard
      title="AUX Main Warehouses"
      subtitle="Stock at central warehouses (not branch-New / branch-Old warehouses)"
      exportRows={rows as unknown as Array<Record<string, unknown>>}
    >
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="min-w-[280px]">
          <Label>Warehouse</Label>
          <Select value={wh} onValueChange={setWh}>
            <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All main warehouses</SelectItem>
              {warehouses.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[240px] flex-1">
          <Label>Search part / model</Label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          <Warehouse className="inline h-3.5 w-3.5 mr-1" />
          {num.format(warehouses.length)} main warehouses
        </div>
      </div>
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground sticky top-0">
            <tr>
              <th className="p-2 text-left">Warehouse</th>
              <th className="p-2 text-left">Part #</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Model</th>
              <th className="p-2 text-right">In</th>
              <th className="p-2 text-right">Out</th>
              <th className="p-2 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((r) => (
              <tr key={r.location + r.part + r.model} className="border-t border-border">
                <td className="p-2 text-xs text-muted-foreground">{r.location}</td>
                <td className="p-2 font-mono text-xs">{r.part}</td>
                <td className="p-2">{r.description}</td>
                <td className="p-2 text-xs">{r.model}</td>
                <td className="p-2 text-right text-success">{num.format(r.inQty)}</td>
                <td className="p-2 text-right text-warning">{num.format(r.outQty)}</td>
                <td className={`p-2 text-right font-semibold ${r.stock <= 0 ? "text-destructive" : "text-foreground"}`}>{num.format(r.stock)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No main warehouse stock loaded from Transaction tab.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ---------- Monthly Consumption ----------
const LINE_COLORS = [
  "hsl(var(--primary))",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-warning)",
  "var(--color-success)",
  "var(--color-destructive)",
  "var(--color-accent)",
  "var(--color-foreground)",
];

function MonthlyConsumptionTab({ data }: { data: import("@/lib/aux/tabs.functions").PartsSummary }) {
  const chartData = useMemo(() => {
    return data.monthlyLabels.map((m) => {
      const row: Record<string, string | number> = { month: m };
      data.monthlyConsumption.forEach((p) => {
        row[p.part] = p.months.find((x) => x.month === m)?.qty ?? 0;
      });
      return row;
    });
  }, [data.monthlyLabels, data.monthlyConsumption]);

  return (
    <div className="grid gap-4">
      <ChartCard
        title="Monthly Consumption — Top 10 Parts"
        subtitle="Out-of-storage quantities per month"
        exportRows={chartData as unknown as Array<Record<string, unknown>>}
      >
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {data.monthlyConsumption.map((p, i) => (
              <Line key={p.part} dataKey={p.part} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} name={p.description || p.part} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top 10 Consumed Parts" exportRows={data.monthlyConsumption as unknown as Array<Record<string, unknown>>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Part #</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-right">Total Out (Units)</th>
                <th className="p-2 text-right">Avg / Month</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyConsumption.map((p, i) => (
                <tr key={p.part} className="border-t border-border">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-mono text-xs">{p.part}</td>
                  <td className="p-2">{p.description}</td>
                  <td className="p-2 text-right font-semibold">{num.format(p.total)}</td>
                  <td className="p-2 text-right">{num.format(Math.round(p.total / Math.max(1, p.months.length)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

// ---------- Requests ----------
const STATUS_TONE: Record<string, string> = {
  Requested: "bg-primary/15 text-primary",
  New: "bg-primary/15 text-primary",
  Dispatched: "bg-warning/15 text-warning",
  Shipped: "bg-warning/15 text-warning",
  "Not Available": "bg-destructive/15 text-destructive",
  Received: "bg-success/15 text-success",
  Used: "bg-success/15 text-success",
  Returned: "bg-muted text-foreground",
  Cancelled: "bg-muted text-muted-foreground",
};
const STATUS_OPTIONS = ["Requested", "Dispatched", "Shipped", "Received", "Used", "Returned", "Not Available", "Cancelled"];

function RequestsTab({ data }: { data: import("@/lib/aux/tabs.functions").PartsSummary }) {
  const qc = useQueryClient();
  const { data: rows, isLoading, refetch, isFetching } = useQuery(requestsQueryOptions);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RequestRow | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const buckets = useMemo(() => {
    const list = rows ?? [];
    const pending = list.filter((r) => ["Requested", "New", "Dispatched", "Shipped"].includes(r.status));
    const received = list.filter((r) => r.status === "Received");
    const used = list.filter((r) => r.status === "Used");
    const returned = list.filter((r) => r.status === "Returned");
    const notAvail = list.filter((r) => r.status === "Not Available");
    return { pending, received, used, returned, notAvail };
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    if (filter === "all") return list;
    if (filter === "pending") return buckets.pending;
    if (filter === "used") return buckets.used;
    if (filter === "returned") return buckets.returned;
    if (filter === "notreturned") return list.filter((r) => ["Dispatched", "Shipped", "Received", "Used"].includes(r.status) && r.status !== "Returned");
    return list.filter((r) => r.status === filter);
  }, [rows, filter, buckets]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["spare-part-requests"] });

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Pending" value={num.format(buckets.pending.length)} icon={Package} tone="warning" onClick={() => setFilter("pending")} active={filter === "pending"} />
        <KpiCard label="Received" value={num.format(buckets.received.length)} icon={ArrowDownToLine} tone="success" onClick={() => setFilter("Received")} active={filter === "Received"} />
        <KpiCard label="Used" value={num.format(buckets.used.length)} icon={ArrowUpFromLine} tone="success" onClick={() => setFilter("used")} active={filter === "used"} />
        <KpiCard label="Returned" value={num.format(buckets.returned.length)} icon={RefreshCw} tone="accent" onClick={() => setFilter("returned")} active={filter === "returned"} />
        <KpiCard label="Not Available" value={num.format(buckets.notAvail.length)} icon={Layers} tone="destructive" onClick={() => setFilter("Not Available")} active={filter === "Not Available"} />
      </section>

      <ChartCard
        title="Spare Part Requests"
        subtitle="Supervisor-submitted requests (Daily Spare Part Request tab)"
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Request
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs">Filter</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending (open)</SelectItem>
                <SelectItem value="notreturned">Not yet returned</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <th className="p-2 text-left">Request</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Ticket</th>
                <th className="p-2 text-left">Branch</th>
                <th className="p-2 text-left">Part #</th>
                <th className="p-2 text-left">Model</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-left">Ship Date</th>
                <th className="p-2 text-left">Receive Date</th>
                <th className="p-2 text-left">AWB</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">No requests match this filter.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.requestId} className="border-t border-border">
                  <td className="p-2 font-mono text-[11px]">{r.requestId}</td>
                  <td className="p-2 text-xs">{r.date}</td>
                  <td className="p-2 font-mono text-xs">{r.ticket}</td>
                  <td className="p-2 text-xs">{r.branch}</td>
                  <td className="p-2 font-mono text-xs">{r.partCode}</td>
                  <td className="p-2 text-xs">{r.model}</td>
                  <td className="p-2 text-right">{r.quantity}</td>
                  <td className="p-2 text-xs">{r.dispatchDate || "—"}</td>
                  <td className="p-2 text-xs">{r.receiveDate || "—"}</td>
                  <td className="p-2 font-mono text-xs">{r.awb || "—"}</td>
                  <td className="p-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[r.status] ?? "bg-muted text-foreground"}`}>
                      {r.status || "—"}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <RequestDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        companies={data.companies}
        onSaved={() => { invalidate(); setOpen(false); setEditing(null); }}
      />
    </div>
  );
}

// ---------- Request Dialog (create / edit) ----------
function RequestDialog({
  open,
  onOpenChange,
  editing,
  companies,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: RequestRow | null;
  companies: import("@/lib/aux/tabs.functions").CompanyGroup[];
  onSaved: () => void;
}) {
  const initialCompany = useMemo(() => {
    if (!editing?.branch) return "";
    return companies.find((c) => c.branches.includes(editing.branch))?.company ?? "";
  }, [editing, companies]);
  const [company, setCompany] = useState(initialCompany);
  const [branch, setBranch] = useState(editing?.branch ?? "");
  const [ticket, setTicket] = useState(editing?.ticket ?? "");
  const [partCode, setPartCode] = useState(editing?.partCode ?? "");
  const [model, setModel] = useState(editing?.model ?? "");
  const [quantity, setQuantity] = useState(editing?.quantity ?? "1");
  const [dispatchDate, setDispatchDate] = useState(editing?.dispatchDate ?? "");
  const [receiveDate, setReceiveDate] = useState(editing?.receiveDate ?? "");
  const [awb, setAwb] = useState(editing?.awb ?? "");
  const [status, setStatus] = useState(editing?.status || "Requested");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Reset when opening for a different row
  useEffect(() => {
    if (open) {
      setCompany(initialCompany);
      setBranch(editing?.branch ?? "");
      setTicket(editing?.ticket ?? "");
      setPartCode(editing?.partCode ?? "");
      setModel(editing?.model ?? "");
      setQuantity(editing?.quantity ?? "1");
      setDispatchDate(editing?.dispatchDate ?? "");
      setReceiveDate(editing?.receiveDate ?? "");
      setAwb(editing?.awb ?? "");
      setStatus(editing?.status || "Requested");
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing, initialCompany]);

  const branchOptions = useMemo(() => {
    return companies.find((c) => c.company === company)?.branches ?? [];
  }, [companies, company]);

  const save = async () => {
    if (!partCode.trim() && !model.trim()) { toast.error("Part Code or Model required"); return; }
    if (!quantity.trim() || Number(quantity) <= 0) { toast.error("Quantity must be > 0"); return; }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch("/api/public/spare-part-request", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: editing.requestId,
            ticket, branch, partCode, model, quantity, notes, status,
            dispatchDate, receiveDate, awb,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`);
        toast.success("Request updated");
      } else {
        const res = await fetch("/api/public/spare-part-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticket, branch, partCode, model, quantity: quantity, notes, status,
            dispatchDate, awb,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.ok) throw new Error(d.detail || d.error || `HTTP ${res.status}`);
        toast.success(`Request created (${d.requestId})`);
      }
      onSaved();
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit Request ${editing.requestId}` : "New Spare Part Request"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Company</Label>
            <Select value={company} onValueChange={(v) => { setCompany(v); setBranch(""); }}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {companies.map((c) => <SelectItem key={c.company} value={c.company}>{c.company}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Branch</Label>
            <Select value={branch} onValueChange={setBranch} disabled={!company}>
              <SelectTrigger><SelectValue placeholder={company ? "Select branch" : "Pick company first"} /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {branchOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ticket #</Label>
            <Input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="GD…" />
          </div>
          <div>
            <Label>Part Code</Label>
            <Input value={partCode} onChange={(e) => setPartCode(e.target.value)} placeholder="Accessory code" />
          </div>
          <div>
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. ATW30A2DI-BSA" />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="1" />
          </div>
          <div>
            <Label>Ship Date</Label>
            <Input value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} type="date" />
          </div>
          <div>
            <Label>Arrival Date</Label>
            <Input value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} type="date" />
          </div>
          <div>
            <Label>AWB / Waybill</Label>
            <Input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="AWB #  or 'Not Available'" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}