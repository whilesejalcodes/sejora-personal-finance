import { CheckCircle2, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/features/auth/use-auth";

export function SettingsPage() {
  const { user, isEmailVerified } = useAuth();

  return (
    <div>
      <PageHeader
        eyebrow="Workspace preferences"
        title="Settings"
        description="A small, honest home for the account and workspace details Sejora currently supports."
      />

      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-6 p-7 sm:flex-row sm:items-start sm:p-9">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-brand text-brand-700">
            <Settings2 size={25} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Settings are intentionally minimal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sejora currently manages authentication and financial data through the existing account and workspace flows.
              You can use the account action in the header to sign out.
            </p>

            <div className="surface-muted mt-6 rounded-xl border p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Signed-in account</p>
              <p className="mt-2 truncate text-sm font-semibold text-slate-800">{user?.email ?? "Authenticated account"}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-positive">
                <CheckCircle2 size={14} />
                {isEmailVerified ? "Verified email" : "Email verification required"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}