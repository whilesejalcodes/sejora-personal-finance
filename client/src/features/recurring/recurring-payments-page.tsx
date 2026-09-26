import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CalendarDays, RefreshCw, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getRecurringPayments } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import { shiftMonth } from "../../../../shared/finance/calculations";
import type { RecurringPaymentsData } from "../../../../shared/types";

function todayMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00.000Z`));
}

function rangeIsValid(from: string, to: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(from)
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(to)
    && from <= to
    && shiftMonth(from, 11) >= to;
}

function frequencyLabel(frequency: string): string {
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

export function RecurringPaymentsPage() {
  const currentMonth = todayMonth();
  const [from, setFrom] = useState(shiftMonth(currentMonth, -11));
  const [to, setTo] = useState(currentMonth);
  const [data, setData] = useState<RecurringPaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rangeIsValid(from, to)) {
      setData(null);
      setLoading(false);
      setError(from > to ? "Choose a start month on or before the end month." : "Choose a range of up to 12 months.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await getRecurringPayments(from, to));
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Recurring payments could not be loaded.");
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
        eyebrow="Recognize repeating commitments"
        title="Recurring payments"
        description="Likely recurring patterns detected from repeated expense timing, merchants, and amounts. These are observations, not guarantees."
      />

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">History window</p>
            <div className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-800">
              <CalendarDays size={18} className="text-primary" />
              <span>{formatMonth(from)} – {formatMonth(to)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Patterns require at least three consistent expense observations.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
              From
              <input aria-label="Recurring payments start month" type="month" value={from} onChange={(event) => setFrom(event.target.value)} className="form-input mt-1 normal-case tracking-normal" />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
              To
              <input aria-label="Recurring payments end month" type="month" value={to} onChange={(event) => setTo(event.target.value)} className="form-input mt-1 normal-case tracking-normal" />
            </label>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">Recurring payments are unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
            {rangeIsValid(from, to) && <Button variant="secondary" onClick={() => void load()}><RefreshCw size={15} /> Try again</Button>}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : data ? (
        data.items.length === 0 ? (
          <EmptyState
            title={data.metadata.expenseTransactionCount < 3 ? "A little more history will help" : "No repeating rhythm spotted yet"}
            description={data.metadata.expenseTransactionCount < 3 ? "Add at least three expense observations over time before Sejora can identify a repeating pattern." : "No merchant had a consistent enough amount and interval in this history window."}
            detail
          />
        ) : (
          <Card>
            <CardHeader>
              <div>
                <h2 className="text-base font-bold text-slate-900">Likely recurring payments</h2>
                <p className="mt-1 text-xs text-muted">{data.items.length} pattern{data.items.length === 1 ? "" : "s"} found from {data.metadata.expenseTransactionCount} expense entries</p>
              </div>
              <Repeat2 size={18} className="text-brand-600" />
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-3">
                {data.items.map((payment) => (
                  <article key={payment.id} className="rounded-xl border border-border-subtle bg-surface-muted px-4 py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{payment.merchant}</p>
                        <p className="mt-1 text-xs text-slate-500">{payment.category || "Multiple categories"} · {frequencyLabel(payment.frequency)} · {payment.occurrenceCount} observations</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-base font-bold text-slate-800">{formatCurrency(payment.typicalAmountMinor / 100)}</p>
                        <p className="mt-1 text-xs text-slate-500">Typical amount</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                      <Detail icon={<CalendarClock size={14} />} label="Last occurrence" value={formatDate(payment.lastOccurrence)} />
                      <Detail icon={<CalendarDays size={14} />} label="Expected next" value={payment.nextExpectedOccurrence ? formatDate(payment.nextExpectedOccurrence) : "Not reliable"} />
                      <Detail icon={<Repeat2 size={14} />} label="Pattern strength" value={`${payment.confidence}%`} />
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-secondary" style={{ width: `${payment.confidence}%` }} /></div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      ) : !error ? (
        <EmptyState title="Nothing repeating just yet" description="Choose a valid history window to review repeating expense patterns." />
      ) : null}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-2 text-slate-500"><span className="text-brand-600">{icon}</span><span><span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</span><span className="mt-1 block font-semibold text-slate-700">{value}</span></span></div>;
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="space-y-4 p-5" aria-label="Loading recurring payments">
        {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-slate-100" />)}
      </CardContent>
    </Card>
  );
}