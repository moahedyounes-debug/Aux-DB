import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  ChevronsLeft,
  Filter,
  Languages,
  UserCircle2,
  Pencil,
} from "lucide-react";
import { AuxLogo } from "@/components/AuxLogo";
import { NAV_PAGES } from "@/lib/aux/nav";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ title, subtitle, actions, children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside
        style={{ background: "var(--gradient-sidebar)" }}
        className={cn(
          "sticky top-0 h-screen shrink-0 border-r border-sidebar-border text-sidebar-foreground transition-[width] duration-300 overflow-hidden",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex items-center justify-between px-3 py-4 border-b border-sidebar-border">
          {collapsed ? (
            <AuxLogo variant="light" showWordmark={false} className="h-8 w-8 mx-auto" />
          ) : (
            <AuxLogo variant="light" className="h-10 w-auto" />
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="ml-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="py-3 px-2 space-y-0.5 overflow-y-auto h-[calc(100vh-4rem)]">
          {NAV_PAGES.map((page) => {
            const Icon = page.icon;
            const active = pathname === page.path;
            const isImplemented = page.active === true;
            const inner = (
              <span
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  !isImplemented && "opacity-60 cursor-not-allowed",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed && (
                  <>
                    <span className="truncate">{page.label}</span>
                    {page.admin && (
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-sidebar-primary">
                        Admin
                      </span>
                    )}
                    {!isImplemented && !page.admin && (
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
                        Soon
                      </span>
                    )}
                  </>
                )}
              </span>
            );
            return isImplemented ? (
              <Link key={page.path} to={page.path} className="block">
                {inner}
              </Link>
            ) : (
              <div key={page.path} title={collapsed ? page.label : undefined}>
                {inner}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {actions}
              <ToolbarButton icon={Filter} label="Filters" />
              <ToolbarButton icon={Pencil} label="Edit layout" />
              <ToolbarButton icon={Languages} label="Language" />
              <ToolbarButton icon={UserCircle2} label="Account" />
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
}: {
  icon: typeof Filter;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}