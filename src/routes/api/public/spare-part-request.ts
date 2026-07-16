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
  "Part Name / Code",
  "Quantity",
  "Notes",
  "Status",
  "Request Date",
  "Dispatch Date",
  "Receive Date",
  "Last Updated",
  "AWB",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A1:N1`,
    { headers: gwHeaders() },
  );
  const d = (await cur.json()) as { values?: string[][] };
  const first = (d.values?.[0] ?? []).filter(Boolean);
  if (first.length === 0) {
    await fetch(
      `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A1:N1?valueInputOption=USER_ENTERED`,
      { method: "PUT", headers: gwHeaders(), body: JSON.stringify({ values: [HEADERS] }) },
    );
  }
}

type Body = {
  ticket?: string;
  branch?: string;
  worker?: string;
  partName?: string;
  quantity?: number | string;
  notes?: string;
};

function fmtDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export const Route = createFileRoute("/api/public/spare-part-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const ticket = String(body.ticket ?? "").trim();
          const partName = String(body.partName ?? "").trim();
          const quantity = String(body.quantity ?? "").trim();
          if (!ticket) return json({ ok: false, error: "missing_ticket" }, 400);
          if (!partName) return json({ ok: false, error: "missing_part" }, 400);
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
            partName,
            quantity,
            String(body.notes ?? "").trim(),
            "New",
            dateStr,
            "",
            "",
            dateStr,
            "",
          ];
          const r = await fetch(
            `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(TAB)}!A:N:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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