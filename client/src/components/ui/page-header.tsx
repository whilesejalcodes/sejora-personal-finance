import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  motif?: boolean;
};

export function PageHeader({ eyebrow, title, description, action, motif = false }: PageHeaderProps) {
  return (
    <div className="page-intro mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      {motif && <span className="sejora-motif" aria-hidden="true"><span /><span /><span /></span>}
      <div className="relative z-10">
        {eyebrow && <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.045em] text-ink-950 sm:text-[34px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>
      </div>
      {action && <div className="relative z-10 shrink-0">{action}</div>}
    </div>
  );
}