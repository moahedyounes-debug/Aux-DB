import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "accent" | "success" | "warning" | "destructive";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  active?: boolean;
  flash?: boolean;
  onClick?: () => void;
}

const TONE_BG: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  active,
  flash,
  onClick,
}: KpiCardProps) {
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "surface-card animate-rise w-full text-start p-4 flex flex-col gap-3",
        interactive && "surface-card-interactive",
        active && "ring-2 ring-primary/60 border-primary",
        flash && "kpi-flash",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("rounded-lg p-2", TONE_BG[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}