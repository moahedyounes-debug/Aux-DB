import { createFileRoute } from "@tanstack/react-router";

const SPREADSHEET_ID = "1x796CMZf8b3RUNkqsanO56F_Wmo75L2uLzIlgE65doY";
// Extended schema: A Email | B ASC | C Branch | D Role | E Pages | F Admin | G Parts | H Call Center
// Old rows without Role/Pages (only 6 columns) are still supported — they get role="", allowedPages=[].
const RANGE = "Access!A2:H400";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SUPERUSER_ALIASES = new Set(["moahedyounes@gmail.com"]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
};

type AccessRecord = {
  email: string;
  asc: string;
  branch: string;
  isAdmin: boolean;
  parts: string;
  callCenter: boolean;
  isAllAccess: boolean;
  role: string;
  allowedPages: string[];
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function fetchAccessRows(): Promise<string[][]> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("Missing gateway credentials");
  }
  const url = `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets gateway [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

function toRecord(row: string[]): AccessRecord {
  // Detect legacy 6-column rows (Email, ASC, Branch, Admin, Parts, CallCenter)
  // vs new 8-column rows (Email, ASC, Branch, Role, Pages, Admin, Parts, CallCenter).
  // Heuristic: in legacy rows column D (index 3) is Admin ("Yes"/"No"/""); in new rows
  // column D is Role (free text). We treat "yes"/"no" in col D as legacy.
  const col3 = (row[3] ?? "").trim().toLowerCase();
  const isLegacy = col3 === "yes" || col3 === "no" || (col3 === "" && row.length <= 6);
  const email = (row[0] ?? "").trim().toLowerCase();
  const asc = (row[1] ?? "").trim();
  const branch = (row[2] ?? "").trim();
  let role = "";
  let pagesRaw = "";
  let admin = "";
  let parts = "";
  let cc = "";
  if (isLegacy) {
    admin = (row[3] ?? "").trim();
    parts = (row[4] ?? "").trim();
    cc = (row[5] ?? "").trim();
  } else {
    role = (row[3] ?? "").trim();
    pagesRaw = (row[4] ?? "").trim();
    admin = (row[5] ?? "").trim();
    parts = (row[6] ?? "").trim();
    cc = (row[7] ?? "").trim();
  }
  const isAdmin = admin.toLowerCase() === "yes";
  const isAllAccess = asc.trim().toLowerCase() === "all" || isAdmin;
  const allowedPages = pagesRaw
    ? pagesRaw
        .split(/[,\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return {
    email,
    asc,
    branch,
    isAdmin,
    parts,
    callCenter: cc.toLowerCase() === "yes",
    isAllAccess,
    role,
    allowedPages,
  };
}

function superUserRecord(email: string): AccessRecord {
  return {
    email,
    asc: "All",
    branch: "Always CC",
    isAdmin: true,
    parts: "All",
    callCenter: true,
    isAllAccess: true,
    role: "Super Admin",
    allowedPages: ["all"],
  };
}

export const Route = createFileRoute("/api/public/access-check")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const emailRaw = url.searchParams.get("email") ?? "";
          const email = emailRaw.trim().toLowerCase();
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ ok: false, error: "invalid_email" }, 400);
          }
          const rows = await fetchAccessRows();
          const match = rows.find((r) => (r[0] ?? "").trim().toLowerCase() === email);
          if (!match && SUPERUSER_ALIASES.has(email)) {
            return json({ ok: true, access: superUserRecord(email) });
          }
          if (!match) {
            return json({ ok: false, error: "not_authorized" }, 403);
          }
          return json({ ok: true, access: toRecord(match) });
        } catch (err) {
          console.error("access-check error:", err);
          return json({ ok: false, error: "internal_error" }, 500);
        }
      },
    },
  },
});