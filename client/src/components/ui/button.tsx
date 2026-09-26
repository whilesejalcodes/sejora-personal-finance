import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary px-4 py-2.5 text-white shadow-sm hover:bg-primary-hover",
        variant === "secondary" && "border border-border-subtle bg-surface-card px-4 py-2.5 text-ink-700 hover:bg-surface-muted",
        variant === "ghost" && "px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800",
        variant === "icon" && "h-10 w-10 text-slate-500 hover:bg-slate-100 hover:text-slate-800",
        className,
      )}
      {...props}
    />
  );
}