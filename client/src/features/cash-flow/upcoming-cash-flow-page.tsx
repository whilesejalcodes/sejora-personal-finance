import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CalendarDays, RefreshCw, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getUpcomingCashFlow } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import type { UpcomingCashFlowData } from "../../../../shared/types/index.js";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00.000Z`));
}

function rangeIsValid(from: string, to: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return false;
  return (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 <= 30;
}

function frequencyLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function UpcomingCashFlowPage() {
  const initialFrom = todayDate();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(addDays(initialFrom, 30));
  const [data, setData] = useState<UpcomingCashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rangeIsValid(from, to)) {
      setData(null);
      setLoading(false);
      setError(from > to ? "Choose a start date on or before the end date." : "Choose a window of up to 31 days.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await getUpcomingCashFlow(from, to));
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Upcoming cash flow could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="Look ahead without guessing"
        title="Upcoming cash flow"
        description="Expected values derived from recurring patterns in your history. These are scheduled observations, not guaranteed future outcomes."
      />

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Expected window</p>
            <div className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-800"><CalendarDays size={18} className="text-primary" /><span>{formatDate(from)} – {formatDate(to)}</span></div>
            <p className="mt-1 text-xs text-slate-500">Only recurring expense patterns with a reliable next occurrence are included.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">From<input aria-label="Upcoming cash flow start date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="form-input mt-1 normal-case tracking-normal" /></label>
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">To<input aria-label="Upcoming cash flow end date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="form-input mt-1 normal-case tracking-normal" /></label>
          </div>
        </CardContent>
      </Card>

      {error && <Card className="mb-5 border-rose-200 bg-rose-50/60"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-rose-900">Upcoming cash flow is unavailable</p><p className="mt-1 text-sm text-rose-800">{error}</p></div>{rangeIsValid(from, to) && <Button variant="secondary" onClick={() => void load()}><RefreshCw size={15} /> Try again</Button>}</CardContent></Card>}

      {loading ? <LoadingState /> : data ? (
        <>
          <section className="mb-5 grid gap-4 sm:grid-cols-3" aria-label="Expected cash flow summary">
            <SummaryCard label="Expected income" value={formatCurrency(data.summary.expectedIncomeMinor / 100)} tone="positive" />
            <SummaryCard label="Expected expenses" value={formatCurrency(data.summary.expectedExpenseMinor / 100)} tone="negative" />
            <SummaryCard label="Expected net flow" value={`${data.summary.expectedNetFlowMinor < 0 ? "−" : "+"}${formatCurrency(Math.abs(data.summary.expectedNetFlowMinor) / 100)}`} tone={data.summary.expectedNetFlowMinor < 0 ? "negative" : "positive"} />
          </section>
          {data.items.length === 0 ? (
            <EmptyState title="Nothing scheduled to show yet" description="Expected cash flow appears when your history reveals a reliable recurring pattern." />
          ) : (
            <Card>
              <CardHeader><div><h2 className="text-base font-bold text-slate-900">Expected recurring activity</h2><p className="mt-1 text-xs text-muted">{data.summary.itemCount} expected item{data.summary.itemCount === 1 ? "" : "s"} in this window</p></div><CalendarClock size={18} className="text-brand-600" /></CardHeader>
              <CardContent className="pt-5">
                <div className="space-y-3">
                  {data.items.map((item) => <article key={item.id} className="rounded-xl border border-border-subtle bg-surface-muted px-4 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><ArrowDownRight size={17} /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{item.merchant}</p><p className="mt-1 text-xs text-slate-500">{item.category || "Multiple categories"} · {frequencyLabel(item.frequency)} · {item.occurrenceCount} observations</p></div></div><div className="text-left sm:text-right"><p className="text-base font-bold text-rose-700">−{formatCurrency(item.amountMinor / 100)}</p><p className="mt-1 text-xs text-slate-500">Expected {formatDate(item.expectedAt)}</p></div></div><div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Repeat2 size={14} className="text-brand-600" />{item.confidence}% pattern strength</span><span className="inline-flex items-center gap-1.5"><CalendarClock size={14} className="text-brand-600" />Derived from history</span></div></article>)}
                </div>
              </CardContent>
            </Card>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-500">Expected cash flow is based only on detected recurring expense patterns. No future transaction is created, and no income is assumed when the existing data does not support it.</p>
        </>
      ) : !error ? <EmptyState title="No expected flow in this window" description="Choose a valid upcoming window to review scheduled observations." /> : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
  return <Card><CardContent className="min-h-[104px] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className={`mt-3 text-2xl font-bold tracking-[-0.04em] ${tone === "negative" ? "text-rose-700" : "text-positive"}`}>{value}</p></CardContent></Card>;
}

function LoadingState() {
  return <div className="space-y-5" aria-label="Loading upcoming cash flow"><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <Card key={item}><CardContent className="min-h-[104px] space-y-4 p-5"><div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-8 w-2/3 animate-pulse rounded bg-slate-100" /></CardContent></Card>)}</div><Card><CardContent className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</CardContent></Card></div>;
}