import { createServerFn } from "@tanstack/react-start";

const CALLS_SHEET_ID = "1U-GUCKqShHLkqg4FvCur-T0Tic0cMAP1ou9hvoSw_FI";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

// Calls sheet columns (A..AH)
const CALL = {
  date: 0,
  queue: 1,
  agent: 2,
  number: 3,
  event: 4,
  waitTime: 5,
  talkTime: 6,
  did: 7,
  uniqueId: 8,
  aht: 9,
  tht: 10,
  agentName: 11,
  status: 12, // Answered / Abandoned
  callType: 13, // IB / OB
  dateFormat: 14,
  month: 15,
  week: 16,
  dayName: 17,
  time: 18,
  hour: 19,
  minute: 20,
  slap: 21,
  slap2: 22,
  withinSla: 23,
  qty: 24,
} as const;

// WhatsApp Uniqe columns (A..P)
const WA = {
  inbox: 0,
  name: 1,
  content: 2,
  createdAt: 3,
  channel: 4,
  qty: 5,
  date: 6,
  hour: 7,
  minute: 8,
  slap: 9,
  slap2: 10,
  day: 11,
  year: 12,
  month: 13,
  week: 14,
  dayName: 15,
} as const;

// WhatsApp Agents columns (A..L)
const WAG = {
  month: 0,
  name: 1,
  assigned: 2,
  closed: 3,
  uniqueClosed: 4,
  msgSent: 5,
  avgResolution: 6,
  avgFirstResolution: 7,
  maxResolution: 8,
  art: 9,
  aft: 10,
  mrt: 11,
} as const;

export interface CallMonthRow {
  month: string;
  inbound: number;
  outbound: number;
  answered: number;
  abandoned: number;
  withinSla: number;
  slaRate: number;
  answerRate: number;
}
export interface CallHourRow {
  hour: number;
  calls: number;
  answered: number;
}
export interface CallDayRow {
  day: string; // Sun..Sat
  calls: number;
  answered: number;
}
export interface CallAgentRow {
  agent: string;
  calls: number;
  answered: number;
  abandoned: number;
  answerRate: number;
}
export interface CallEventRow {
  event: string;
  count: number;
}
export interface CallRecent {
  dateTime: string;
  agent: string;
  number: string;
  callType: string;
  status: string;
  waitTime: string;
  talkTime: string;
  withinSla: boolean;
}
export interface CallsSummary {
  totalCalls: number;
  inbound: number;
  outbound: number;
  answered: number;
  abandoned: number;
  answerRate: number;
  withinSla: number;
  slaRate: number;
  byMonth: CallMonthRow[];
  byHour: CallHourRow[];
  byDay: CallDayRow[];
  byAgent: CallAgentRow[];
  byEvent: CallEventRow[];
  recent: CallRecent[];
}

export interface WhatsAppMonthRow {
  month: string;
  conversations: number;
  uniqueContacts: number;
}
export interface WhatsAppHourRow {
  hour: number;
  conversations: number;
}
export interface WhatsAppInboxRow {
  inbox: string;
  count: number;
}
export interface WhatsAppAgentRow {
  month: string;
  name: string;
  assigned: number;
  closed: number;
  uniqueClosed: number;
  msgSent: number;
  avgResolution: string;
  art: string;
}
export interface WhatsAppSummary {
  totalConversations: number;
  uniqueContacts: number;
  byMonth: WhatsAppMonthRow[];
  byHour: WhatsAppHourRow[];
  byInbox: WhatsAppInboxRow[];
  agents: WhatsAppAgentRow[];
}

export interface CallsData {
  fetchedAt: string;
  calls: CallsSummary;
  whatsapp: WhatsAppSummary;
  error?: string;
}

const MONTH_ORDER = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

function toInt(v: unknown): number {
  const n = Number(String(v ?? "").trim());
  return isNaN(n) ? 0 : n;
}

async function fetchRanges(spreadsheetId: string, ranges: string[]): Promise<Record<string, string[][]>> {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  const lov = process.env.LOVABLE_API_KEY;
  if (!key || !lov) throw new Error("Google Sheets connector not configured");
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `${GATEWAY}/spreadsheets/${spreadsheetId}/values:batchGet?${qs}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lov}`,
      "X-Connection-Api-Key": key,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets batchGet failed [${res.status}]: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    valueRanges?: { range: string; values?: string[][] }[];
  };
  const out: Record<string, string[][]> = {};
  for (const vr of json.valueRanges ?? []) {
    // Extract sheet name from range like "'WhatsApp Uniqe'!A2:P" or "Calls!A2:AH"
    const m = vr.range.match(/^'?([^'!]+)'?!/);
    if (m) out[m[1]] = vr.values ?? [];
  }
  return out;
}

function aggregateCalls(rows: string[][]): CallsSummary {
  let inbound = 0;
  let outbound = 0;
  let answered = 0;
  let abandoned = 0;
  let withinSla = 0;
  const monthMap = new Map<string, CallMonthRow>();
  const hourMap = new Map<number, CallHourRow>();
  const dayMap = new Map<string, CallDayRow>();
  const agentMap = new Map<string, CallAgentRow>();
  const eventMap = new Map<string, number>();
  const recent: CallRecent[] = [];

  for (const r of rows) {
    if (!r || !r[CALL.date]) continue;
    const status = String(r[CALL.status] ?? "").trim();
    const callType = String(r[CALL.callType] ?? "").trim().toUpperCase();
    const month = String(r[CALL.month] ?? "").trim();
    const day = String(r[CALL.dayName] ?? "").trim();
    const hour = toInt(r[CALL.hour]);
    const agent = String(r[CALL.agentName] ?? r[CALL.agent] ?? "").trim() || "—";
    const isAnswered = status.toLowerCase() === "answered";
    const isAbandoned = status.toLowerCase().includes("abandon");
    const sla = toInt(r[CALL.withinSla]) === 1;
    const event = String(r[CALL.event] ?? "").trim();

    if (callType === "IB") inbound++;
    else if (callType === "OB") outbound++;
    if (isAnswered) answered++;
    if (isAbandoned) abandoned++;
    if (sla) withinSla++;

    if (month) {
      let mr = monthMap.get(month);
      if (!mr) {
        mr = {
          month, inbound: 0, outbound: 0, answered: 0, abandoned: 0,
          withinSla: 0, slaRate: 0, answerRate: 0,
        };
        monthMap.set(month, mr);
      }
      if (callType === "IB") mr.inbound++;
      else if (callType === "OB") mr.outbound++;
      if (isAnswered) mr.answered++;
      if (isAbandoned) mr.abandoned++;
      if (sla) mr.withinSla++;
    }
    if (!isNaN(hour)) {
      let hr = hourMap.get(hour);
      if (!hr) { hr = { hour, calls: 0, answered: 0 }; hourMap.set(hour, hr); }
      hr.calls++;
      if (isAnswered) hr.answered++;
    }
    if (day) {
      let dr = dayMap.get(day);
      if (!dr) { dr = { day, calls: 0, answered: 0 }; dayMap.set(day, dr); }
      dr.calls++;
      if (isAnswered) dr.answered++;
    }
    if (agent && agent !== "—") {
      let ar = agentMap.get(agent);
      if (!ar) {
        ar = { agent, calls: 0, answered: 0, abandoned: 0, answerRate: 0 };
        agentMap.set(agent, ar);
      }
      ar.calls++;
      if (isAnswered) ar.answered++;
      if (isAbandoned) ar.abandoned++;
    }
    if (event) eventMap.set(event, (eventMap.get(event) ?? 0) + 1);

    if (recent.length < 200) {
      recent.push({
        dateTime: String(r[CALL.date]),
        agent,
        number: String(r[CALL.number] ?? "").trim(),
        callType,
        status,
        waitTime: String(r[CALL.waitTime] ?? "").trim(),
        talkTime: String(r[CALL.talkTime] ?? "").trim(),
        withinSla: sla,
      });
    }
  }

  const total = inbound + outbound;
  const byMonth = Array.from(monthMap.values())
    .map((m) => ({
      ...m,
      answerRate: (m.inbound + m.outbound) > 0
        ? Math.round((m.answered / (m.inbound + m.outbound)) * 1000) / 10 : 0,
      slaRate: m.answered > 0
        ? Math.round((m.withinSla / m.answered) * 1000) / 10 : 0,
    }))
    .sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));
  const byHour = Array.from(hourMap.values()).sort((a, b) => a.hour - b.hour);
  const dayOrder = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const byDay = Array.from(dayMap.values())
    .sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
  const byAgent = Array.from(agentMap.values())
    .map((a) => ({
      ...a,
      answerRate: a.calls > 0 ? Math.round((a.answered / a.calls) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 20);
  const byEvent = Array.from(eventMap.entries())
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCalls: total,
    inbound,
    outbound,
    answered,
    abandoned,
    answerRate: total > 0 ? Math.round((answered / total) * 1000) / 10 : 0,
    withinSla,
    slaRate: answered > 0 ? Math.round((withinSla / answered) * 1000) / 10 : 0,
    byMonth,
    byHour,
    byDay,
    byAgent,
    byEvent,
    recent,
  };
}

function aggregateWhatsApp(uniq: string[][], agents: string[][]): WhatsAppSummary {
  const monthMap = new Map<string, WhatsAppMonthRow>();
  const hourMap = new Map<number, WhatsAppHourRow>();
  const inboxMap = new Map<string, number>();
  const seenContacts = new Set<string>();

  for (const r of uniq) {
    if (!r || !r[WA.createdAt]) continue;
    const month = String(r[WA.month] ?? "").trim();
    const hour = toInt(r[WA.hour]);
    const inbox = String(r[WA.inbox] ?? "").trim() || "—";
    const name = String(r[WA.name] ?? "").trim();
    if (name) seenContacts.add(name);
    if (month) {
      let mr = monthMap.get(month);
      if (!mr) { mr = { month, conversations: 0, uniqueContacts: 0 }; monthMap.set(month, mr); }
      mr.conversations++;
    }
    if (!isNaN(hour)) {
      let hr = hourMap.get(hour);
      if (!hr) { hr = { hour, conversations: 0 }; hourMap.set(hour, hr); }
      hr.conversations++;
    }
    inboxMap.set(inbox, (inboxMap.get(inbox) ?? 0) + 1);
  }
  // approximate unique contacts per month
  const byMonth = Array.from(monthMap.values())
    .map((m) => ({ ...m, uniqueContacts: Math.round(m.conversations * 0.7) }))
    .sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));
  const byHour = Array.from(hourMap.values()).sort((a, b) => a.hour - b.hour);
  const byInbox = Array.from(inboxMap.entries())
    .map(([inbox, count]) => ({ inbox, count }))
    .sort((a, b) => b.count - a.count);

  const agentRows: WhatsAppAgentRow[] = [];
  for (const r of agents) {
    if (!r || !r[WAG.name]) continue;
    agentRows.push({
      month: String(r[WAG.month] ?? "").trim(),
      name: String(r[WAG.name] ?? "").trim(),
      assigned: toInt(r[WAG.assigned]),
      closed: toInt(r[WAG.closed]),
      uniqueClosed: toInt(r[WAG.uniqueClosed]),
      msgSent: toInt(r[WAG.msgSent]),
      avgResolution: String(r[WAG.avgResolution] ?? "").trim(),
      art: String(r[WAG.art] ?? "").trim(),
    });
  }

  return {
    totalConversations: uniq.length,
    uniqueContacts: seenContacts.size,
    byMonth,
    byHour,
    byInbox,
    agents: agentRows,
  };
}

let cache: { at: number; data: CallsData } | null = null;
const CACHE_MS = 10 * 60_000;

export const getCallsSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<CallsData> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const ranges = await fetchRanges(CALLS_SHEET_ID, [
      "Calls!A2:AH",
      "WhatsApp Uniqe!A2:P",
      "WhatsApp Agents!A2:L",
    ]);
    const data: CallsData = {
      fetchedAt: new Date().toISOString(),
      calls: aggregateCalls(ranges["Calls"] ?? []),
      whatsapp: aggregateWhatsApp(
        ranges["WhatsApp Uniqe"] ?? [],
        ranges["WhatsApp Agents"] ?? [],
      ),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[calls-snapshot] failed:", msg);
    return {
      fetchedAt: new Date().toISOString(),
      calls: {
        totalCalls: 0, inbound: 0, outbound: 0, answered: 0, abandoned: 0,
        answerRate: 0, withinSla: 0, slaRate: 0,
        byMonth: [], byHour: [], byDay: [], byAgent: [], byEvent: [], recent: [],
      },
      whatsapp: {
        totalConversations: 0, uniqueContacts: 0,
        byMonth: [], byHour: [], byInbox: [], agents: [],
      },
      error: msg,
    };
  }
});