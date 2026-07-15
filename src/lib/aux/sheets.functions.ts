import { createServerFn } from "@tanstack/react-start";

const SHEET_ID = "1x796CMZf8b3RUNkqsanO56F_Wmo75L2uLzIlgE65doY";
const RANGE = "Sheet1!A2:AE"; // skip header row (columns A..AE)
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

// Column indices (0-based, relative to A) — matched to sheet headers:
// A Ticket Number · B Product Line · C Service Provider Name · D User Name
// E Tel · F Location · G Address · H Worker Name · I Service Type
// J Product Type · K Service Information · L Processing Phase · M Ticket Status
// N Affiliated Service Center · O Order Creation Time · P Installation Date
// Q Ticket Source · R Dispatch Point Time · S Rejection Of Documents
// T Completion Result · U Completion Time · V Service Hours(H) · W Service Timeliness
// X Builder · Y Appointed Date · Z Rescheduling · AA Reason For Rescheduling
// AB Reasons Supplemented · AC Maintenance Instructions · AD Mileage · AE Consultation Type
const COL = {
  ticket: 0,
  productLine: 1,
  serviceProvider: 2,
  location: 5,
  workerName: 7,
  serviceType: 8,
  productType: 9,
  ticketStatus: 12,
  orderCreation: 14,
  installationDate: 15,
  ticketSource: 16,
  completionResult: 19,
  completionTime: 20,
  serviceHours: 21,
  serviceTimeliness: 22,
  builder: 23,
  appointedDate: 24,
  rescheduling: 25,
  rescheduleReason: 26,
  remark: 27,        // "Reasons Supplemented"
  maintenance: 28,   // "Maintenance Instructions"
} as const;

export interface MonthKpi {
  month: string;
  label: string;
  total: number;
  pending: number;
  completed: number;
  rate48h: number;
  rate72h: number;
  count48h: number;
  count72h: number;
  rescheduled: number;
}
export interface DailyRow {
  date: string;
  weekday: string;
  incoming: number;
  completed: number;
  pending: number;
  rescheduled: number;
}
export interface CountRow {
  key: string;
  count: number;
}
export interface BranchKpi {
  branch: string;
  total: number;
  completed: number;
  pending: number;
  rate48h: number;
  rate72h: number;
  csat: number;
}
export interface PendingTicket {
  ticket: string;
  branch: string;
  worker: string;
  status: string;
  ageBucket: string;
  ageHours: number;
  reason: string;
  appointedDate: string;
  remark: string;
  parts: string;
  rescheduled: boolean;
  dispatched: boolean;
  unassigned: boolean;
}
export interface PendingBranchPivot {
  branch: string;
  b12: number;
  b24: number;
  b48: number;
  b72: number;
  over72: number;
  total: number;
}
export interface BranchAlert {
  branch: string;
  pending: number;
  noReason: number;
  visitToday: boolean;
}
export interface PendingSummary {
  todayVisits: number;
  totalPending: number;
  activeWorkers: number;
  dispatched: number;
  unassigned: number;
  aging: { bucket: string; count: number }[];
  reasons: { reason: string; count: number }[];
  tickets: PendingTicket[];
  todayTickets: PendingTicket[];
  branchPivot: PendingBranchPivot[];
  branchAlerts: BranchAlert[];
}
export interface CallCenterTicket {
  ticket: string;
  branch: string;
  serviceType: string;
  status: string;
  reason: string;
  createdAt: string;
  completed: boolean;
  worker: string;
}
export interface CallCenterSummary {
  total: number;
  pending: number;
  completed: number;
  byType: { type: string; count: number }[];
  byBranch: { branch: string; count: number }[];
  tickets: CallCenterTicket[];
}
export interface CityKpi {
  city: string;
  region: string;
  total: number;
  completed: number;
  pending: number;
  rate48h: number;
  rate72h: number;
  topProduct: string;
}
export interface InstallationTicket {
  ticket: string;
  branch: string;
  city: string;
  productLine: string;
  productType: string;
  status: string;
  worker: string;
  createdAt: string;
  installationDate: string;
  completed: boolean;
  ageDays: number;
}
export interface InstallationSummary {
  total: number;
  pending: number;
  completed: number;
  scheduledToday: number;
  avgLeadDays: number;
  byProduct: { product: string; count: number }[];
  byCity: { city: string; count: number; pending: number }[];
  byBranch: { branch: string; count: number; pending: number }[];
  tickets: InstallationTicket[];
}
// ---------------- Warranty Payments ----------------
// Warranty payout is derived from completed repair tickets.
// Rate per product line (SAR) — adjust these to match the real warranty tariff.
export const WARRANTY_RATES: { match: string; rate: number }[] = [
  { match: "split", rate: 180 },
  { match: "cassette", rate: 260 },
  { match: "duct", rate: 320 },
  { match: "floor", rate: 220 },
  { match: "window", rate: 140 },
  { match: "vrf", rate: 420 },
  { match: "chiller", rate: 520 },
  { match: "portable", rate: 120 },
];
export const WARRANTY_DEFAULT_RATE = 180;
// SLA-miss deduction (percent) applied to claims completed above the 72h target.
export const WARRANTY_SLA_DEDUCTION_PCT = 15;

export type WarrantyStatus = "paid" | "approved" | "submitted";
export interface WarrantyClaim {
  ticket: string;
  branch: string;
  city: string;
  productLine: string;
  createdAt: string;
  completedAt: string;
  serviceHours: number;
  status: WarrantyStatus;
  gross: number;
  deduction: number;
  net: number;
}
export interface WarrantyBranchRow {
  branch: string;
  claims: number;
  paid: number;
  approved: number;
  submitted: number;
  gross: number;
  deduction: number;
  net: number;
}
export interface WarrantyMonthRow {
  month: string;
  label: string;
  claims: number;
  gross: number;
  deduction: number;
  net: number;
}
export interface WarrantyProductRow {
  product: string;
  rate: number;
  claims: number;
  net: number;
}
export interface WarrantySummary {
  totalClaims: number;
  paid: number;
  approved: number;
  submitted: number;
  gross: number;
  deduction: number;
  net: number;
  paidRate: number;
  avgClaim: number;
  byBranch: WarrantyBranchRow[];
  byMonth: WarrantyMonthRow[];
  byProduct: WarrantyProductRow[];
  recentClaims: WarrantyClaim[];
}
export interface Snapshot {
  total: number;
  pending: number;
  pendingNoReason: number;
  unassigned: number;
  completed: number;
  rate48h: number;
  rate72h: number;
  rescheduled: number;
}
export interface KpiData {
  fetchedAt: string;
  rowCount: number;
  snapshot: Snapshot;
  monthly: MonthKpi[];
  daily: DailyRow[];
  pendingByReason: { reason: string; count: number }[];
  pendingByBranch: { branch: string; count: number }[];
  pendingAging: { bucket: string; count: number }[];
  branches: BranchKpi[];
  pending: PendingSummary;
  callCenter: CallCenterSummary;
  cities: CityKpi[];
  installation: InstallationSummary;
  warranty: WarrantySummary;
  error?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  // sheet format: "2026-07-15 14:56:26" -> replace space with T, treat as UTC-ish
  const s = String(v).trim().replace(" ", "T");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeBranch(raw: string): string {
  if (!raw) return "Unknown";
  // Format: "<Company ...> - <City>"  →  "<City> - <CompanyFirstWord>"
  const parts = raw.split(/\s*[-–]\s*/);
  if (parts.length >= 2) {
    const company = parts[0].trim().split(/\s+/)[0] || parts[0].trim();
    const city = parts.slice(1).join(" - ").trim();
    return `${city} - ${company}`;
  }
  return raw.trim();
}

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "no" && s !== "false" && s !== "not rescheduled";
}

function isCompleted(row: string[]): boolean {
  const compTime = row[COL.completionTime];
  const compRes = row[COL.completionResult];
  return Boolean((compTime && String(compTime).trim()) || (compRes && String(compRes).trim()));
}

// simple in-memory cache to avoid hammering Sheets on every request
let cache: { at: number; data: KpiData } | null = null;
const CACHE_MS = 5 * 60_000;

async function fetchSheetRows(): Promise<string[][]> {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  const lov = process.env.LOVABLE_API_KEY;
  if (!key || !lov) throw new Error("Google Sheets connector not configured");
  const url = `${GATEWAY}/spreadsheets/${SHEET_ID}/values/${RANGE}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lov}`,
      "X-Connection-Api-Key": key,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets fetch failed [${res.status}]: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { values?: string[][] };
  return json.values ?? [];
}

function aggregate(rows: string[][]): KpiData {
  const now = new Date();
  const todayISO = localISODate(now);
  const monthMap = new Map<string, MonthKpi>();
  const dayMap = new Map<string, DailyRow>();
  const reasonMap = new Map<string, number>();
  const branchPending = new Map<string, number>();
  const branchStats = new Map<
    string,
    { total: number; completed: number; pending: number; c48: number; c72: number }
  >();
  const aging = { "0–24h": 0, "24–48h": 0, "48–72h": 0, "3–7d": 0, "7–14d": 0, "14d+": 0 };

  // Pending-focused accumulators
  const pendingAging5 = { "≤ 12 Hours": 0, "≤ 24 Hours": 0, "≤ 48 Hours": 0, "≤ 72 Hours": 0, "> 72 Hours": 0 };
  const pendingReasonMap = new Map<string, number>();
  const pendingTickets: PendingTicket[] = [];
  const branchPivotMap = new Map<string, PendingBranchPivot>();
  const branchAlertMap = new Map<string, BranchAlert>();
  const activeWorkerSet = new Set<string>();
  let dispatchedCount = 0;
  let todayVisitsCount = 0;

  let total = 0;
  let pending = 0;
  let completed = 0;
  let unassigned = 0;
  let pendingNoReason = 0;
  let rescheduledAll = 0;

  // Call center bucket (non-Repair service types — handled by agents, not ASC)
  const callCenterTickets: CallCenterTicket[] = [];
  const ccTypeMap = new Map<string, number>();
  const ccBranchMap = new Map<string, number>();
  let ccCompleted = 0;

  // Installation bucket
  const installationTickets: InstallationTicket[] = [];
  const instProductMap = new Map<string, number>();
  const instCityMap = new Map<string, { count: number; pending: number }>();
  const instBranchMap = new Map<string, { count: number; pending: number }>();
  let instCompleted = 0;
  let instScheduledToday = 0;
  let instLeadDaysSum = 0;
  let instLeadDaysCount = 0;

  // City breakdown
  const cityMap = new Map<
    string,
    {
      city: string;
      region: string;
      total: number;
      completed: number;
      pending: number;
      c48: number;
      c72: number;
      products: Map<string, number>;
    }
  >();

  // Warranty accumulators (repair tickets only, populated inside the loop)
  const warrantyClaims: WarrantyClaim[] = [];
  const warrantyByBranch = new Map<string, WarrantyBranchRow>();
  const warrantyByMonth = new Map<string, WarrantyMonthRow>();
  const warrantyByProduct = new Map<string, WarrantyProductRow>();
  let warrGross = 0;
  let warrDeduction = 0;
  let warrPaid = 0;
  let warrApproved = 0;
  let warrSubmitted = 0;

  // Prep last 30 days buckets
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    dayMap.set(iso, {
      date: iso,
      weekday: WEEKDAYS[d.getDay()],
      incoming: 0,
      completed: 0,
      pending: 0,
      rescheduled: 0,
    });
  }

  for (const row of rows) {
    if (!row || !row[COL.ticket]) continue;

    const rawServiceType = String(row[COL.serviceType] ?? "").trim();
    const serviceTypeLower = rawServiceType.toLowerCase();
    const isRepair = serviceTypeLower === "repair" || serviceTypeLower.includes("repair") && !serviceTypeLower.includes("easy");

    const created = parseDate(row[COL.orderCreation]);
    const done = isCompleted(row);
    const status = String(row[COL.ticketStatus] ?? "").trim();
    const branch = normalizeBranch(String(row[COL.serviceProvider] ?? ""));

    const locRawEarly = String(row[COL.location] ?? "").trim();
    const cityEarly = locRawEarly
      ? (locRawEarly.split(/[\/,>·|]/).map((p) => p.trim()).filter(Boolean)[1] ?? "Unknown")
      : "Unknown";

    // Installation bucket — separate from repair and call-center
    const isInstallation = serviceTypeLower.includes("install");
    if (isInstallation) {
      const productLine = String(row[COL.productLine] ?? "").trim() || "—";
      const productType = String(row[COL.productType] ?? "").trim() || "—";
      instProductMap.set(productLine, (instProductMap.get(productLine) ?? 0) + 1);
      const ci = instCityMap.get(cityEarly) ?? { count: 0, pending: 0 };
      ci.count++;
      if (!done) ci.pending++;
      instCityMap.set(cityEarly, ci);
      const bi = instBranchMap.get(branch) ?? { count: 0, pending: 0 };
      bi.count++;
      if (!done) bi.pending++;
      instBranchMap.set(branch, bi);
      if (done) instCompleted++;
      const instDate = parseDate(row[COL.installationDate]);
      const instISO = instDate ? localISODate(instDate) : "";
      if (instISO === todayISO) instScheduledToday++;
      if (created && instDate) {
        const lead = (instDate.getTime() - created.getTime()) / 86_400_000;
        if (lead >= 0 && lead < 365) {
          instLeadDaysSum += lead;
          instLeadDaysCount++;
        }
      }
      const ageDays = created ? (now.getTime() - created.getTime()) / 86_400_000 : 0;
      installationTickets.push({
        ticket: String(row[COL.ticket] ?? "").trim(),
        branch,
        city: cityEarly,
        productLine,
        productType,
        status: status || "—",
        worker: String(row[COL.workerName] ?? "").trim() || "Not Assigned",
        createdAt: created ? created.toISOString().slice(0, 10) : "—",
        installationDate: instISO || "—",
        completed: done,
        ageDays: Math.max(0, Math.round(ageDays * 10) / 10),
      });
      continue;
    }

    // Non-repair, non-installation (Consultation / Easy repair / etc.) — call center.
    if (!isRepair) {
      const label = rawServiceType || "Unknown";
      ccTypeMap.set(label, (ccTypeMap.get(label) ?? 0) + 1);
      ccBranchMap.set(branch, (ccBranchMap.get(branch) ?? 0) + 1);
      if (done) ccCompleted++;
      callCenterTickets.push({
        ticket: String(row[COL.ticket] ?? "").trim(),
        branch,
        serviceType: label,
        status: status || "—",
        reason: String(row[COL.rescheduleReason] ?? "").trim() || "—",
        createdAt: created ? created.toISOString().slice(0, 10) : "—",
        completed: done,
        worker: String(row[COL.workerName] ?? "").trim() || "—",
      });
      continue;
    }

    total++;
    const resched = isTruthy(row[COL.rescheduling]);
    if (resched) rescheduledAll++;

    // service hours
    const hrs = Number(String(row[COL.serviceHours] ?? "").trim());
    const under48 = done && !isNaN(hrs) && hrs <= 48;
    const under72 = done && !isNaN(hrs) && hrs <= 72;

    let bs = branchStats.get(branch);
    if (!bs) {
      bs = { total: 0, completed: 0, pending: 0, c48: 0, c72: 0 };
      branchStats.set(branch, bs);
    }
    bs.total++;
    if (done) bs.completed++;
    else bs.pending++;
    if (under48) bs.c48++;
    if (under72) bs.c72++;

    // ---------------- Warranty claim per repair ticket ----------------
    {
      const productLine = String(row[COL.productLine] ?? "").trim() || "Other";
      const pl = productLine.toLowerCase();
      const rate =
        WARRANTY_RATES.find((r) => pl.includes(r.match))?.rate ?? WARRANTY_DEFAULT_RATE;
      const gross = rate;
      let status: WarrantyStatus;
      let deduction = 0;
      if (!done) {
        status = "submitted";
      } else if (under72) {
        status = "paid";
      } else {
        status = "approved";
        deduction = Math.round((gross * WARRANTY_SLA_DEDUCTION_PCT) / 100);
      }
      const net = gross - deduction;
      warrGross += gross;
      warrDeduction += deduction;
      if (status === "paid") warrPaid++;
      else if (status === "approved") warrApproved++;
      else warrSubmitted++;

      let br = warrantyByBranch.get(branch);
      if (!br) {
        br = { branch, claims: 0, paid: 0, approved: 0, submitted: 0, gross: 0, deduction: 0, net: 0 };
        warrantyByBranch.set(branch, br);
      }
      br.claims++;
      br.gross += gross;
      br.deduction += deduction;
      br.net += net;
      if (status === "paid") br.paid++;
      else if (status === "approved") br.approved++;
      else br.submitted++;

      const claimDate = done ? parseDate(row[COL.completionTime]) ?? created : created;
      if (claimDate) {
        const ym = claimDate.toISOString().slice(0, 7);
        let mr = warrantyByMonth.get(ym);
        if (!mr) {
          mr = {
            month: ym,
            label: claimDate.toLocaleString("en-US", { month: "short" }),
            claims: 0,
            gross: 0,
            deduction: 0,
            net: 0,
          };
          warrantyByMonth.set(ym, mr);
        }
        mr.claims++;
        mr.gross += gross;
        mr.deduction += deduction;
        mr.net += net;
      }

      let pr = warrantyByProduct.get(productLine);
      if (!pr) {
        pr = { product: productLine, rate, claims: 0, net: 0 };
        warrantyByProduct.set(productLine, pr);
      }
      pr.claims++;
      pr.net += net;

      warrantyClaims.push({
        ticket: String(row[COL.ticket] ?? "").trim(),
        branch,
        city: cityEarly,
        productLine,
        createdAt: created ? created.toISOString().slice(0, 10) : "—",
        completedAt:
          done && parseDate(row[COL.completionTime])
            ? parseDate(row[COL.completionTime])!.toISOString().slice(0, 10)
            : "—",
        serviceHours: isNaN(hrs) ? 0 : hrs,
        status,
        gross,
        deduction,
        net,
      });
    }

    // City aggregation from Location column: "Region/City/District"
    const locRaw = String(row[COL.location] ?? "").trim();
    if (locRaw) {
      const locParts = locRaw.split(/[\/,>·|]/).map((p) => p.trim()).filter(Boolean);
      const region = locParts[0] ?? "—";
      const city = locParts[1] ?? locParts[0] ?? "Unknown";
      const cityKey = `${region}||${city}`;
      let cs = cityMap.get(cityKey);
      if (!cs) {
        cs = {
          city,
          region,
          total: 0,
          completed: 0,
          pending: 0,
          c48: 0,
          c72: 0,
          products: new Map(),
        };
        cityMap.set(cityKey, cs);
      }
      cs.total++;
      if (done) cs.completed++;
      else cs.pending++;
      if (under48) cs.c48++;
      if (under72) cs.c72++;
      const prod = String(row[COL.productLine] ?? "").trim();
      if (prod) cs.products.set(prod, (cs.products.get(prod) ?? 0) + 1);
    }

    if (done) completed++;
    else {
      pending++;
      const statusLower = status.toLowerCase();
      const workerBlank = !String(row[COL.workerName] ?? "").trim();
      const isUnassigned = workerBlank;
      const isDispatched = statusLower.includes("dispatch");
      if (isUnassigned) unassigned++;
      if (isDispatched) dispatchedCount++;
      const reason = String(row[COL.rescheduleReason] ?? "").trim();
      if (!reason) pendingNoReason++;
      else reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
      branchPending.set(branch, (branchPending.get(branch) ?? 0) + 1);

      const ageH = created ? (now.getTime() - created.getTime()) / 36e5 : 0;
      if (created) {
        if (ageH < 24) aging["0–24h"]++;
        else if (ageH < 48) aging["24–48h"]++;
        else if (ageH < 72) aging["48–72h"]++;
        else if (ageH < 24 * 7) aging["3–7d"]++;
        else if (ageH < 24 * 14) aging["7–14d"]++;
        else aging["14d+"]++;
      }

      // 5-bucket pending aging
      let bucket5: keyof typeof pendingAging5;
      if (ageH <= 12) bucket5 = "≤ 12 Hours";
      else if (ageH <= 24) bucket5 = "≤ 24 Hours";
      else if (ageH <= 48) bucket5 = "≤ 48 Hours";
      else if (ageH <= 72) bucket5 = "≤ 72 Hours";
      else bucket5 = "> 72 Hours";
      pendingAging5[bucket5]++;

      const reasonLabel = reason || "(No reason)";
      pendingReasonMap.set(reasonLabel, (pendingReasonMap.get(reasonLabel) ?? 0) + 1);

      const worker = String(row[COL.builder] ?? "").trim() || "";
      const workerName = String(row[COL.workerName] ?? "").trim();
      const effectiveWorker = workerName || worker;
      const isUnassignedByName = !workerName;
      const appointed = String(row[COL.appointedDate] ?? "").trim();
      // extract yyyy-mm-dd (or dd/mm/yyyy) prefix
      let appointedISO = "";
      const isoMatch = appointed.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) appointedISO = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      else {
        const d2 = parseDate(appointed);
        if (d2) appointedISO = localISODate(d2);
      }
      const isToday = appointedISO === todayISO;
      if (isToday) {
        todayVisitsCount++;
        if (worker && !isUnassigned) activeWorkerSet.add(`${branch}::${worker}`);
      }

      const ticket: PendingTicket = {
        ticket: String(row[COL.ticket] ?? "").trim(),
        branch,
        worker: isUnassignedByName ? "Not Assigned" : effectiveWorker,
        status: status || "Not assigned",
        ageBucket: bucket5,
        ageHours: Math.max(0, Math.round(ageH * 10) / 10),
        reason: reason || "—",
        appointedDate: appointedISO || appointed || "—",
        remark: String(row[COL.remark] ?? "").trim() || "—",
        parts: String(row[COL.maintenance] ?? "").trim() || "—",
        rescheduled: resched,
        dispatched: isDispatched,
        unassigned: isUnassignedByName,
      };
      pendingTickets.push(ticket);

      // pivot
      let piv = branchPivotMap.get(branch);
      if (!piv) {
        piv = { branch, b12: 0, b24: 0, b48: 0, b72: 0, over72: 0, total: 0 };
        branchPivotMap.set(branch, piv);
      }
      if (bucket5 === "≤ 12 Hours") piv.b12++;
      else if (bucket5 === "≤ 24 Hours") piv.b24++;
      else if (bucket5 === "≤ 48 Hours") piv.b48++;
      else if (bucket5 === "≤ 72 Hours") piv.b72++;
      else piv.over72++;
      piv.total++;

      // alerts
      let al = branchAlertMap.get(branch);
      if (!al) {
        al = { branch, pending: 0, noReason: 0, visitToday: false };
        branchAlertMap.set(branch, al);
      }
      al.pending++;
      if (!reason) al.noReason++;
      if (isToday) al.visitToday = true;
    }

    // Monthly
    if (created) {
      const ym = created.toISOString().slice(0, 7);
      let m = monthMap.get(ym);
      if (!m) {
        const label = created.toLocaleString("en-US", { month: "short" });
        m = {
          month: ym,
          label,
          total: 0,
          pending: 0,
          completed: 0,
          rate48h: 0,
          rate72h: 0,
          count48h: 0,
          count72h: 0,
          rescheduled: 0,
        };
        monthMap.set(ym, m);
      }
      m.total++;
      if (done) m.completed++;
      else m.pending++;
      if (under48) m.count48h++;
      if (under72) m.count72h++;
      if (resched) m.rescheduled++;

      // Daily (last 30 days)
      const iso = created.toISOString().slice(0, 10);
      const dr = dayMap.get(iso);
      if (dr) {
        dr.incoming++;
        if (done) dr.completed++;
        else dr.pending++;
        if (resched) dr.rescheduled++;
      }
    }
  }

  // finalize monthly rates
  const monthly = Array.from(monthMap.values())
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .slice(-12)
    .map((m) => ({
      ...m,
      rate48h: m.completed > 0 ? Math.round((m.count48h / m.completed) * 1000) / 10 : 0,
      rate72h: m.completed > 0 ? Math.round((m.count72h / m.completed) * 1000) / 10 : 0,
    }));

  // Snapshot rates from completed tickets overall
  let totalUnder48 = 0;
  let totalUnder72 = 0;
  for (const m of monthly) {
    totalUnder48 += m.count48h;
    totalUnder72 += m.count72h;
  }
  const snapshot: Snapshot = {
    total,
    pending,
    completed,
    unassigned,
    pendingNoReason,
    rate48h: completed > 0 ? Math.round((totalUnder48 / completed) * 1000) / 10 : 0,
    rate72h: completed > 0 ? Math.round((totalUnder72 / completed) * 1000) / 10 : 0,
    rescheduled: rescheduledAll,
  };

  const pendingByReason = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const pendingByBranch = Array.from(branchPending.entries())
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const pendingAging = (Object.keys(aging) as (keyof typeof aging)[]).map((bucket) => ({
    bucket,
    count: aging[bucket],
  }));

  // Sort pending tickets: rescheduled-today first, then by age desc
  pendingTickets.sort((a, b) => {
    const at = a.appointedDate === todayISO ? 1 : 0;
    const bt = b.appointedDate === todayISO ? 1 : 0;
    if (at !== bt) return bt - at;
    return b.ageHours - a.ageHours;
  });
  const todayTickets = pendingTickets.filter(
    (t) => t.appointedDate === todayISO && t.rescheduled,
  );
  const pendingSummary: PendingSummary = {
    todayVisits: todayVisitsCount,
    totalPending: pending,
    activeWorkers: activeWorkerSet.size,
    dispatched: dispatchedCount,
    unassigned,
    aging: (Object.keys(pendingAging5) as (keyof typeof pendingAging5)[]).map((k) => ({
      bucket: k,
      count: pendingAging5[k],
    })),
    reasons: Array.from(pendingReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    tickets: pendingTickets,
    todayTickets,
    branchPivot: Array.from(branchPivotMap.values()).sort((a, b) => b.total - a.total),
    branchAlerts: Array.from(branchAlertMap.values()).sort((a, b) => b.pending - a.pending),
  };

  // Sort call center by newest first
  callCenterTickets.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const callCenter: CallCenterSummary = {
    total: callCenterTickets.length,
    pending: callCenterTickets.filter((t) => !t.completed).length,
    completed: ccCompleted,
    byType: Array.from(ccTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    byBranch: Array.from(ccBranchMap.entries())
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    tickets: callCenterTickets,
  };

  const cities: CityKpi[] = Array.from(cityMap.values())
    .map((c) => {
      let topProduct = "—";
      let max = 0;
      for (const [p, n] of c.products) {
        if (n > max) {
          max = n;
          topProduct = p;
        }
      }
      return {
        city: c.city,
        region: c.region,
        total: c.total,
        completed: c.completed,
        pending: c.pending,
        rate48h: c.completed > 0 ? Math.round((c.c48 / c.completed) * 1000) / 10 : 0,
        rate72h: c.completed > 0 ? Math.round((c.c72 / c.completed) * 1000) / 10 : 0,
        topProduct,
      };
    })
    .sort((a, b) => b.total - a.total);

  installationTickets.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const installation: InstallationSummary = {
    total: installationTickets.length,
    pending: installationTickets.filter((t) => !t.completed).length,
    completed: instCompleted,
    scheduledToday: instScheduledToday,
    avgLeadDays:
      instLeadDaysCount > 0
        ? Math.round((instLeadDaysSum / instLeadDaysCount) * 10) / 10
        : 0,
    byProduct: Array.from(instProductMap.entries())
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count),
    byCity: Array.from(instCityMap.entries())
      .map(([city, s]) => ({ city, ...s }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    byBranch: Array.from(instBranchMap.entries())
      .map(([branch, s]) => ({ branch, ...s }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    tickets: installationTickets,
  };

  // Warranty summary
  const warrNet = warrGross - warrDeduction;
  const warrTotal = warrPaid + warrApproved + warrSubmitted;
  warrantyClaims.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const warranty: WarrantySummary = {
    totalClaims: warrTotal,
    paid: warrPaid,
    approved: warrApproved,
    submitted: warrSubmitted,
    gross: warrGross,
    deduction: warrDeduction,
    net: warrNet,
    paidRate: warrTotal > 0 ? Math.round((warrPaid / warrTotal) * 1000) / 10 : 0,
    avgClaim: warrTotal > 0 ? Math.round(warrNet / warrTotal) : 0,
    byBranch: Array.from(warrantyByBranch.values())
      .sort((a, b) => b.net - a.net)
      .slice(0, 20),
    byMonth: Array.from(warrantyByMonth.values())
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .slice(-12),
    byProduct: Array.from(warrantyByProduct.values()).sort((a, b) => b.net - a.net),
    recentClaims: warrantyClaims.slice(0, 200),
  };

  const branches: BranchKpi[] = Array.from(branchStats.entries())
    .map(([branch, s]) => ({
      branch,
      total: s.total,
      completed: s.completed,
      pending: s.pending,
      rate48h: s.completed > 0 ? Math.round((s.c48 / s.completed) * 1000) / 10 : 0,
      rate72h: s.completed > 0 ? Math.round((s.c72 / s.completed) * 1000) / 10 : 0,
      csat: 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    fetchedAt: new Date().toISOString(),
    rowCount: rows.length,
    snapshot,
    monthly,
    daily: Array.from(dayMap.values()),
    pendingByReason,
    pendingByBranch,
    pendingAging,
    branches,
    pending: pendingSummary,
    callCenter,
    cities,
    installation,
    warranty,
  };
}

export const getSheetsKpi = createServerFn({ method: "GET" }).handler(async (): Promise<KpiData> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const rows = await fetchSheetRows();
    const data = aggregate(rows);
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sheets-kpi] failed:", msg);
    return {
      fetchedAt: new Date().toISOString(),
      rowCount: 0,
      snapshot: {
        total: 0,
        pending: 0,
        pendingNoReason: 0,
        unassigned: 0,
        completed: 0,
        rate48h: 0,
        rate72h: 0,
        rescheduled: 0,
      },
      monthly: [],
      daily: [],
      pendingByReason: [],
      pendingByBranch: [],
      pendingAging: [],
      branches: [],
      pending: {
        todayVisits: 0,
        totalPending: 0,
        activeWorkers: 0,
        dispatched: 0,
        unassigned: 0,
        aging: [],
        reasons: [],
        tickets: [],
        todayTickets: [],
        branchPivot: [],
        branchAlerts: [],
      },
      callCenter: { total: 0, pending: 0, completed: 0, byType: [], byBranch: [], tickets: [] },
      cities: [],
      installation: {
        total: 0,
        pending: 0,
        completed: 0,
        scheduledToday: 0,
        avgLeadDays: 0,
        byProduct: [],
        byCity: [],
        byBranch: [],
        tickets: [],
      },
      warranty: {
        totalClaims: 0,
        paid: 0,
        approved: 0,
        submitted: 0,
        gross: 0,
        deduction: 0,
        net: 0,
        paidRate: 0,
        avgClaim: 0,
        byBranch: [],
        byMonth: [],
        byProduct: [],
        recentClaims: [],
      },
      error: msg,
    };
  }
});