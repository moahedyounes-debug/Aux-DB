import { queryOptions } from "@tanstack/react-query";
import { getSheetsKpi } from "./sheets.functions";
import { getCallsSnapshot } from "./calls.functions";
import { getCICSnapshot } from "./cic.functions";

export const kpiQueryOptions = queryOptions({
  queryKey: ["aux", "kpi", "sheets"],
  queryFn: () => getSheetsKpi(),
  staleTime: 5 * 60_000,
});

export const callsQueryOptions = queryOptions({
  queryKey: ["aux", "calls"],
  queryFn: () => getCallsSnapshot(),
  staleTime: 10 * 60_000,
});

export const cicQueryOptions = queryOptions({
  queryKey: ["aux", "cic"],
  queryFn: () => getCICSnapshot(),
  staleTime: 10 * 60_000,
});