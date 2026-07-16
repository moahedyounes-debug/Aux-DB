import { queryOptions } from "@tanstack/react-query";
import { getSheetsKpi, getAssignmentLog, getSatisfactionSurveys, type KpiFilters } from "./sheets.functions";
export type { KpiFilters } from "./sheets.functions";
import {
  getPartsData,
  getAccessData,
  getActivityData,
  getUploadLogs,
  getAscRemarks,
} from "./tabs.functions";

export const kpiQueryOptions = (filters: KpiFilters = {}) => queryOptions({
  queryKey: ["aux", "kpi", "sheets", filters],
  queryFn: () => getSheetsKpi({ data: filters }),
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

export const partsQueryOptions = queryOptions({
  queryKey: ["aux", "parts"],
  queryFn: () => getPartsData(),
  staleTime: 5 * 60_000,
});

export const accessQueryOptions = queryOptions({
  queryKey: ["aux", "access"],
  queryFn: () => getAccessData(),
  staleTime: 10 * 60_000,
});

export const activityQueryOptions = queryOptions({
  queryKey: ["aux", "activity"],
  queryFn: () => getActivityData(),
  staleTime: 60_000,
});

export const uploadsQueryOptions = queryOptions({
  queryKey: ["aux", "uploads"],
  queryFn: () => getUploadLogs(),
  staleTime: 60_000,
});

export const ascRemarksQueryOptions = queryOptions({
  queryKey: ["aux", "ascremarks"],
  queryFn: () => getAscRemarks(),
  staleTime: 5 * 60_000,
});