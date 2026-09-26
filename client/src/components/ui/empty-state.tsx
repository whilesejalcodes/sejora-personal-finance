import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  detail?: boolean;
};

export function EmptyState({ title, description, action, compact = false, detail = false }: EmptyStateProps) {
  return (
    <Card variant={compact ? "supportive" : "standard"} className={compact ? "shadow-none" : undefined}>
      <CardContent className={compact ? "flex items-center gap-4 p-4" : "flex flex-col items-center justify-center px-6 py-14 text-center"}>
        {detail && <span className="empty-state-detail" aria-hidden="true"><span /><span /><span /></span>}
        <div className={compact ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400" : "flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"}>
          <Inbox size={compact ? 18 : 22} />
        </div>
        <div className={compact ? "min-w-0" : "mt-4 max-w-sm"}>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          {action && <div className={compact ? "mt-3" : "mt-5"}>{action}</div>}
        </div>
      </CardContent>
    </Card>
  );
}