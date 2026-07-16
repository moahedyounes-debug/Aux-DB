import { useMemo, useState, useCallback } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export type SortGetters<T> = Record<string, (row: T) => unknown>;

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = typeof a === "number" ? a : Number(a);
  const nb = typeof b === "number" ? b : Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "") {
    return na - nb;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function useSort<T>(
  rows: T[],
  getters: SortGetters<T>,
  initial?: { key: string; dir?: SortDir }
) {
  const [sortKey, setSortKey] = useState<string | null>(initial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? "desc");

  const sorted = useMemo(() => {
    if (!sortKey || !getters[sortKey]) return rows;
    const g = getters[sortKey];
    const copy = rows.slice();
    copy.sort((a, b) => {
      const cmp = compareValues(g(a), g(b));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir, getters]);

  const toggle = useCallback(
    (key: string) => {
      setSortKey((prev) => {
        if (prev === key) {
          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          return prev;
        }
        setSortDir("desc");
        return key;
      });
    },
    []
  );

  return { sorted, sortKey, sortDir, toggle };
}

interface SortableThProps extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "align"> {
  sortKey: string;
  currentKey: string | null;
  currentDir: SortDir;
  onSort: (key: string) => void;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}

export function SortableTh({
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = "start",
  className,
  children,
  ...rest
}: SortableThProps) {
  const active = currentKey === sortKey;
  const Icon = !active ? ArrowUpDown : currentDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      {...rest}
      className={cn("cursor-pointer select-none transition-colors hover:text-foreground", className)}
      onClick={(e) => {
        rest.onClick?.(e);
        onSort(sortKey);
      }}
      aria-sort={active ? (currentDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          align === "end" && "flex-row-reverse",
          align === "center" && "justify-center"
        )}
      >
        <span>{children}</span>
        <Icon className={cn("h-3 w-3 shrink-0", active ? "text-primary" : "opacity-40")} />
      </span>
    </th>
  );
}