import { queryOptions } from "@tanstack/react-query";
import { getSheetsKpi } from "./sheets.functions";

export const kpiQueryOptions = queryOptions({
  queryKey: ["aux", "kpi", "sheets"],
  queryFn: () => getSheetsKpi(),
  staleTime: 5 * 60_000,
});