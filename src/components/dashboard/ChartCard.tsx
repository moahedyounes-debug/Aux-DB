import { useRef, useState, type ReactNode } from "react";
import { Download, Image as ImageIcon, FileSpreadsheet, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  exportElementToPng,
  exportChartToPptx,
  exportRowsToXlsx,
  slugify,
} from "@/lib/aux/exports";
import { toast } from "sonner";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Table data used for XLSX + PPTX data-slide exports. */
  exportRows?: Array<Record<string, unknown>>;
  /** Disable the export menu (e.g. when the card only shows a table). */
  disableExport?: boolean;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  action,
  footer,
  className,
  exportRows,
  disableExport,
  children,
}: ChartCardProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const filenameBase = slugify(title) || "chart";

  async function withBusy(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMenuOpen(false);
    try {
      await fn();
      toast.success(`${label} exported`);
    } catch (err) {
      console.error("[ChartCard export]", err);
      toast.error(`${label} export failed`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn("surface-card animate-rise p-5 flex flex-col gap-4", className)}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {!disableExport && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Export chart"
                title="Export"
                disabled={busy}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="menu"
                    className="absolute end-0 mt-1 z-20 min-w-[180px] rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-1"
                  >
                    <MenuItem
                      icon={ImageIcon}
                      label="Download PNG"
                      onClick={() =>
                        withBusy("PNG", async () => {
                          if (!bodyRef.current) return;
                          await exportElementToPng(bodyRef.current, filenameBase);
                        })
                      }
                    />
                    <MenuItem
                      icon={Presentation}
                      label="Export to PPTX"
                      onClick={() =>
                        withBusy("PPTX", async () => {
                          if (!bodyRef.current) return;
                          await exportChartToPptx({
                            element: bodyRef.current,
                            title,
                            subtitle,
                            rows: exportRows,
                            filename: filenameBase,
                          });
                        })
                      }
                    />
                    <MenuItem
                      icon={FileSpreadsheet}
                      label="Export data (XLSX)"
                      disabled={!exportRows || exportRows.length === 0}
                      onClick={() =>
                        withBusy("XLSX", async () => {
                          if (!exportRows || exportRows.length === 0) return;
                          exportRowsToXlsx(exportRows, filenameBase, title);
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>
      <div ref={bodyRef} className="min-h-[240px]">
        {children}
      </div>
      {footer && <footer className="text-xs text-muted-foreground pt-2 border-t">{footer}</footer>}
    </section>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-start transition-colors",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}