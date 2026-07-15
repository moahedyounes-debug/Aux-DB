// Deterministic mock ticket dataset for the KPI Overview.
// Replace with the real Google Sheets loader when integrations are wired up.

export interface MonthKpi {
  month: string; // YYYY-MM
  label: string; // e.g. "Jan"
  total: number;
  pending: number;
  completed: number;
  rate48h: number; // percent 0-100
  rate72h: number;
  count48h: number;
  count72h: number;
  rescheduled: number;
}

export interface PendingReason {
  reason: string;
  count: number;
}

export const MONTHLY: MonthKpi[] = [
  { month: "2026-01", label: "Jan", total: 1180, pending: 210, completed: 970, rate48h: 62, rate72h: 78, count48h: 601, count72h: 757, rescheduled: 84 },
  { month: "2026-02", label: "Feb", total: 1042, pending: 176, completed: 866, rate48h: 65, rate72h: 81, count48h: 563, count72h: 701, rescheduled: 72 },
  { month: "2026-03", label: "Mar", total: 1289, pending: 248, completed: 1041, rate48h: 60, rate72h: 76, count48h: 624, count72h: 791, rescheduled: 96 },
  { month: "2026-04", label: "Apr", total: 1355, pending: 232, completed: 1123, rate48h: 68, rate72h: 84, count48h: 763, count72h: 943, rescheduled: 78 },
  { month: "2026-05", label: "May", total: 1421, pending: 269, completed: 1152, rate48h: 66, rate72h: 82, count48h: 760, count72h: 944, rescheduled: 103 },
  { month: "2026-06", label: "Jun", total: 1502, pending: 254, completed: 1248, rate48h: 71, rate72h: 86, count48h: 886, count72h: 1073, rescheduled: 91 },
  { month: "2026-07", label: "Jul", total: 1602, pending: 278, completed: 1324, rate48h: 74, rate72h: 88, count48h: 979, count72h: 1165, rescheduled: 88 },
];

export const PENDING_BY_REASON: PendingReason[] = [
  { reason: "Awaiting spare part", count: 96 },
  { reason: "Customer unreachable", count: 72 },
  { reason: "Rescheduled by customer", count: 54 },
  { reason: "Technician unavailable", count: 41 },
  { reason: "Warranty verification", count: 33 },
  { reason: "Address issue", count: 21 },
  { reason: "No reason provided", count: 18 },
];

export interface Snapshot {
  total: number;
  pending: number;
  pendingNoReason: number;
  unassigned: number;
  completed: number;
  rate48h: number;
  rate72h: number;
}

export function currentSnapshot(): Snapshot {
  const total = MONTHLY.reduce((s, m) => s + m.total, 0);
  const pending = MONTHLY.reduce((s, m) => s + m.pending, 0);
  const completed = MONTHLY.reduce((s, m) => s + m.completed, 0);
  const last = MONTHLY[MONTHLY.length - 1];
  return {
    total,
    pending,
    pendingNoReason: PENDING_BY_REASON.find((r) => r.reason === "No reason provided")?.count ?? 0,
    unassigned: 47,
    completed,
    rate48h: last.rate48h,
    rate72h: last.rate72h,
  };
}

export const TARGETS = {
  pendingRate: 15,
  rate48h: 70,
  rate72h: 85,
};