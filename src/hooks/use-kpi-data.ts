import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { kpiQueryOptions } from "@/lib/aux/queries";
import { useGlobalFilters } from "@/hooks/use-global-filters";
import type { KpiData } from "@/lib/aux/sheets.functions";

/**
 * Reads the aggregated KPI dataset with the current global sidebar
 * filters applied on the server. Wraps `useSuspenseQuery` so route
 * loaders and Suspense boundaries keep working.
 */
export function useKpiData(): { data: KpiData } {
  const { filters } = useGlobalFilters();
  const q = useSuspenseQuery(
    kpiQueryOptions({
      month: filters.month,
      from: filters.from,
      to: filters.to,
      asc: filters.asc,
      branch: filters.branch,
      worker: filters.worker,
    }),
  );
  return { data: q.data };
}

/** Non-suspense variant when the caller wants to render skeletons. */
export function useKpiDataQuery() {
  const { filters } = useGlobalFilters();
  return useQuery(
    kpiQueryOptions({
      month: filters.month,
      from: filters.from,
      to: filters.to,
      asc: filters.asc,
      branch: filters.branch,
      worker: filters.worker,
    }),
  );
}