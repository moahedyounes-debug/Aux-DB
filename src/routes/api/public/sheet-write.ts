import { createFileRoute } from "@tanstack/react-router";

const SPREADSHEET_ID = "1x796CMZf8b3RUNkqsanO56F_Wmo75L2uLzIlgE65doY";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
import { invalidateGwCache } from "@/lib/aux/gw-fetch";
const SUPERUSER_ALIASES = new Set(["moahedyounes@gmail.com"]);
const ACCESS_RANGE = "Access!A2:H400";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function gwHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lov || !key) throw new Error("Missing gateway credentials");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function colLetter(n: number): string {
  // 1 -> A
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function isActorAdmin(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  if (SUPERUSER_ALIASES.has(e)) return true;
  const r = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${ACCESS_RANGE}`, {
    headers: gwHeaders(),
  });
  if (!r.ok) return false;
  const d = (await r.json()) as { values?: string[][] };
  for (const row of d.values ?? []) {
    if ((row[0] ?? "").trim().toLowerCase() !== e) continue;
    const col3 = (row[3] ?? "").trim().toLowerCase();
    const isLegacy = col3 === "yes" || col3 === "no" || (col3 === "" && row.length <= 6);
    const adminVal = (isLegacy ? row[3] : row[5]) ?? "";
    if (String(adminVal).trim().toLowerCase() === "yes") return true;
    if ((row[1] ?? "").toString().trim().toLowerCase() === "all") return true;
  }
  return false;
}

async function ensureTab(tab: string, headers: string[]) {
  const meta = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
    { headers: gwHeaders() },
  );
  const md = (await meta.json()) as { sheets?: { properties: { title: string } }[] };
  const has = (md.sheets ?? []).some((s) => s.properties.title === tab);
  if (has) return;
  await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: "POST",
    headers: gwHeaders(),
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
  });
  const endCol = colLetter(headers.length);
  await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${tab}!A1:${endCol}1?valueInputOption=USER_ENTERED`,
    { method: "PUT", headers: gwHeaders(), body: JSON.stringify({ values: [headers] }) },
  );
}

async function readTab(tab: string): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${tab}!A1:Z1000`, {
    headers: gwHeaders(),
  });
  if (!r.ok) return { headers: [], rows: [] };
  const d = (await r.json()) as { values?: string[][] };
  const values = d.values ?? [];
  const headers = values[0] ?? [];
  const rows = values.slice(1);
  return { headers, rows };
}

async function appendRow(tab: string, headers: string[], row: string[]) {
  const endCol = colLetter(headers.length || row.length);
  const r = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${tab}!A:${endCol}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", headers: gwHeaders(), body: JSON.stringify({ values: [row] }) },
  );
  if (!r.ok) throw new Error(`append ${r.status}: ${await r.text()}`);
  return { appended: true };
}

async function updateRow(tab: string, rowNumber: number, endColLetter: string, row: string[]) {
  const range = `${tab}!A${rowNumber}:${endColLetter}${rowNumber}`;
  const r = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`,
    { method: "PUT", headers: gwHeaders(), body: JSON.stringify({ values: [row] }) },
  );
  if (!r.ok) throw new Error(`update ${r.status}: ${await r.text()}`);
  return { updated: true, row: rowNumber };
}

async function clearRow(tab: string, rowNumber: number, endColLetter: string) {
  const range = `${tab}!A${rowNumber}:${endColLetter}${rowNumber}`;
  const r = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${range}:clear`, {
    method: "POST",
    headers: gwHeaders(),
    body: "{}",
  });
  if (!r.ok) throw new Error(`clear ${r.status}: ${await r.text()}`);
  return { deleted: true, row: rowNumber };
}

type Body = {
  actorEmail?: string;
  action?: "list" | "append" | "update" | "delete" | "ensureTab";
  tab?: string;
  headers?: string[];
  row?: string[];
  rowNumber?: number; // 1-indexed absolute sheet row (header row = 1)
};

export const Route = createFileRoute("/api/public/sheet-write")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const actor = (body.actorEmail ?? "").trim().toLowerCase();
          if (!actor) return json({ ok: false, error: "missing_actor" }, 400);
          if (!body.tab) return json({ ok: false, error: "missing_tab" }, 400);
          const ok = await isActorAdmin(actor);
          if (!ok) return json({ ok: false, error: "not_admin" }, 403);

          const tab = body.tab;
          switch (body.action) {
            case "ensureTab": {
              if (!body.headers?.length) return json({ ok: false, error: "missing_headers" }, 400);
              await ensureTab(tab, body.headers);
              return json({ ok: true });
            }
            case "list": {
              const data = await readTab(tab);
              return json({ ok: true, ...data });
            }
            case "append": {
              if (!body.row) return json({ ok: false, error: "missing_row" }, 400);
              if (body.headers?.length) await ensureTab(tab, body.headers);
              const cur = await readTab(tab);
              const heads = cur.headers.length ? cur.headers : (body.headers ?? []);
              const r = await appendRow(tab, heads, body.row);
              return json({ ok: true, result: r });
            }
            case "update": {
              if (!body.row || !body.rowNumber) return json({ ok: false, error: "missing_row" }, 400);
              const cur = await readTab(tab);
              const heads = cur.headers.length ? cur.headers : (body.headers ?? []);
              const end = colLetter(heads.length || body.row.length);
              const r = await updateRow(tab, body.rowNumber, end, body.row);
              return json({ ok: true, result: r });
            }
            case "delete": {
              if (!body.rowNumber) return json({ ok: false, error: "missing_row" }, 400);
              const cur = await readTab(tab);
              const end = colLetter(cur.headers.length || 26);
              const r = await clearRow(tab, body.rowNumber, end);
              return json({ ok: true, result: r });
            }
            default:
              return json({ ok: false, error: "unknown_action" }, 400);
          }
        } catch (err) {
          console.error("sheet-write error:", err);
          const msg = err instanceof Error ? err.message : String(err);
          return json({ ok: false, error: "internal_error", detail: msg }, 500);
        }
      },
    },
  },
});