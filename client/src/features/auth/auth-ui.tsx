import type { InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function AuthLayout({
  children,
  showFounderSignature = false,
}: {
  children: ReactNode;
  showFounderSignature?: boolean;
}) {
  return (
    <main className="auth-shell min-h-[100svh]">
      <div className="grid min-h-[100svh] lg:grid-cols-[minmax(280px,0.72fr)_minmax(480px,1fr)]">
        <section className="auth-brand-panel flex min-h-[220px] flex-col justify-between px-6 py-7 sm:px-10 sm:py-9 lg:min-h-[100svh] lg:px-12 lg:py-11">
          <Link to="/login" className="flex items-center gap-3">
            <span className="logo-mark flex h-10 w-10 items-center justify-center rounded-xl text-white">
              <span className="text-lg font-semibold">S</span>
            </span>
            <span className="text-[17px] font-bold tracking-[-0.03em] text-white">sejora</span>
          </Link>
          <div className="hidden max-w-sm lg:block">
            <p className="auth-brand-kicker mb-4 text-[11px] font-bold uppercase tracking-[0.2em]">Calm financial intelligence</p>
            <h1 className="auth-brand-title text-4xl font-semibold leading-[1.08] tracking-[-0.05em] xl:text-5xl">
              Clarity for every rupee.
            </h1>
            <p className="auth-brand-copy mt-5 max-w-xs text-sm leading-6">
              A thoughtful place to understand your money, one decision at a time.
            </p>
          </div>
          <div className="hidden lg:block">
            <p className="auth-brand-footer text-xs">Private by design · Built for your financial picture</p>
          </div>
        </section>

        <section className="auth-form-panel relative flex min-h-[calc(100svh-220px)] flex-col px-5 py-8 sm:px-10 sm:py-10 lg:h-[100svh] lg:min-h-0 lg:max-h-[100svh] lg:overflow-y-auto lg:px-16">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4 pb-10 lg:pb-14">
            {children}
          </div>
          {showFounderSignature && <p className="founder-signature shrink-0 text-center lg:absolute lg:bottom-5 lg:left-0 lg:right-0">MADE BY SEJAL</p>}
        </section>
      </div>
    </main>
  );
}

export function AuthHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-[-0.045em] text-ink-950">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted">{description}</p>
    </header>
  );
}

export function AuthField({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-ink-700">{label}</span>
      <input className="auth-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition" {...props} />
      {error && <span className="mt-2 block text-xs font-medium text-negative-700">{error}</span>}
    </label>
  );
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return <div className="auth-alert rounded-xl border px-4 py-3 text-sm leading-5">{children}</div>;
}

export function AuthUnavailable({ missingConfig }: { missingConfig: string[] }) {
  return (
    <AuthAlert>
      <p className="font-semibold text-ink-900">Authentication is not configured yet.</p>
      <p className="mt-1 text-muted">
        Add the Firebase client variables in Replit Secrets to enable account access.
      </p>
      <p className="mt-2 text-xs text-muted">{missingConfig.length} client settings are required before sign-in is available.</p>
    </AuthAlert>
  );
}

export function AuthSubmitButton({
  children,
  loading,
  className,
  disabled,
  type = "submit",
  ...props
}: React.ComponentProps<typeof Button> & { loading?: boolean }) {
  return (
    <Button {...props} type={type} disabled={loading || disabled} className={cn("w-full justify-center", className)}>
      {loading ? "Please wait…" : children}
    </Button>
  );
}