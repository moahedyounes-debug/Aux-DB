import { createFileRoute } from "@tanstack/react-router";
import { gwFetch } from "@/lib/aux/gw-fetch";

// Whitelisted spreadsheets (aliases -> spreadsheet id)
const SHEETS: Record<string, string> = {
  maintenance: "1x796CMZf8b3RUNkqsanO56F_Wmo75L2uLzIlgE65doY",
  parts: "1jQvpH0ZA5V_JB0Y2uLBM-3_Bt9VurTbncAE4WDv4wUg",
  agents: "1KDMVAKplmbNvfdd66Ha-TmJ3fm_6mD29F2AsT9UsqvE",
  calls: "1U-GUCKqShHLkqg4FvCur-T0Tic0cMAP1ou9hvoSw_FI",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) throw new Error("Missing gateway credentials");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    Accept: "application/json",
  };
}

export const Route = createFileRoute("/api/public/sheet-read")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const source = url.searchParams.get("source") ?? "";
          const spreadsheetId = SHEETS[source];
          if (!spreadsheetId) {
            return json({ ok: false, error: "unknown_source", valid: Object.keys(SHEETS) }, 400);
          }

          const mode = url.searchParams.get("mode") ?? "values"; // values | meta | tabs
          const headers = gatewayHeaders();

          if (mode === "meta" || mode === "tabs") {
            const metaUrl = `${GATEWAY}/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(title,sheetId,gridProperties)`;
            const r = await gwFetch(metaUrl, { headers, ttlMs: 5 * 60_000 });
            if (!r.ok) {
              return json({ ok: false, error: "gateway_error", status: r.status, body: await r.text() }, 502);
            }
            const d = (await r.json()) as any;
            const tabs = (d.sheets ?? []).map((s: any) => ({
              title: s.properties?.title,
              sheetId: s.properties?.sheetId,
              rowCount: s.properties?.gridProperties?.rowCount,
              columnCount: s.properties?.gridProperties?.columnCount,
            }));
            return json({ ok: true, spreadsheet: d.properties?.title, tabs });
          }

          // values mode — single range or batch
          const ranges = url.searchParams.getAll("range");
          if (ranges.length === 0) {
            return json({ ok: false, error: "missing_range" }, 400);
          }

          if (ranges.length === 1) {
            const r = await gwFetch(
              `${GATEWAY}/spreadsheets/${spreadsheetId}/values/${ranges[0]}`,
              { headers, ttlMs: 60_000 },
            );
            if (!r.ok) {
              return json({ ok: false, error: "gateway_error", status: r.status, body: await r.text() }, 502);
            }
            const d = (await r.json()) as { values?: string[][]; range?: string };
            return json({ ok: true, range: d.range, values: d.values ?? [] });
          }

          const qs = ranges.map((rn) => `ranges=${encodeURIComponent(rn)}`).join("&");
          const r = await gwFetch(
            `${GATEWAY}/spreadsheets/${spreadsheetId}/values:batchGet?${qs}`,
            { headers, ttlMs: 60_000 },
          );
          if (!r.ok) {
            return json({ ok: false, error: "gateway_error", status: r.status, body: await r.text() }, 502);
          }
          const d = (await r.json()) as { valueRanges?: Array<{ range?: string; values?: string[][] }> };
          return json({
            ok: true,
            valueRanges: (d.valueRanges ?? []).map((v) => ({
              range: v.range,
              values: v.values ?? [],
            })),
          });
        } catch (err) {
          console.error("sheet-read error:", err);
          return json({ ok: false, error: "internal_error" }, 500);
        }
      },
    },
  },
});