import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Navigation } from "@/components/layout/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { useAuth } from "@/features/auth/use-auth";

export function AppShell() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileNavOpen]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell min-h-screen">
      <div className="flex min-h-screen">
        <Navigation
          open={mobileNavOpen}
          collapsed={collapsed}
          onClose={() => setMobileNavOpen(false)}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
        />
        <div className="min-w-0 flex-1">
          <TopBar onMenuClick={() => setMobileNavOpen(true)} onLogout={handleLogout} />
          <main className="mx-auto w-full max-w-[1480px] p-5 sm:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}