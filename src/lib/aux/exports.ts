import * as XLSX from "xlsx";
import pptxgen from "pptxgenjs";
import { toPng } from "html-to-image";

// -------------------------------------------------------------
// XLSX export
// -------------------------------------------------------------
export function exportRowsToXlsx(
  rows: Array<Record<string, unknown>>,
  filename: string,
  sheetName = "Data",
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, ensureExt(filename, "xlsx"));
}

// -------------------------------------------------------------
// PNG export from a DOM element
// -------------------------------------------------------------
export async function exportElementToPng(
  el: HTMLElement,
  filename: string,
): Promise<void> {
  const dataUrl = await toPng(el, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    pixelRatio: 2,
    cacheBust: true,
  });
  triggerDownload(dataUrl, ensureExt(filename, "png"));
}

// -------------------------------------------------------------
// PPTX export — one slide with a title + chart snapshot + optional data table
// -------------------------------------------------------------
export async function exportChartToPptx(opts: {
  element: HTMLElement;
  title: string;
  subtitle?: string;
  rows?: Array<Record<string, unknown>>;
  filename: string;
}): Promise<void> {
  const { element, title, subtitle, rows, filename } = opts;

  const dataUrl = await toPng(element, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    cacheBust: true,
  });

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = title;

  const slide = pptx.addSlide();
  slide.background = { color: "F3F5F9" };

  slide.addText(title, {
    x: 0.5,
    y: 0.35,
    w: 12.3,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: "003D8F",
    fontFace: "DM Sans",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.95,
      w: 12.3,
      h: 0.35,
      fontSize: 12,
      color: "6C7280",
      fontFace: "DM Sans",
    });
  }

  slide.addImage({
    data: dataUrl,
    x: 0.5,
    y: 1.5,
    w: 12.3,
    h: 5.5,
    sizing: { type: "contain", w: 12.3, h: 5.5 },
  });

  if (rows && rows.length > 0) {
    const tableSlide = pptx.addSlide();
    tableSlide.background = { color: "FFFFFF" };
    tableSlide.addText(`${title} — Data`, {
      x: 0.5,
      y: 0.35,
      w: 12.3,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: "003D8F",
      fontFace: "DM Sans",
    });

    const headers = Object.keys(rows[0]);
    const tableRows: pptxgen.TableRow[] = [
      headers.map<pptxgen.TableCell>((h) => ({
        text: h,
        options: {
          bold: true,
          color: "FFFFFF",
          fill: { color: "003D8F" },
          fontSize: 11,
          fontFace: "DM Sans",
        },
      })),
      ...rows.map<pptxgen.TableRow>((r) =>
        headers.map<pptxgen.TableCell>((h) => ({
          text: String(r[h] ?? ""),
          options: { fontSize: 10, color: "1F2937", fontFace: "DM Sans" },
        })),
      ),
    ];

    tableSlide.addTable(tableRows, {
      x: 0.5,
      y: 1.2,
      w: 12.3,
      colW: Array(headers.length).fill(12.3 / headers.length),
      border: { pt: 0.5, color: "E5E7EB" },
      fontFace: "DM Sans",
    });
  }

  await pptx.writeFile({ fileName: ensureExt(filename, "pptx") });
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function ensureExt(name: string, ext: string): string {
  const lower = name.toLowerCase();
  return lower.endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}

function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}