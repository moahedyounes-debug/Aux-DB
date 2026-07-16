import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  PackageX,
  Building2,
  Layers,
  TrendingDown,
  Info,
  Search,
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
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { Input } from "@/components/ui/input";
import { readTable } from "@/lib/sheets-client";
import { useAccess, applyAccessFilter } from "@/hooks/use-access";
import { useGlobalFilters, applyGlobalFilters, shortBranch } from "@/hooks/use-global-filters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/obm-analysis")({
  head: () => ({
    meta: [
      { title: "OBM Analysis — AUX ASC Dashboard" },
      {
        name: "description",
        content:
          "Out-Of-Brand Model (OBM) analysis — cancelled tickets for non-ATW products, excluded from performance KPIs.",
      },
      { property: "og:title", content: "OBM Analysis — AUX ASC Dashboard" },
      {
        property: "og:description",
        content: "Tickets cancelled because the product is not an ATW model.",
      },
    ],
  }),
  component: OBMPage,
});

const fmt = new Intl.NumberFormat("en-US");

const M = {
  ticket: "Ticket Number",
  asc: "Service Provider Name",
  status: "Ticket Status",
  phase: "Processing Phase",
  createdAt: "Order Creation Time",
  completedAt: "Completion time",
  worker: "Worker Name",
  product: "Product Line",
  productType: "Product Type",
  user: "User Name",
  serviceInfo: "Service Information",
  notes: "Maintenance Instructions",
  completionResult: "Completion Result",
} as const;

type Row = Record<string, string>;

// Match a model-like token: at least 4 chars, uppercase letters + digits,
// optional hyphen suffixes. Examples: ATW24CU4A2DI-S, LG24000BTU, RSH-24CV, MSZ-GE25.
const MODEL_RE = /\b([A-Z][A-Z0-9]{2,}(?:-[A-Z0-9]+)*)\b/g;

function extractModel(r: Row): string {
  const text = `${r[M.serviceInfo] || ""} ${r[M.notes] || ""}`.toUpperCase();
  const matches = text.match(MODEL_RE) || [];
  // Skip pure-number tokens & noise words
  const filtered = matches.filter((m) => /\d/.test(m) && m.length >= 4 && !/^(BTU|KW|VOLT|AMP|HZ|KM|CM|MM)$/.test(m));
  const atw = filtered.find((m) => m.startsWith("ATW"));
  if (atw) return atw;
  // Otherwise the longest looks-like-a-model
  return filtered.sort((a, b) => b.length - a.length)[0] || "";
}

function isCancelled(r: Row): boolean {
  const s = (r[M.status] || "").toLowerCase();
  return /cancel/.test(s);
}

function isOBM(r: Row): boolean {
  if (!isCancelled(r)) return false;
  const model = extractModel(r);
  if (!model) return false;
  return !model.startsWith("ATW");
}

function brandFromModel(model: string): string {
  // brand prefix = leading letters
  const m = model.match(/^([A-Z]+)/);
  return m ? m[1] : "Unknown";
}

function branchOf(r: Row): string {
  return shortBranch(r[M.asc]) || "—";
}

function monthKey(r: Row): string {
  const raw = r[M.createdAt] || "";
  const d = new Date(String(raw).replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return "—";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function OBMPage() {
  const { access, ready } = useAccess();
  const { filters: gFilters } = useGlobalFilters();
  const maint = useQuery({
    queryKey: ["maintenance", "Sheet1"],
    queryFn: () => readTable("maintenance", "Sheet1!A1:AE"),
    staleTime: 60_000,
    enabled: ready,
  });

  const rows: Row[] = useMemo(() => {
    if (!maint.data) return [];
    const scoped = applyAccessFilter(maint.data.rows, access, { asc: M.asc, branch: M.asc });
    return applyGlobalFilters(scoped, { spn: M.asc, worker: M.worker, createdAt: M.createdAt }, gFilters);
  }, [maint.data, access, gFilters]);

  const analysis = useMemo(() => {
    const total = rows.length;
    const cancelled = rows.filter(isCancelled);
    const obmRows = rows
      .filter(isOBM)
      .map((r) => ({ ...r, __model: extractModel(r), __branch: branchOf(r), __month: monthKey(r) }));

    // By brand
    const brandMap = new Map<string, number>();
    for (const r of obmRows) {
      const b = brandFromModel(r.__model);
      brandMap.set(b, (brandMap.get(b) ?? 0) + 1);
    }
    const byBrand = Array.from(brandMap.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // By model
    const modelMap = new Map<string, number>();
    for (const r of obmRows) modelMap.set(r.__model, (modelMap.get(r.__model) ?? 0) + 1);
    const byModel = Array.from(modelMap.entries())
      .map(([model, count]) => ({ model, count, brand: brandFromModel(model) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // By branch
    const branchMap = new Map<string, number>();
    for (const r of obmRows) branchMap.set(r.__branch, (branchMap.get(r.__branch) ?? 0) + 1);
    const byBranch = Array.from(branchMap.entries())
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Monthly trend
    const monthMap = new Map<string, number>();
    for (const r of obmRows) monthMap.set(r.__month, (monthMap.get(r.__month) ?? 0) + 1);
    const monthly = Array.from(monthMap.entries())
      .filter(([k]) => k !== "—")
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));

    return {
      total,
      cancelledCount: cancelled.length,
      obmRows,
      obmCount: obmRows.length,
      byBrand,
      byModel,
      byBranch,
      monthly,
    };
  }, [rows]);

  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return analysis.obmRows;
    return analysis.obmRows.filter((r) => {
      const hay = `${r[M.ticket]} ${r.__branch} ${r[M.worker]} ${r[M.user]} ${r.__model} ${r[M.serviceInfo]} ${r[M.notes]}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [analysis.obmRows, q]);

  const a = analysis;
  const obmShareOfCancelled = a.cancelledCount ? (a.obmCount / a.cancelledCount) * 100 : 0;
  const obmShareOfTotal = a.total ? (a.obmCount / a.total) * 100 : 0;

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout
      title="OBM Analysis"
      subtitle="Out-Of-Brand Model — cancelled tickets for non-ATW products (excluded from performance KPIs)"
    >
      {/* Definition banner */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 flex items-start gap-3 animate-rise">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-semibold text-foreground">What counts as OBM?</p>
          <p className="text-muted-foreground mt-1">
            Any ticket where the final status is <span className="font-medium text-destructive">Cancel</span> and the model
            (extracted from <em>Service Information</em> or <em>Maintenance Instructions</em>) does <span className="font-medium">not</span> start with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ATW</code>.
            These tickets are closed because the product is not in the system — they should be treated like normal tickets and excluded from performance measurement.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <TopKpi color="destructive" label="OBM Tickets" value={fmt.format(a.obmCount)} sub="Non-ATW + Cancelled" icon={PackageX} />
        <TopKpi color="warning" label="% of Cancelled" value={`${obmShareOfCancelled.toFixed(1)}%`} sub={`of ${fmt.format(a.cancelledCount)} cancelled`} icon={TrendingDown} />
        <TopKpi color="primary" label="% of All Tickets" value={`${obmShareOfTotal.toFixed(2)}%`} sub={`of ${fmt.format(a.total)} total`} icon={Layers} />
        <TopKpi color="accent" label="Unique Brands" value={fmt.format(a.byBrand.length)} sub="Non-ATW brands seen" icon={Building2} />
      </section>

      {/* Charts row 1 */}
      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard title="OBM by Brand" subtitle="Top brand prefixes appearing in OBM tickets" exportRows={a.byBrand}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={a.byBrand} layout="vertical" margin={{ top: 5, right: 24, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="brand" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
              <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="OBM by Branch" subtitle="Which branches receive the most OBM requests" exportRows={a.byBranch}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={a.byBranch} layout="vertical" margin={{ top: 5, right: 24, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="branch" width={140} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
              <Bar dataKey="count" fill="hsl(var(--warning))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Trend + Top Models */}
      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard title="OBM Monthly Trend" subtitle="Cancelled non-ATW tickets over time" exportRows={a.monthly}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={a.monthly} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top OBM Models" subtitle="Most requested non-ATW models" exportRows={a.byModel}>
          <div className="overflow-x-auto max-h-[340px]">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3 text-start font-semibold">Model</th>
                  <th className="py-2 px-3 text-start font-semibold">Brand</th>
                  <th className="py-2 px-3 text-end font-semibold">OBM Count</th>
                </tr>
              </thead>
              <tbody>
                {a.byModel.map((m) => (
                  <tr key={m.model} className="border-b border-border/60 hover:bg-muted/20">
                    <td className="py-2 px-3 font-mono text-xs">{m.model}</td>
                    <td className="py-2 px-3">
                      <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs">{m.brand}</span>
                    </td>
                    <td className="py-2 px-3 text-end tabular-nums font-semibold text-destructive">{fmt.format(m.count)}</td>
                  </tr>
                ))}
                {a.byModel.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      {maint.isLoading ? "Loading…" : "No OBM models found in the current scope."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Ticket list */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between border-l-4 border-primary pl-3">
          <div className="flex items-center gap-2">
            <PackageX className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">OBM Ticket List</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{fmt.format(filtered.length)} of {fmt.format(a.obmCount)} tickets</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7 h-8 w-56" placeholder="Ticket, branch, model…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </div>
        <ChartCard
          title="OBM Tickets"
          subtitle="Detected model + cancellation reason"
          exportRows={filtered.map((r) => ({
            Ticket: r[M.ticket],
            Branch: r.__branch,
            Worker: r[M.worker],
            Model: r.__model,
            Brand: brandFromModel(r.__model),
            Customer: r[M.user],
            "Service Info": r[M.serviceInfo],
            Notes: r[M.notes],
            Status: r[M.status],
            Created: r[M.createdAt],
            Completed: r[M.completedAt],
          }))}
        >
          <div className="overflow-x-auto max-h-[560px]">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-muted-foreground border-b border-border uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-start font-semibold">Ticket #</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Branch</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Worker</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Model</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Brand</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Service Info</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Status</th>
                  <th className="py-2.5 px-3 text-start font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {maint.isLoading ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No OBM tickets match your search.</td></tr>
                ) : (
                  filtered.slice(0, 500).map((r, i) => (
                    <tr key={`${r[M.ticket]}-${i}`} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="py-2 px-3 font-mono">{r[M.ticket]}</td>
                      <td className="py-2 px-3">{r.__branch}</td>
                      <td className="py-2 px-3">{r[M.worker] || "—"}</td>
                      <td className="py-2 px-3 font-mono text-[11px] font-semibold text-destructive">{r.__model}</td>
                      <td className="py-2 px-3">
                        <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-[10px]">{brandFromModel(r.__model)}</span>
                      </td>
                      <td className="py-2 px-3 max-w-[260px] truncate text-muted-foreground">{r[M.serviceInfo] || r[M.notes] || "—"}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-block rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-medium">
                          {r[M.status] || "Cancelled"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{r[M.createdAt]?.split(" ")[0] || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <div className="py-2 text-center text-xs text-muted-foreground">
                Showing first 500 of {fmt.format(filtered.length)} — export CSV for the full list.
              </div>
            )}
          </div>
        </ChartCard>
      </section>
    </DashboardLayout>
  );
}

/* ---------- KPI subcomponent (matches Deep Insights style) ---------- */

type ToneKey = "destructive" | "warning" | "primary" | "success" | "accent";

const STRIPE_BG: Record<ToneKey, string> = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
  accent: "bg-accent-foreground",
};

const TONE_TEXT: Record<ToneKey, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  primary: "text-primary",
  success: "text-success",
  accent: "text-accent-foreground",
};

function TopKpi({
  color,
  label,
  value,
  sub,
  icon: Icon,
}: {
  color: ToneKey;
  label: string;
  value: string;
  sub: string;
  icon: typeof PackageX;
}) {
  return (
    <div className="surface-card animate-rise relative overflow-hidden p-4 pt-5 flex flex-col items-center text-center gap-2">
      <div className={cn("absolute inset-x-0 top-0 h-1.5", STRIPE_BG[color])} aria-hidden />
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[color])} />
        {label}
      </div>
      <div className="text-3xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}