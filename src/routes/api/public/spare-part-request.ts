import { createFileRoute } from "@tanstack/react-router";

const SPREADSHEET_ID = "1jQvpH0ZA5V_JB0Y2uLBM-3_Bt9VurTbncAE4WDv4wUg";
const TAB = "Daily Spare Part Request";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const HEADERS = [
  "Request ID",
  "Date",
  "Ticket #",
  "Branch",
  "Worker",
  "Part Code",
  "Quantity",
  "Notes",
  "Status",
  "Request Date",
  "Dispatch Date",
  "Receive Date",
  "Last Updated",
  "AWB",
  "Model",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
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

async function ensureTabWithHeaders() {
  const meta = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
    { headers: gwHeaders() },
  );
  if (!meta.ok) throw new Error(`meta ${meta.status}: ${await meta.text()}`);
  const md = (await meta.json()) as { sheets?: { properties: { title: string } }[] };
  const has = (md.sheets ?? []).some((s) => s.properties.title === TAB);
  if (!has) {
    const add = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      headers: gwHeaders(),
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }),
    });
    if (!add.ok) throw new Error(`addSheet ${add.status}: ${await add.text()}`);
  }
  // Ensure header row exists / is correct
  const cur = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A1:O1`,
    { headers: gwHeaders() },
  );
  const d = (await cur.json()) as { values?: string[][] };
  const first = (d.values?.[0] ?? []).filter(Boolean);
  if (first.length < HEADERS.length) {
    await fetch(
      `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A1:O1?valueInputOption=USER_ENTERED`,
      { method: "PUT", headers: gwHeaders(), body: JSON.stringify({ values: [HEADERS] }) },
    );
  }
}

type Body = {
  ticket?: string;
  branch?: string;
  worker?: string;
  partCode?: string;
  model?: string;
  quantity?: number | string;
  notes?: string;
  confirmed?: boolean;
};

type PatchBody = {
  requestId: string;
  status?: string;
  awb?: string;
  dispatchDate?: string;
  receiveDate?: string;
  partCode?: string;
  model?: string;
  quantity?: number | string;
  branch?: string;
  notes?: string;
  worker?: string;
  ticket?: string;
};

function fmtDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export const Route = createFileRoute("/api/public/spare-part-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        try {
          await ensureTabWithHeaders();
          const r = await fetch(
            `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A2:O`,
            { headers: gwHeaders() },
          );
          const d = (await r.json()) as { values?: string[][] };
          const rows = (d.values ?? []).map((row, i) => ({
            rowIndex: i + 2, // sheet row number (1-based, header on row 1)
            requestId: row[0] ?? "",
            date: row[1] ?? "",
            ticket: row[2] ?? "",
            branch: row[3] ?? "",
            worker: row[4] ?? "",
            partCode: row[5] ?? "",
            quantity: row[6] ?? "",
            notes: row[7] ?? "",
            status: row[8] ?? "",
            requestDate: row[9] ?? "",
            dispatchDate: row[10] ?? "",
            receiveDate: row[11] ?? "",
            lastUpdated: row[12] ?? "",
            awb: row[13] ?? "",
            model: row[14] ?? "",
          })).filter((r) => r.requestId);
          return json({ ok: true, rows: rows.reverse() });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return json({ ok: false, error: "list_failed", detail: msg }, 500);
        }
      },
      PATCH: async ({ request }) => {
        try {
          const body = (await request.json()) as PatchBody;
          const rid = String(body.requestId ?? "").trim();
          if (!rid) return json({ ok: false, error: "missing_requestId" }, 400);
          await ensureTabWithHeaders();
          // Find the row
          const list = await fetch(
            `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A2:O`,
            { headers: gwHeaders() },
          );
          const ld = (await list.json()) as { values?: string[][] };
          const rows = ld.values ?? [];
          const idx = rows.findIndex((r) => (r[0] ?? "") === rid);
          if (idx < 0) return json({ ok: false, error: "not_found" }, 404);
          const cur = rows[idx];
          const merged = [
            cur[0] ?? rid,
            cur[1] ?? "",
            body.ticket !== undefined ? String(body.ticket) : (cur[2] ?? ""),
            body.branch !== undefined ? String(body.branch) : (cur[3] ?? ""),
            body.worker !== undefined ? String(body.worker) : (cur[4] ?? ""),
            body.partCode !== undefined ? String(body.partCode) : (cur[5] ?? ""),
            body.quantity !== undefined ? String(body.quantity) : (cur[6] ?? ""),
            body.notes !== undefined ? String(body.notes) : (cur[7] ?? ""),
            body.status !== undefined ? String(body.status) : (cur[8] ?? ""),
            cur[9] ?? "",
            body.dispatchDate !== undefined ? String(body.dispatchDate) : (cur[10] ?? ""),
            body.receiveDate !== undefined ? String(body.receiveDate) : (cur[11] ?? ""),
            fmtDate(new Date()),
            body.awb !== undefined ? String(body.awb) : (cur[13] ?? ""),
            body.model !== undefined ? String(body.model) : (cur[14] ?? ""),
          ];
          const sheetRow = idx + 2;
          const upd = await fetch(
            `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A${sheetRow}:O${sheetRow}?valueInputOption=USER_ENTERED`,
            { method: "PUT", headers: gwHeaders(), body: JSON.stringify({ values: [merged] }) },
          );
          if (!upd.ok) {
            const t = await upd.text();
            return json({ ok: false, error: "update_failed", detail: t, status: upd.status }, 502);
          }
          return json({ ok: true, requestId: rid });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return json({ ok: false, error: "internal_error", detail: msg }, 500);
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const ticket = String(body.ticket ?? "").trim();
          const partCode = String(body.partCode ?? "").trim();
          const model = String(body.model ?? "").trim();
          const quantity = String(body.quantity ?? "").trim();
          if (!ticket) return json({ ok: false, error: "missing_ticket" }, 400);
          if (!partCode && !model) return json({ ok: false, error: "missing_part" }, 400);
          if (!quantity) return json({ ok: false, error: "missing_quantity" }, 400);

          await ensureTabWithHeaders();

          const now = new Date();
          const reqId = `REQ-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
          const dateStr = fmtDate(now);
          const row = [
            reqId,
            dateStr,
            ticket,
            String(body.branch ?? "").trim(),
            String(body.worker ?? "").trim(),
            partCode,
            quantity,
            String(body.notes ?? "").trim(),
            "New",
            dateStr,
            "",
            "",
            dateStr,
            "",
            model,
          ];
          const r = await fetch(
            `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A:O:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            { method: "POST", headers: gwHeaders(), body: JSON.stringify({ values: [row] }) },
          );
          if (!r.ok) {
            const t = await r.text();
            console.error("spare-part-request append failed", r.status, t);
            return json({ ok: false, error: "append_failed", detail: t, status: r.status }, 502);
          }
          return json({ ok: true, requestId: reqId });
        } catch (err) {
          console.error("spare-part-request error:", err);
          const msg = err instanceof Error ? err.message : String(err);
          return json({ ok: false, error: "internal_error", detail: msg }, 500);
        }
      },
    },
  },
});