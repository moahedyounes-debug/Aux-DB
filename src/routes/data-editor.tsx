import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Database, Plus, Save, Trash2, RefreshCw, Building2, Boxes, Calculator, EyeOff, Eye, Check, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAccess } from "@/hooks/use-access";
import { toast } from "sonner";
import { evaluateFormula, formatValue, KPI_FORMULA_HEADERS, type FormulaFormat } from "@/lib/aux/formula";
import { cn } from "@/lib/utils";
import { SortableTh, useSort } from "@/components/ui/sortable-th";

export const Route = createFileRoute("/data-editor")({
  head: () => ({
    meta: [
      { title: "Data Editor — AUX ASC Dashboard" },
      { name: "description", content: "Admin data editor: companies, OBM lines and KPI formulas." },
    ],
  }),
  component: DataEditorPage,
});

type TabKey = "Companies" | "OBM" | "KPIFormulas";

const TABS: { key: TabKey; label: string; icon: typeof Database; headers: string[] }[] = [
  { key: "Companies", label: "Companies", icon: Building2, headers: ["Name", "Code", "Region", "Active", "Hidden"] },
  { key: "OBM", label: "OBM Models", icon: Boxes, headers: ["Model", "Category", "Capacity", "Notes", "Hidden"] },
  { key: "KPIFormulas", label: "KPI Formulas", icon: Calculator, headers: KPI_FORMULA_HEADERS },
];

// Sample variables users can reference (matches KPI Scorecard stats).
const FORMULA_VARS = [
  { name: "total", desc: "Total tickets in scope" },
  { name: "completed", desc: "Completed tickets" },
  { name: "pending", desc: "Pending tickets" },
  { name: "with_hrs", desc: "Completed tickets with recorded hours" },
  { name: "u48", desc: "Completed within 48h" },
  { name: "u72", desc: "Completed within 72h" },
  { name: "avg_hours", desc: "Average repair hours (completed)" },
  { name: "branches", desc: "Distinct branches in scope" },
];

async function postWrite(body: unknown): Promise<{ ok: boolean; error?: string; detail?: string; headers?: string[]; rows?: string[][] }> {
  const r = await fetch("/api/public/sheet-write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function DataEditorPage() {
  const { access, ready } = useAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("Companies");

  useEffect(() => {
    if (ready && access && !access.isAdmin && !access.isAllAccess) {
      navigate({ to: "/" });
    }
  }, [ready, access, navigate]);

  const meta = TABS.find((t) => t.key === tab)!;
  const actor = access?.email ?? "";

  const query = useQuery({
    queryKey: ["data-editor", tab],
    enabled: ready && !!actor && (access?.isAdmin || access?.isAllAccess),
    queryFn: async () => {
      // ensure the tab exists first so first load is smooth
      await postWrite({ actorEmail: actor, action: "ensureTab", tab, headers: meta.headers });
      const res = await postWrite({ actorEmail: actor, action: "list", tab });
      if (!res.ok) throw new Error(res.error ?? "failed");
      return { headers: res.headers ?? meta.headers, rows: res.rows ?? [] };
    },
    staleTime: 30_000,
  });

  const headers = query.data?.headers?.length ? query.data.headers : meta.headers;
  const rows = query.data?.rows ?? [];

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<number | null>(null); // absolute sheet row number
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(null);
    setDraft({});
  }, [tab]);

  function startNew() {
    setEditing(-1);
    const empty: Record<string, string> = {};
    for (const h of headers) empty[h] = h === "Format" ? "number" : h === "Hidden" ? "No" : h === "Active" ? "Yes" : "";
    setDraft(empty);
  }

  function startEdit(rowNumber: number, row: string[]) {
    setEditing(rowNumber);
    const d: Record<string, string> = {};
    headers.forEach((h, i) => (d[h] = row[i] ?? ""));
    setDraft(d);
  }

  async function saveRow() {
    if (!actor) return;
    const row = headers.map((h) => draft[h] ?? "");
    if (tab === "KPIFormulas") {
      const check = evaluateFormula(draft["Formula"] ?? "", Object.fromEntries(FORMULA_VARS.map((v) => [v.name, 1])));
      if (check.error && check.error !== "non-finite") {
        toast.error(`Formula error: ${check.error}`);
        return;
      }
    }
    setSaving(true);
    const body =
      editing && editing > 0
        ? { actorEmail: actor, action: "update", tab, headers, row, rowNumber: editing }
        : { actorEmail: actor, action: "append", tab, headers, row };
    const res = await postWrite(body);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.detail || res.error || "Save failed");
      return;
    }
    toast.success("Saved");
    setEditing(null);
    setDraft({});
    qc.invalidateQueries({ queryKey: ["data-editor", tab] });
    if (tab === "KPIFormulas") qc.invalidateQueries({ queryKey: ["kpi-formulas"] });
  }

  async function deleteRow(rowNumber: number) {
    if (!actor) return;
    if (!confirm("Delete this row?")) return;
    const res = await postWrite({ actorEmail: actor, action: "delete", tab, rowNumber });
    if (!res.ok) {
      toast.error(res.detail || res.error || "Delete failed");
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["data-editor", tab] });
    if (tab === "KPIFormulas") qc.invalidateQueries({ queryKey: ["kpi-formulas"] });
  }

  const hiddenIdx = headers.findIndex((h) => h.toLowerCase() === "hidden");

  // Build rows with original index for sorting while preserving row number for edit/delete
  const indexedRows = useMemo(
    () => rows.map((r, i) => ({ r, rowNumber: i + 2 })),
    [rows],
  );
  const getters = useMemo(() => {
    const g: Record<string, (row: { r: string[] }) => unknown> = {};
    headers.forEach((h, ci) => {
      g[`c${ci}`] = (row) => {
        const v = row.r[ci] ?? "";
        const n = Number(v);
        return !Number.isNaN(n) && v.trim() !== "" ? n : v;
      };
    });
    return g;
  }, [headers]);
  const dataSort = useSort(indexedRows, getters);

  return (
    <DashboardLayout title="Data Editor" subtitle="Manage companies, OBM models and KPI formulas — writes directly to Google Sheets">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border hover:bg-accent",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["data-editor", tab] })}
          className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm border border-border hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-success text-success-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New row
        </button>
      </div>

      {tab === "KPIFormulas" && (
        <div className="surface-card p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available variables</div>
          <div className="flex flex-wrap gap-2">
            {FORMULA_VARS.map((v) => (
              <span
                key={v.name}
                title={v.desc}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-mono"
              >
                {v.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Example: <code className="font-mono">(completed/total)*100</code> · Supported operators: + − × ÷ % ^ and functions like{" "}
            <code className="font-mono">min, max, abs, round, if</code>.
          </p>
        </div>
      )}

      {editing !== null && (
        <div className="surface-card p-4 space-y-3 border-primary/40 border-2">
          <div className="text-sm font-semibold">
            {editing > 0 ? `Edit row ${editing}` : "New row"} — {meta.label}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {headers.map((h) => {
              const isFormula = tab === "KPIFormulas" && h === "Formula";
              const isFormat = tab === "KPIFormulas" && h === "Format";
              const isBoolean = h === "Hidden" || h === "Active";
              if (isFormat) {
                return (
                  <label key={h} className="text-sm">
                    <div className="text-xs font-medium mb-1 text-muted-foreground">{h}</div>
                    <select
                      value={draft[h] ?? "number"}
                      onChange={(e) => setDraft({ ...draft, [h]: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                    >
                      <option value="number">Number</option>
                      <option value="percent">Percent</option>
                      <option value="currency">Currency (SAR)</option>
                      <option value="hours">Hours</option>
                    </select>
                  </label>
                );
              }
              if (isBoolean) {
                return (
                  <label key={h} className="text-sm">
                    <div className="text-xs font-medium mb-1 text-muted-foreground">{h}</div>
                    <select
                      value={draft[h] || "No"}
                      onChange={(e) => setDraft({ ...draft, [h]: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </label>
                );
              }
              return (
                <label key={h} className={cn("text-sm", isFormula && "md:col-span-2")}>
                  <div className="text-xs font-medium mb-1 text-muted-foreground">{h}</div>
                  <input
                    type="text"
                    value={draft[h] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [h]: e.target.value })}
                    placeholder={isFormula ? "(completed/total)*100" : ""}
                    className={cn(
                      "w-full rounded-md border border-border bg-background px-2 py-1.5",
                      isFormula && "font-mono",
                    )}
                  />
                </label>
              );
            })}
          </div>
          {tab === "KPIFormulas" && draft["Formula"] && (
            <FormulaPreview formula={draft["Formula"] ?? ""} format={(draft["Format"] as FormulaFormat) || "number"} />
          )}
          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={saveRow}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(null); setDraft({}); }}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="surface-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                {headers.map((h, ci) => (
                  <SortableTh
                    key={h}
                    sortKey={`c${ci}`}
                    currentKey={dataSort.sortKey}
                    currentDir={dataSort.sortDir}
                    onSort={dataSort.toggle}
                    className="py-2 px-3 text-start"
                  >
                    {h}
                  </SortableTh>
                ))}
                <th className="py-2 px-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && (
                <tr><td colSpan={headers.length + 1} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {query.isError && (
                <tr><td colSpan={headers.length + 1} className="py-8 text-center text-destructive">Load failed</td></tr>
              )}
              {!query.isLoading && rows.length === 0 && (
                <tr><td colSpan={headers.length + 1} className="py-8 text-center text-muted-foreground">No rows yet — click <b>New row</b> to add one.</td></tr>
              )}
              {dataSort.sorted.map(({ r, rowNumber }) => {
                const hidden = hiddenIdx >= 0 && (r[hiddenIdx] ?? "").trim().toLowerCase() === "yes";
                return (
                  <tr key={rowNumber} className={cn("border-t border-border/60", hidden && "opacity-50")}>
                    {headers.map((h, ci) => (
                      <td key={h} className={cn("py-2 px-3", h === "Formula" && "font-mono text-xs")}>
                        {r[ci] ?? ""}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-end whitespace-nowrap">
                      <button
                        onClick={() => startEdit(rowNumber, r)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent mr-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteRow(rowNumber)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 text-destructive px-2 py-1 text-xs hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

function FormulaPreview({ formula, format }: { formula: string; format: FormulaFormat }) {
  const sample = Object.fromEntries(FORMULA_VARS.map((v, i) => [v.name, [1200, 900, 300, 850, 700, 800, 36, 25][i] ?? 1]));
  const res = evaluateFormula(formula, sample);
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
      res.error ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
    )}>
      {res.error ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      <span className="font-mono">preview →</span>
      <span className="font-semibold">{res.error ? res.error : formatValue(res.value, format)}</span>
      <span className="text-xs opacity-70">(using sample values)</span>
    </div>
  );
}

// silence unused warnings
void EyeOff; void Eye;