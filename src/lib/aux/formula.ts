import { Parser } from "expr-eval";

const parser = new Parser({
  operators: {
    add: true, subtract: true, multiply: true, divide: true, remainder: true, power: true,
    comparison: true, logical: true, conditional: true,
    concatenate: false, assignment: false, in: false,
  },
});

export type FormulaFormat = "number" | "percent" | "currency" | "hours";

export interface KpiFormulaDef {
  name: string;
  formula: string; // e.g. "(completed/total)*100"
  format: FormulaFormat;
  hidden: boolean;
  rowNumber?: number; // absolute sheet row, if loaded from sheet
}

export function evaluateFormula(
  formula: string,
  vars: Record<string, number>,
): { value: number; error?: string } {
  const src = String(formula ?? "").trim().replace(/^=/, "");
  if (!src) return { value: 0, error: "empty" };
  try {
    const expr = parser.parse(src);
    const value = Number(expr.evaluate(vars));
    if (!Number.isFinite(value)) return { value: 0, error: "non-finite" };
    return { value };
  } catch (err) {
    return { value: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export function formatValue(value: number, format: FormulaFormat): string {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value);
    case "hours":
      return `${value.toFixed(1)}h`;
    case "number":
    default:
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
}

export const KPI_FORMULA_HEADERS = ["Name", "Formula", "Format", "Hidden"];

export function parseKpiFormulaRow(row: string[], rowNumber: number): KpiFormulaDef {
  const name = String(row[0] ?? "").trim();
  const formula = String(row[1] ?? "").trim();
  const format = (String(row[2] ?? "number").trim().toLowerCase() as FormulaFormat) || "number";
  const hidden = String(row[3] ?? "").trim().toLowerCase() === "yes";
  return { name, formula, format, hidden, rowNumber };
}

export function kpiFormulaToRow(f: KpiFormulaDef): string[] {
  return [f.name, f.formula, f.format, f.hidden ? "Yes" : "No"];
}