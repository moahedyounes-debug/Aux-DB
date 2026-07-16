import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Search,
  User,
  Phone,
  MapPin,
  Ticket as TicketIcon,
  Package,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useAccess, applyAccessFilter } from "@/hooks/use-access";
import { shortBranch } from "@/hooks/use-global-filters";
import { readTable } from "@/lib/sheets-client";
import { partsQueryOptions } from "@/lib/aux/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customer-lookup")({
  head: () => ({
    meta: [
      { title: "Customer Lookup — AUX ASC Dashboard" },
      { name: "description", content: "Search a customer by mobile, name or ticket to see their full service timeline." },
      { property: "og:title", content: "Customer Lookup — AUX ASC Dashboard" },
      { property: "og:description", content: "Unified customer 360 across tickets, parts and complaints." },
    ],
  }),
  component: CustomerLookupPage,
});

type TicketRow = Record<string, string>;

const COL = {
  ticket: "Ticket Number",
  name: "User Name",
  tel: "Tel",
  address: "Address",
  city: "Location",
  branch: "Service Provider Name",
  asc: "Service Provider Name",
  worker: "Worker Name",
  status: "Ticket Status",
  phase: "Processing Phase",
  serviceType: "Service Type",
  product: "Product Type",
  createdAt: "Order Creation Time",
  completedAt: "Completion time",
  hours: "Service hours(H)",
  source: "Ticket Source",
  result: "Completion Result",
} as const;

function normPhone(s: string): string {
  return String(s ?? "").replace(/\D/g, "").replace(/^966/, "0").replace(/^0+/, "0");
}
function normText(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}
function isCompleted(r: TicketRow): boolean {
  const s = normText(r[COL.status]);
  return s.includes("complete") || s.includes("closed") || !!r[COL.completedAt]?.trim();
}

type TimelineEvent = {
  kind: "ticket" | "part";
  date: string;
  ts: number;
  title: string;
  subtitle?: string;
  status?: string;
  branch?: string;
  worker?: string;
  ref: string;
};

function parseDate(s: string): number {
  if (!s) return 0;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ ,]+(\d{2}):(\d{2})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`).getTime();
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function CustomerLookupPage() {
  const { access, ready } = useAccess();
  const [q, setQ] = useState("");
  const [committed, setCommitted] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["customer-lookup", "maintenance"],
    queryFn: () => readTable("maintenance", "Sheet1!A1:AE"),
    staleTime: 5 * 60_000,
    enabled: ready,
  });

  const partsQuery = useQuery(partsQueryOptions);

  const scopedTickets = useMemo<TicketRow[]>(() => {
    if (!ticketsQuery.data) return [];
    return applyAccessFilter(ticketsQuery.data.rows, access, {
      asc: COL.asc, branch: COL.branch,
    });
  }, [ticketsQuery.data, access]);

  const results = useMemo(() => {
    const query = committed.trim();
    if (!query) return null;
    const phoneQ = normPhone(query);
    const textQ = normText(query);
    const looksPhone = phoneQ.length >= 6;

    const matchedTickets = scopedTickets.filter((r) => {
      const tel = normPhone(r[COL.tel]);
      const name = normText(r[COL.name]);
      const tk = normText(r[COL.ticket]);
      if (looksPhone && tel && tel.includes(phoneQ)) return true;
      if (tk === textQ || tk.includes(textQ)) return true;
      if (name && name.includes(textQ)) return true;
      return false;
    });

    // Try to identify a single "customer" — prefer phone match
    const phones = new Set<string>();
    const names = new Set<string>();
    for (const t of matchedTickets) {
      const p = normPhone(t[COL.tel]);
      if (p) phones.add(p);
      const n = normText(t[COL.name]);
      if (n) names.add(n);
    }

    // parts: try to match by ticket number in the order/notes/serial columns
    const partRows = partsQuery.data?.recent ?? [];
    const ticketSet = new Set(matchedTickets.map((t) => t[COL.ticket]));
    const matchedParts = partRows.filter((p) => {
      const hay = `${p.order} ${p.notes} ${p.serial} ${p.requestedBy}`.toLowerCase();
      if (ticketSet.size && [...ticketSet].some((tk) => tk && hay.includes(tk.toLowerCase()))) return true;
      if (looksPhone && hay.replace(/\D/g, "").includes(phoneQ)) return true;
      if (textQ && hay.includes(textQ)) return true;
      return false;
    });

    // Build timeline
    const events: TimelineEvent[] = [];
    for (const t of matchedTickets) {
      const date = t[COL.createdAt] || t[COL.completedAt] || "";
      events.push({
        kind: "ticket",
        date,
        ts: parseDate(date),
        title: `Ticket ${t[COL.ticket]}`,
        subtitle: `${t[COL.serviceType] || "Service"} · ${t[COL.product] || ""}`.trim(),
        status: t[COL.status] || t[COL.phase],
        branch: shortBranch(t[COL.branch]),
        worker: t[COL.worker],
        ref: t[COL.ticket],
      });
    }
    for (const p of matchedParts) {
      events.push({
        kind: "part",
        date: p.requestDate,
        ts: parseDate(p.requestDate),
        title: `Part ${p.partNumber || p.order}`,
        subtitle: p.description || p.model,
        status: p.status,
        branch: p.branch,
        ref: p.order,
      });
    }
    events.sort((a, b) => b.ts - a.ts);

    // Basic customer profile — from most recent ticket
    const latest = matchedTickets.slice().sort((a, b) => parseDate(b[COL.createdAt]) - parseDate(a[COL.createdAt]))[0];
    const customer = latest
      ? {
          name: latest[COL.name] || "—",
          tel: latest[COL.tel] || "—",
          address: latest[COL.address] || "",
          city: latest[COL.city] || "",
          branch: shortBranch(latest[COL.branch]),
        }
      : null;

    const completed = matchedTickets.filter(isCompleted).length;
    const pending = matchedTickets.length - completed;

    return {
      customer,
      phones: [...phones],
      names: [...names],
      totalTickets: matchedTickets.length,
      completed,
      pending,
      partsCount: matchedParts.length,
      lastInteraction: events[0]?.date || "—",
      events,
      tickets: matchedTickets,
    };
  }, [committed, scopedTickets, partsQuery.data]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setCommitted(q.trim());
  }

  return (
    <DashboardLayout
      title="Customer Lookup"
      subtitle="Unified 360° view — search across tickets and spare-parts by mobile, name or ticket number"
    >
      <form onSubmit={submit} className="surface-card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[260px]">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <div className="relative mt-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Mobile · Name · Ticket #"
              className="w-full ps-10 pe-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90"
        >
          <Search className="h-4 w-4" /> Search
        </button>
        {ticketsQuery.isLoading && (
          <span className="text-xs text-muted-foreground">Loading data…</span>
        )}
      </form>

      {!committed && (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          Enter a mobile number, customer name or ticket number to look up the full service history.
        </div>
      )}

      {committed && results && results.totalTickets === 0 && results.partsCount === 0 && (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <AlertTriangle className="h-6 w-6 opacity-40" />
          No records found for “{committed}” in your access scope.
        </div>
      )}

      {committed && results && (results.totalTickets > 0 || results.partsCount > 0) && (
        <>
          {results.customer && (
            <div className="surface-card p-5 space-y-3">
              <div className="flex flex-wrap gap-4 items-start">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <User className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-lg font-semibold">{results.customer.name}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-1">
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {results.customer.tel}</span>
                    {results.customer.city && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {results.customer.city}</span>
                    )}
                    {results.customer.branch && (
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {results.customer.branch}</span>
                    )}
                  </div>
                  {results.customer.address && (
                    <div className="text-xs text-muted-foreground mt-1 truncate">{results.customer.address}</div>
                  )}
                  {(results.phones.length > 1 || results.names.length > 1) && (
                    <div className="text-[11px] text-muted-foreground mt-2">
                      Matched {results.phones.length} phone(s), {results.names.length} name(s) — refine the query if these look like different people.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Tickets" value={String(results.totalTickets)} icon={TicketIcon} tone="primary" />
            <KpiCard label="Completed" value={String(results.completed)} icon={CheckCircle2} tone="success" />
            <KpiCard label="Pending" value={String(results.pending)} icon={Clock} tone={results.pending > 0 ? "warning" : "primary"} />
            <KpiCard label="Parts Requests" value={String(results.partsCount)} icon={Package} tone="accent" />
          </div>

          <ChartCard title="Timeline" subtitle={`Last interaction: ${results.lastInteraction}`}>
            {results.events.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No dated events.</div>
            ) : (
              <ol className="relative border-s border-border ps-6 space-y-4">
                {results.events.map((e, i) => {
                  const Icon = e.kind === "ticket" ? TicketIcon : Package;
                  const isDone = normText(e.status ?? "").match(/complete|closed|received/);
                  return (
                    <li key={`${e.kind}-${e.ref}-${i}`} className="relative">
                      <span
                        className={cn(
                          "absolute -start-[27px] top-1 h-4 w-4 rounded-full ring-4 ring-background flex items-center justify-center",
                          e.kind === "ticket" ? "bg-primary/20 text-primary" : "bg-accent text-accent-foreground",
                        )}
                      >
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium">{e.title}</span>
                        {e.status && (
                        <span className={cn(
                            "text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full",
                            isDone ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                          )}>
                            {e.status}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ms-auto">{e.date || "—"}</span>
                      </div>
                      {e.subtitle && <div className="text-xs text-muted-foreground">{e.subtitle}</div>}
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {e.branch && <>Branch: <b className="text-foreground/80">{e.branch}</b> · </>}
                        {e.worker && <>Worker: <b className="text-foreground/80">{e.worker}</b> · </>}
                        Ref: <span className="font-mono">{e.ref}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </ChartCard>

          {results.tickets.length > 0 && (
            <ChartCard title="All Matching Tickets">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4 text-start">Ticket</th>
                      <th className="py-2 pr-4 text-start">Service</th>
                      <th className="py-2 pr-4 text-start">Branch</th>
                      <th className="py-2 pr-4 text-start">Worker</th>
                      <th className="py-2 pr-4 text-start">Status</th>
                      <th className="py-2 pr-4 text-start">Created</th>
                      <th className="py-2 pr-4 text-start">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.tickets.map((t) => (
                      <tr key={t[COL.ticket]} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4 font-mono text-[11px]">{t[COL.ticket]}</td>
                        <td className="py-2 pr-4 text-xs">{t[COL.serviceType]}</td>
                        <td className="py-2 pr-4 text-xs">{shortBranch(t[COL.branch])}</td>
                        <td className="py-2 pr-4 text-xs">{t[COL.worker]}</td>
                        <td className="py-2 pr-4 text-xs">{t[COL.status] || t[COL.phase]}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{t[COL.createdAt]}</td>
                        <td className="py-2 pr-4 text-xs tabular-nums">{t[COL.hours] || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </>
      )}
    </DashboardLayout>
  );
}