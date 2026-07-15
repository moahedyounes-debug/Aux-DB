import { queryOptions } from "@tanstack/react-query";
import { getSheetsKpi, getAssignmentLog, getSatisfactionSurveys } from "./sheets.functions";

export const kpiQueryOptions = queryOptions({
  queryKey: ["aux", "kpi", "sheets"],
  queryFn: () => getSheetsKpi(),
  staleTime: 5 * 60_000,
});

export const assignmentQueryOptions = queryOptions({
  queryKey: ["aux", "assignment"],
  queryFn: () => getAssignmentLog(),
  staleTime: 10 * 60_000,
});

export const satisfactionQueryOptions = queryOptions({
  queryKey: ["aux", "satisfaction"],
  queryFn: () => getSatisfactionSurveys(),
  staleTime: 10 * 60_000,
});