import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Filter, RotateCcw } from "lucide-react";
import { useGlobalFilters, firstWord } from "@/hooks/use-global-filters";
import { readTable } from "@/lib/sheets-client";
import { useAccess, applyAccessFilter } from "@/hooks/use-access";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SPN = "Service Provider Name";
const CREATED = "Order Creation Time";

export function SidebarFilters({ collapsed }: { collapsed: boolean }) {
  const { filters, set, reset, active } = useGlobalFilters();
  const { access, ready } = useAccess();
  const [open, setOpen] = useState(true);

  const q = useQuery({
    queryKey: ["maintenance-filter-options"],
    queryFn: () => readTable("maintenance", "Sheet1!A1:AE"),
    staleTime: 5 * 60_000,
    enabled: ready && !collapsed,
  });

  const opts = useMemo(() => {
    if (!q.data) return { ascs: [] as string[], branches: [] as string[], months: [] as string[] };
    const rows = applyAccessFilter(q.data.rows, access, { asc: SPN });
    const a = new Set<string>();
    const b = new Set<string>();
    const m = new Set<string>();
    for (const r of rows) {
      const spn = r[SPN];
      if (spn) {
        b.add(spn);
        const c = firstWord(spn);
        if (c) a.add(c);
      }
      const raw = r[CREATED];
      if (raw) {
        const d = new Date(String(raw).replace(" ", "T"));
        if (Number.isFinite(d.getTime())) {
          m.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
        }
      }
    }
    // If a company is picked, narrow branches to that company.
    const branchList = Array.from(b)
      .filter((v) => filters.asc === "all" || firstWord(v) === filters.asc)
      .sort();
    return {
      ascs: Array.from(a).sort(),
      branches: branchList,
      months: Array.from(m).sort().reverse(),
    };
  }, [q.data, access, filters.asc]);

  if (collapsed) {
    return (
      <div className="px-2 py-2 border-t border-sidebar-border relative">
        <div className="flex justify-center relative">
          <Filter className="h-4 w-4 text-sidebar-foreground/70" />
          {active > 0 && (
            <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-sidebar-primary text-sidebar-primary-foreground rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
              {active}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
      >
        <Filter className="h-3.5 w-3.5" />
        <span>Global Filters</span>
        {active > 0 && (
          <span className="text-[10px] font-bold bg-sidebar-primary text-sidebar-primary-foreground rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
            {active}
          </span>
        )}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && (
        <div className={cn("px-3 pb-3 space-y-2.5", q.isLoading && "opacity-70")}>
          <FieldLabel>Month</FieldLabel>
          <Select value={filters.month} onValueChange={(v) => set("month", v)}>
            <SelectTrigger className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {opts.months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>From</FieldLabel>
              <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)}
                className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground" />
            </div>
            <div>
              <FieldLabel>To</FieldLabel>
              <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)}
                className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground" />
            </div>
          </div>

          <FieldLabel>Company (ASC)</FieldLabel>
          <Select value={filters.asc} onValueChange={(v) => set("asc", v)}>
            <SelectTrigger className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {opts.ascs.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <FieldLabel>Branch</FieldLabel>
          <Select value={filters.branch} onValueChange={(v) => set("branch", v)}>
            <SelectTrigger className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {opts.branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>

          <FieldLabel>Technician</FieldLabel>
          <Input placeholder="Name…" value={filters.worker} onChange={(e) => set("worker", e.target.value)}
            className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50" />

          <Button variant="outline" size="sm" onClick={reset}
            className="w-full h-8 text-xs mt-1 bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent">
            <RotateCcw className="h-3 w-3 mr-1.5" /> Reset filters
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">{children}</Label>;
}