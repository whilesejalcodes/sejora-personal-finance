import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  CreditCard,
  FileScan,
  Gauge,
  Goal,
  Lightbulb,
  PanelLeftClose,
  Repeat2,
  Settings,
  Sparkles,
  TrendingUp,
  WalletCards,
  WalletMinimal,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { PlannedRoute } from "../../../../shared/types";

type NavigationProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
};

export type NavigationItem = { label: string; to: PlannedRoute; icon: typeof Gauge };

export const mainNavigation: NavigationItem[] = [
  { label: "Overview", to: "/dashboard", icon: Gauge },
  { label: "Transactions", to: "/transactions", icon: CreditCard },
  { label: "Budgets", to: "/budgets", icon: WalletCards },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Goals", to: "/goals", icon: Goal },
  { label: "Upcoming cash flow", to: "/cash-flow", icon: CalendarClock },
];

export const intelligenceNavigation: NavigationItem[] = [
  { label: "Forecast", to: "/forecast", icon: TrendingUp },
  { label: "Recurring payments", to: "/recurring-payments", icon: Repeat2 },
  { label: "Receipt scanner", to: "/receipts", icon: FileScan },
  { label: "Insights", to: "/insights", icon: Lightbulb },
  { label: "AI Finance", to: "/ai-finance", icon: Sparkles },
];

export const settingsNavigationItem: NavigationItem = { label: "Settings", to: "/settings", icon: Settings };

const routeNavigation: Array<NavigationItem & { group: "Workspace" | "Intelligence" }> = [
  ...mainNavigation.map((item) => ({ ...item, group: "Workspace" as const })),
  ...intelligenceNavigation.map((item) => ({ ...item, group: "Intelligence" as const })),
  { ...settingsNavigationItem, group: "Workspace" },
];

export function getNavigationContext(pathname: string): { group: "Workspace" | "Intelligence"; label: string } {
  const item = routeNavigation.find((candidate) => candidate.to === pathname);
  return item ? { group: item.group, label: item.label } : { group: "Workspace", label: "Overview" };
}

export function Navigation({ open, collapsed, onClose, onToggleCollapsed }: NavigationProps) {
  return (
    <>
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" onClick={onClose} />}
      <aside
        aria-label="Primary navigation"
        aria-modal={open ? true : undefined}
        role={open ? "dialog" : undefined}
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col overflow-hidden border-r px-4 py-5 transition-transform duration-200 lg:static lg:translate-x-0",
          collapsed && "lg:w-[84px]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("app-sidebar-header sticky top-0 z-10 flex shrink-0 items-center justify-between px-2 pb-2", collapsed && "lg:justify-center")}>
          <NavLink to="/dashboard" className={cn("flex items-center gap-3", collapsed && "lg:gap-0")} onClick={onClose}>
          <span className="logo-mark flex h-10 w-10 items-center justify-center rounded-xl text-white">
              <WalletMinimal size={21} strokeWidth={2.2} />
            </span>
            <span className={cn("sidebar-brand-text text-[17px] font-bold tracking-[-0.03em]", collapsed && "lg:hidden")}>sejora</span>
          </NavLink>
          <button aria-label="Close navigation" className="sidebar-close rounded-lg p-2 lg:hidden" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto pr-0.5", collapsed && "lg:pr-0")}>
          <div className={cn("mt-8 flex flex-col pb-4", collapsed && "lg:items-center")}>
            <p className={cn("sidebar-section-label px-3 text-[10px] font-bold uppercase tracking-[0.18em]", collapsed && "lg:hidden")}>Workspace</p>
            <nav className="mt-3 space-y-1">
              {mainNavigation.map((item) => <NavigationItem key={item.to} {...item} collapsed={collapsed} onClose={onClose} />)}
            </nav>

            <p className={cn("sidebar-section-label mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em]", collapsed && "lg:hidden")}>Intelligence</p>
            <nav className="mt-3 space-y-1">
              {intelligenceNavigation.map((item) => <NavigationItem key={item.to} {...item} collapsed={collapsed} onClose={onClose} />)}
            </nav>
          </div>

          <div className="sidebar-divider space-y-1 border-t py-4">
            <NavigationItem {...settingsNavigationItem} collapsed={collapsed} onClose={onClose} />
            <button
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              className={cn("sidebar-collapse mt-3 hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold lg:flex", collapsed && "justify-center px-0")}
              onClick={onToggleCollapsed}
            >
              <PanelLeftClose size={18} className={cn(collapsed && "rotate-180")} />
              <span className={cn(collapsed && "hidden")}>Collapse menu</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavigationItem({ label, to, icon: Icon, collapsed, onClose }: { label: string; to: PlannedRoute; icon: typeof Gauge; collapsed: boolean; onClose: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClose}
      title={collapsed ? label : undefined}
      className={({ isActive }) => cn(
        "sidebar-nav-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
        collapsed && "lg:justify-center lg:px-0",
        isActive && "sidebar-nav-link--active",
      )}
    >
      {({ isActive }) => (
        <>
          <Icon size={18} strokeWidth={isActive ? 2.25 : 2} className="sidebar-nav-icon shrink-0" />
          <span className={cn(collapsed && "lg:hidden")}>{label}</span>
          {!collapsed && <ChevronRight size={15} className={cn("ml-auto opacity-0 transition-opacity group-hover:opacity-60", isActive && "opacity-70")} />}
        </>
      )}
    </NavLink>
  );
}