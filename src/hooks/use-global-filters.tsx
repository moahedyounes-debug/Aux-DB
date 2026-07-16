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
  /** "Service Provider Name" column — first word = company, full value = branch. */
  spn?: string;
  branch?: string;
  worker?: string;
  createdAt?: string;
}

export function firstWord(v: string | undefined | null): string {
  if (!v) return "";
  const m = String(v).trim().match(/^\S+/);
  return m ? m[0] : "";
}

/**
 * Turn a raw "Service Provider Name" value into a compact branch label.
 * Example:
 *   "wiFEX Authorized Maintenance and Operations Company - Khamis Mushait Branch"
 *   →  "Khamis Mushait - wiFEX"
 * Falls back to the trimmed original value when the shape is unexpected.
 */
export function shortBranch(raw: string | undefined | null): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const parts = s.split(/\s*[-–—]\s*/);
  if (parts.length >= 2) {
    const company = (parts[0].trim().split(/\s+/)[0] || parts[0]).trim();
    let city = parts.slice(1).join(" - ").trim();
    city = city.replace(/\s+Branch\s*$/i, "").trim();
    if (city && company) return `${city} - ${company}`;
  }
  return s;
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
    if (cols.spn) {
      const spn = r[cols.spn] || "";
      if (filters.asc !== "all" && firstWord(spn) !== filters.asc) return false;
      if (filters.branch !== "all" && shortBranch(spn) !== filters.branch) return false;
    } else if (cols.branch && filters.branch !== "all" && shortBranch(r[cols.branch]) !== filters.branch) {
      return false;
    }
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