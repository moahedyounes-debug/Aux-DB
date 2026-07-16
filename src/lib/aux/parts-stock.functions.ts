import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gwFetch } from "./gw-fetch";

const SHEET_ID = "1x796CMZf8b3RUNkqsanO56F_Wmo75L2uLzIlgE65doY";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function gwHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lov || !key) throw new Error("Google Sheets connector not configured");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": key };
}

function norm(s: string) {
  return s.toLowerCase().replace(/[\s\-_/]+/g, "");
}

export interface StockMatch {
  partNumber: string;
  description: string;
  model: string;
  qty: number;
  status: string;
  receivingDate: string;
  requestDate: string;
}
export interface StockCheckResult {
  branch: string;
  partCode: string;
  model: string;
  totalReceivedQty: number;
  matchCount: number;
  matches: StockMatch[];
}

export const checkPartStock = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        branch: z.string().min(1),
        partCode: z.string().optional().default(""),
        model: z.string().optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<StockCheckResult> => {
    const branchQ = norm(data.branch);
    const codeQ = norm(data.partCode);
    const modelQ = norm(data.model);
    if (!codeQ && !modelQ) {
      return {
        branch: data.branch,
        partCode: data.partCode,
        model: data.model,
        totalReceivedQty: 0,
        matchCount: 0,
        matches: [],
      };
    }
    const url = `${GATEWAY}/spreadsheets/${SHEET_ID}/values/Parts!A2:O`;
    const res = await gwFetch(url, { headers: gwHeaders(), ttlMs: 60_000 });
    if (!res.ok) throw new Error(`Sheets fetch failed [${res.status}]`);
    const json = (await res.json()) as { values?: string[][] };
    const rows = json.values ?? [];
    const matches: StockMatch[] = [];
    let totalReceivedQty = 0;
    for (const r of rows) {
      const partNumber = String(r[1] ?? "").trim();
      const description = String(r[2] ?? "").trim();
      const model = String(r[3] ?? "").trim();
      const status = String(r[9] ?? "").trim();
      const branch = String(r[10] ?? "").trim();
      const qty = Number(String(r[11] ?? "0").replace(/[^\d.-]/g, "")) || 0;
      const receivingDate = String(r[8] ?? "").trim();
      const requestDate = String(r[6] ?? "").trim();
      if (norm(branch) !== branchQ) continue;
      const codeHit = codeQ && (norm(partNumber).includes(codeQ) || codeQ.includes(norm(partNumber)));
      const modelHit = modelQ && (norm(model).includes(modelQ) || modelQ.includes(norm(model)));
      if (!codeHit && !modelHit) continue;
      const isReceived = /receiv/i.test(status);
      if (!isReceived) continue;
      matches.push({ partNumber, description, model, qty, status, receivingDate, requestDate });
      totalReceivedQty += qty;
    }
    return {
      branch: data.branch,
      partCode: data.partCode,
      model: data.model,
      totalReceivedQty,
      matchCount: matches.length,
      matches: matches.slice(0, 20),
    };
  });