import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, action, footer, className, children }: ChartCardProps) {
  return (
    <section className={cn("surface-card animate-rise p-5 flex flex-col gap-4", className)}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </header>
      <div className="min-h-[240px]">{children}</div>
      {footer && <footer className="text-xs text-muted-foreground pt-2 border-t">{footer}</footer>}
    </section>
  );
}