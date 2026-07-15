import { createServerFn } from "@tanstack/react-start";

const CIC_SHEET_ID = "1KDMVAKplmbNvfdd66Ha-TmJ3fm_6mD29F2AsT9UsqvE";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

// Evaluation Form columns
const EF = {
  agent: 0,
  mYear: 1,
  month: 2,
  category: 3,
  criteria: 4,
  description: 5,
  score: 6, // 1..5
  managerEval: 7,
  max: 8,
  scorePct: 9,
  sort: 10,
  remark: 11,
} as const;

export interface CICEvalRow {
  agent: string;
  month: string;
  category: string;
  criteria: string;
  description: string;
  score: number;
  managerEval: number;
  scorePct: number;
}

export interface CICAgentRow {
  agent: string;
  month: string;
  totalScore: number;
  maxScore: number;
  pct: number;
  evaluations: number;
}

export interface CICCategoryRow {
  category: string;
  avgScore: number;
  evaluations: number;
  pct: number;
}

export interface CICCommentRow {
  evaluator: string;
  agent: string;
}

export interface CICSummary {
  fetchedAt: string;
  totalEvaluations: number;
  avgScorePct: number;
  topAgent: string;
  agents: CICAgentRow[];
  byCategory: CICCategoryRow[];
  recentEvaluations: CICEvalRow[];
  comments: CICCommentRow[];
  error?: string;
}

const MONTH_ORDER = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

function parsePct(v: unknown): number {
  const s = String(v ?? "").trim().replace("%", "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
function parseNum(v: unknown): number {
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
    const m = vr.range.match(/^'?([^'!]+)'?!/);
    if (m) out[m[1]] = vr.values ?? [];
  }
  return out;
}

function aggregate(evalRows: string[][], commentRows: string[][]): CICSummary {
  const evaluations: CICEvalRow[] = [];
  const agentMap = new Map<string, CICAgentRow>();
  const catMap = new Map<string, { total: number; count: number }>();
  let totalPct = 0;
  let count = 0;

  for (const r of evalRows) {
    if (!r || !r[EF.agent]) continue;
    const agent = String(r[EF.agent]).trim();
    const month = String(r[EF.month] ?? "").trim();
    const category = String(r[EF.category] ?? "").trim() || "—";
    const score = parseNum(r[EF.score]);
    const managerEval = parseNum(r[EF.managerEval]);
    const max = parseNum(r[EF.max]) || 5;
    const pct = parsePct(r[EF.scorePct]) || (score / max) * 100;
    const item: CICEvalRow = {
      agent,
      month,
      category,
      criteria: String(r[EF.criteria] ?? "").trim(),
      description: String(r[EF.description] ?? "").trim(),
      score,
      managerEval,
      scorePct: Math.round(pct * 10) / 10,
    };
    evaluations.push(item);
    totalPct += pct;
    count++;

    const key = `${agent}||${month}`;
    let ag = agentMap.get(key);
    if (!ag) {
      ag = { agent, month, totalScore: 0, maxScore: 0, pct: 0, evaluations: 0 };
      agentMap.set(key, ag);
    }
    ag.totalScore += score;
    ag.maxScore += max;
    ag.evaluations++;

    let cat = catMap.get(category);
    if (!cat) { cat = { total: 0, count: 0 }; catMap.set(category, cat); }
    cat.total += pct;
    cat.count++;
  }

  const agents = Array.from(agentMap.values())
    .map((a) => ({
      ...a,
      pct: a.maxScore > 0 ? Math.round((a.totalScore / a.maxScore) * 1000) / 10 : 0,
    }))
    .sort((a, b) => {
      const mo = MONTH_ORDER.indexOf(b.month) - MONTH_ORDER.indexOf(a.month);
      if (mo !== 0) return mo;
      return b.pct - a.pct;
    });

  const byCategory = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      evaluations: s.count,
      avgScore: s.count > 0 ? Math.round((s.total / s.count) / 20 * 10) / 10 : 0, // convert pct → 0..5
      pct: s.count > 0 ? Math.round((s.total / s.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  const comments: CICCommentRow[] = [];
  for (const r of commentRows) {
    if (!r || (!r[0] && !r[1])) continue;
    comments.push({
      evaluator: String(r[0] ?? "").trim(),
      agent: String(r[1] ?? "").trim(),
    });
  }

  const avgScorePct = count > 0 ? Math.round((totalPct / count) * 10) / 10 : 0;
  const topAgent = agents.length > 0 ? agents[0].agent : "—";

  return {
    fetchedAt: new Date().toISOString(),
    totalEvaluations: count,
    avgScorePct,
    topAgent,
    agents,
    byCategory,
    recentEvaluations: evaluations.slice(-100).reverse(),
    comments,
  };
}

let cache: { at: number; data: CICSummary } | null = null;
const CACHE_MS = 10 * 60_000;

export const getCICSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<CICSummary> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const ranges = await fetchRanges(CIC_SHEET_ID, [
      "Evaluation Form!A2:L",
      "Comments!A2:B",
    ]);
    const data = aggregate(ranges["Evaluation Form"] ?? [], ranges["Comments"] ?? []);
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cic-snapshot] failed:", msg);
    return {
      fetchedAt: new Date().toISOString(),
      totalEvaluations: 0,
      avgScorePct: 0,
      topAgent: "—",
      agents: [],
      byCategory: [],
      recentEvaluations: [],
      comments: [],
      error: msg,
    };
  }
});