import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardVariant = "standard" | "supportive" | "accent" | "positive" | "attention" | "negative";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

export function Card({ className, variant = "standard", ...props }: CardProps) {
  return <div className={cn("surface-card rounded-2xl border transition-shadow", variant !== "standard" && `surface-card--${variant}`, className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-4 p-5 pb-0", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}