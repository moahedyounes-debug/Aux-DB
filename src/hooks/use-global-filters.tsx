import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface GlobalFilters {
  month: string; // "all" | YYYY-MM
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
  asc: string;   // "all" | value
  branch: string;// "all" | value
  worker: string;
}

const DEFAULTS: GlobalFilters = {
  month: "all",
  from: "",
  to: "",
  asc: "all",
  branch: "all",
  worker: "",
};

interface Ctx {
  filters: GlobalFilters;
  set: <K extends keyof GlobalFilters>(k: K, v: GlobalFilters[K]) => void;
  reset: () => void;
  active: number;
}

const GlobalFiltersCtx = createContext<Ctx | null>(null);

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULTS);
  const value = useMemo<Ctx>(() => {
    const active =
      (filters.month !== "all" ? 1 : 0) +
      (filters.from ? 1 : 0) +
      (filters.to ? 1 : 0) +
      (filters.asc !== "all" ? 1 : 0) +
      (filters.branch !== "all" ? 1 : 0) +
      (filters.worker.trim() ? 1 : 0);
    return {
      filters,
      set: (k, v) => setFilters((prev) => ({ ...prev, [k]: v })),
      reset: () => setFilters(DEFAULTS),
      active,
    };
  }, [filters]);
  return <GlobalFiltersCtx.Provider value={value}>{children}</GlobalFiltersCtx.Provider>;
}

export function useGlobalFilters(): Ctx {
  const ctx = useContext(GlobalFiltersCtx);
  if (!ctx) throw new Error("useGlobalFilters must be used inside GlobalFiltersProvider");
  return ctx;
}

export interface RowColMap {
  asc?: string;
  branch?: string;
  worker?: string;
  createdAt?: string;
}

/** Apply the global filters to an array of sheet rows. */
export function applyGlobalFilters<T extends Record<string, string>>(
  rows: T[],
  cols: RowColMap,
  filters: GlobalFilters,
): T[] {
  const from = filters.from ? new Date(filters.from).getTime() : null;
  const to = filters.to ? new Date(filters.to).getTime() + 86_400_000 : null;
  const worker = filters.worker.trim().toLowerCase();
  const wantDate = filters.month !== "all" || from !== null || to !== null;
  return rows.filter((r) => {
    if (cols.asc && filters.asc !== "all" && r[cols.asc] !== filters.asc) return false;
    if (cols.branch && filters.branch !== "all" && r[cols.branch] !== filters.branch) return false;
    if (cols.worker && worker && !(r[cols.worker] || "").toLowerCase().includes(worker)) return false;
    if (wantDate && cols.createdAt) {
      const raw = r[cols.createdAt];
      if (!raw) return false;
      const d = new Date(String(raw).replace(" ", "T"));
      const t = d.getTime();
      if (!Number.isFinite(t)) return false;
      if (filters.month !== "all") {
        const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        if (mk !== filters.month) return false;
      }
      if (from !== null && t < from) return false;
      if (to !== null && t >= to) return false;
    }
    return true;
  });
}