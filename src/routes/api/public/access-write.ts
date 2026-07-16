import { createFileRoute } from "@tanstack/react-router";
import { invalidateGwCache } from "@/lib/aux/gw-fetch";

const SPREADSHEET_ID = "1x796CMZf8b3RUNkqsanO56F_Wmo75L2uLzIlgE65doY";
const ACCESS_RANGE = "Access!A2:H400";
const ROLES_RANGE = "Roles!A2:B200";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SUPERUSER_ALIASES = new Set(["moahedyounes@gmail.com"]);

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

async function readAccessRows(): Promise<string[][]> {
  const r = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${ACCESS_RANGE}`, {
    headers: gwHeaders(),
  });
  if (!r.ok) throw new Error(`read access ${r.status}: ${await r.text()}`);
  const d = (await r.json()) as { values?: string[][] };
  return d.values ?? [];
}

async function readRolesRows(): Promise<string[][]> {
  const r = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${ROLES_RANGE}`, {
    headers: gwHeaders(),
  });
  if (!r.ok) return [];
  const d = (await r.json()) as { values?: string[][] };
  return d.values ?? [];
}

async function isActorAdmin(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  if (SUPERUSER_ALIASES.has(e)) return true;
  const rows = await readAccessRows();
  for (const r of rows) {
    if ((r[0] ?? "").trim().toLowerCase() !== e) continue;
    const col3 = (r[3] ?? "").trim().toLowerCase();
    const isLegacy = col3 === "yes" || col3 === "no" || (col3 === "" && r.length <= 6);
    const adminVal = (isLegacy ? r[3] : r[5]) ?? "";
    if (adminVal.toString().trim().toLowerCase() === "yes") return true;
    if ((r[1] ?? "").toString().trim().toLowerCase() === "all") return true;
  }
  return false;
}

type UserRow = {
  email: string;
  asc: string;
  branch: string;
  role: string;
  pages: string[]; // array of page paths, or ["all"]
  admin: boolean;
  parts: string;
  callCenter: boolean;
};

function toSheetRow(u: UserRow): string[] {
  return [
    u.email.trim().toLowerCase(),
    u.asc.trim(),
    u.branch.trim(),
    u.role.trim(),
    (u.pages ?? []).join(","),
    u.admin ? "Yes" : "No",
    u.parts.trim(),
    u.callCenter ? "Yes" : "No",
  ];
}

async function upsertUser(u: UserRow) {
  const rows = await readAccessRows();
  const idx = rows.findIndex((r) => (r[0] ?? "").trim().toLowerCase() === u.email.trim().toLowerCase());
  const values = [toSheetRow(u)];
  if (idx >= 0) {
    const rowNumber = idx + 2; // header is row 1
    const range = `Access!A${rowNumber}:H${rowNumber}`;
    const r = await fetch(
      `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`,
      { method: "PUT", headers: gwHeaders(), body: JSON.stringify({ values }) },
    );
    if (!r.ok) throw new Error(`update ${r.status}: ${await r.text()}`);
    return { updated: true, row: rowNumber };
  }
  const r = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/Access!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", headers: gwHeaders(), body: JSON.stringify({ values }) },
  );
  if (!r.ok) throw new Error(`append ${r.status}: ${await r.text()}`);
  return { appended: true };
}

async function deleteUser(email: string) {
  const e = email.trim().toLowerCase();
  const rows = await readAccessRows();
  const idx = rows.findIndex((r) => (r[0] ?? "").trim().toLowerCase() === e);
  if (idx < 0) return { deleted: false };
  const rowNumber = idx + 2;
  const range = `Access!A${rowNumber}:H${rowNumber}`;
  // Clear the row (readers filter empty first-column rows).
  const r = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${range}:clear`, {
    method: "POST",
    headers: gwHeaders(),
    body: "{}",
  });
  if (!r.ok) throw new Error(`clear ${r.status}: ${await r.text()}`);
  return { deleted: true, row: rowNumber };
}

async function upsertRole(name: string, pages: string[]) {
  const rows = await readRolesRows();
  const idx = rows.findIndex((r) => (r[0] ?? "").trim().toLowerCase() === name.trim().toLowerCase());
  const values = [[name.trim(), (pages ?? []).join(",")]];
  if (idx >= 0) {
    const rowNumber = idx + 2;
    const range = `Roles!A${rowNumber}:B${rowNumber}`;
    const r = await fetch(
      `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`,
      { method: "PUT", headers: gwHeaders(), body: JSON.stringify({ values }) },
    );
    if (!r.ok) throw new Error(`role update ${r.status}: ${await r.text()}`);
    return { updated: true };
  }
  const r = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/Roles!A:B:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", headers: gwHeaders(), body: JSON.stringify({ values }) },
  );
  if (!r.ok) {
    // If the Roles tab doesn't exist yet, create it and retry once.
    const meta = await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`, { headers: gwHeaders() });
    const md = (await meta.json()) as { sheets?: { properties: { title: string } }[] };
    const hasRoles = (md.sheets ?? []).some((s) => s.properties.title === "Roles");
    if (!hasRoles) {
      await fetch(`${GATEWAY}/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
        method: "POST",
        headers: gwHeaders(),
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: "Roles" } } }],
        }),
      });
      // Add header row
      await fetch(
        `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/Roles!A1:B1?valueInputOption=USER_ENTERED`,
        { method: "PUT", headers: gwHeaders(), body: JSON.stringify({ values: [["Role", "Pages"]] }) },
      );
      const retry = await fetch(
        `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/Roles!A:B:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        { method: "POST", headers: gwHeaders(), body: JSON.stringify({ values }) },
      );
      if (!retry.ok) throw new Error(`role append retry ${retry.status}: ${await retry.text()}`);
      return { appended: true, createdTab: true };
    }
    throw new Error(`role append ${r.status}: ${await r.text()}`);
  }
  return { appended: true };
}

async function deleteRole(name: string) {
  const n = name.trim().toLowerCase();
  const rows = await readRolesRows();
  const idx = rows.findIndex((r) => (r[0] ?? "").trim().toLowerCase() === n);
  if (idx < 0) return { deleted: false };
  const rowNumber = idx + 2;
  const r = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/Roles!A${rowNumber}:B${rowNumber}:clear`,
    { method: "POST", headers: gwHeaders(), body: "{}" },
  );
  if (!r.ok) throw new Error(`role clear ${r.status}: ${await r.text()}`);
  return { deleted: true };
}

export const Route = createFileRoute("/api/public/access-write")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            actorEmail?: string;
            action?: "upsertUser" | "deleteUser" | "upsertRole" | "deleteRole";
            user?: UserRow;
            role?: { name: string; pages: string[] };
          };
          const actor = (body.actorEmail ?? "").trim().toLowerCase();
          if (!actor) return json({ ok: false, error: "missing_actor" }, 400);
          const ok = await isActorAdmin(actor);
          if (!ok) return json({ ok: false, error: "not_admin" }, 403);

          const invalidate = () => invalidateGwCache(SPREADSHEET_ID);
          switch (body.action) {
            case "upsertUser": {
              if (!body.user?.email) return json({ ok: false, error: "missing_user" }, 400);
              const r = await upsertUser(body.user);
              invalidate();
              return json({ ok: true, result: r });
            }
            case "deleteUser": {
              if (!body.user?.email) return json({ ok: false, error: "missing_email" }, 400);
              const r = await deleteUser(body.user.email);
              invalidate();
              return json({ ok: true, result: r });
            }
            case "upsertRole": {
              if (!body.role?.name) return json({ ok: false, error: "missing_role" }, 400);
              const r = await upsertRole(body.role.name, body.role.pages ?? []);
              invalidate();
              return json({ ok: true, result: r });
            }
            case "deleteRole": {
              if (!body.role?.name) return json({ ok: false, error: "missing_role" }, 400);
              const r = await deleteRole(body.role.name);
              invalidate();
              return json({ ok: true, result: r });
            }
            default:
              return json({ ok: false, error: "unknown_action" }, 400);
          }
        } catch (err) {
          console.error("access-write error:", err);
          const msg = err instanceof Error ? err.message : String(err);
          return json({ ok: false, error: "internal_error", detail: msg }, 500);
        }
      },
    },
  },
});