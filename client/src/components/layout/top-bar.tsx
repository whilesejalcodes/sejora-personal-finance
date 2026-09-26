import { useState } from "react";
import { useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNavigationContext } from "@/components/layout/navigation";

type TopBarProps = {
  onMenuClick: () => void;
  onLogout: () => Promise<void>;
};

export function TopBar({ onMenuClick, onLogout }: TopBarProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const { pathname } = useLocation();
  const { group, label } = getNavigationContext(pathname);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="app-topbar flex min-h-[76px] items-center justify-between gap-4 border-b px-5 py-3 backdrop-blur sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="icon" className="lg:hidden" aria-label="Open navigation" onClick={onMenuClick}>
          <Menu size={21} />
        </Button>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
            <li className="shrink-0 text-text-secondary">{group}</li>
            <li aria-hidden="true" className="shrink-0 text-slate-300">/</li>
            <li className="truncate font-semibold text-primary" title={label}>{label}</li>
          </ol>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden border-l border-slate-200 pl-3 leading-tight sm:block sm:pl-4">
          <p className="text-sm font-semibold text-primary">Sejora</p>
          <p className="mt-0.5 text-[11px] text-text-secondary">Personal finance workspace</p>
        </div>
        <div className="border-l border-slate-200 pl-2 sm:border-l-0 sm:pl-0">
          <Button
            type="button"
            variant="ghost"
            aria-label="Log out"
            title="Log out"
            disabled={loggingOut}
            onClick={handleLogout}
            className="ml-1 h-10 px-2.5 text-slate-600 hover:text-slate-900 sm:px-3"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">{loggingOut ? "Logging out…" : "Log out"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}