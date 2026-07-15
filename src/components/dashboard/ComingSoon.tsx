import { Sparkles, type LucideIcon } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

interface ComingSoonProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  description: string;
  planned: string[];
}

export function ComingSoon({ title, subtitle, icon: Icon, description, planned }: ComingSoonProps) {
  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> Coming soon
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Planned in this module
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {planned.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Data source not yet wired for this module. Tell the assistant which insights matter most and it will be built with real data next.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}