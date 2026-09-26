import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, Lightbulb, RefreshCw, Sparkles, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { generateAiInsights, getInsights } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import type { AiGeneratedInsight, AiInsightFact, AiInsightsData, InsightsData, SpendingInsight } from "../../../../shared/types";

function todayMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00.000Z`));
}

function insightDescription(insight: SpendingInsight): string {
  if (insight.kind === "largest_category") {
    return `You spent ${formatCurrency((insight.amountMinor ?? 0) / 100)} on ${insight.category}, your highest-spending category this month.`;
  }
  if (insight.kind === "largest_expense") {
    return `Your largest expense was ${formatCurrency((insight.amountMinor ?? 0) / 100)} at ${insight.merchant}.`;
  }
  if (insight.kind === "category_change") {
    const direction = (insight.changePercent ?? 0) > 0 ? "increased" : "decreased";
    return `${insight.category} spending ${direction} by ${Math.abs(insight.changePercent ?? 0)}% compared with the previous month.`;
  }
  if (insight.kind === "spending_concentration") {
    return `${insight.categories?.join(" and ")} account for ${insight.percentage}% of this month's expenses.`;
  }
  return `${insight.category} appears in ${insight.transactionCount} expense entries this month.`;
}

function insightIcon(insight: SpendingInsight) {
  if (insight.kind === "category_change") return (insight.changePercent ?? 0) > 0 ? TrendingUp : TrendingDown;
  if (insight.kind === "largest_expense" || insight.kind === "largest_category") return Trophy;
  return BarChart3;
}

export function InsightsPage() {
  const [month, setMonth] = useState(todayMonth);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiData, setAiData] = useState<AiInsightsData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getInsights(month));
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Insights could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setAiData(null);
    setAiError(null);
  }, [month]);

  const generate = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      setAiData(await generateAiInsights(month));
    } catch (generationError) {
      setAiData(null);
      setAiError(generationError instanceof Error ? generationError.message : "AI insights could not be generated.");
    } finally {
      setAiLoading(false);
    }
  }, [month]);

  return (
    <div>
      <PageHeader
        eyebrow="See the patterns in your spending"
        title="Insights"
        description="Deterministic spending observations plus optional AI interpretations grounded in your recorded Sejora data."
        motif
      />

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Focus month</p>
            <div className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-800">
              <CalendarDays size={18} className="text-primary" />
              <span>{formatMonth(month)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Category changes compare with the previous month; unusual spending uses the prior 12 months.</p>
          </div>
          <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
            Month
            <input aria-label="Insights month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="form-input mt-1 normal-case tracking-normal" />
          </label>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">Insights are unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
            <Button variant="secondary" onClick={() => void load()}><RefreshCw size={15} /> Try again</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : data ? (
        <>
          <section className="mb-5 grid gap-4 sm:grid-cols-3" aria-label="Insights summary">
            <SummaryCard label="Focus transactions" value={data.metadata.focusTransactionCount} />
            <SummaryCard label="Spending observations" value={data.insights.length} />
            <SummaryCard label="Unusual spending flags" value={data.anomalies.length} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Spending observations</h2>
                  <p className="mt-1 text-xs text-muted">Explainable patterns from {formatMonth(month)}</p>
                </div>
                <Lightbulb size={18} className="text-brand-600" />
              </CardHeader>
              <CardContent className="pt-5">
                {data.insights.length === 0 ? (
                  <EmptyState compact title={data.metadata.focusTransactionCount === 0 ? "A quiet month" : "A little more activity will help"} description="Add a few expense entries and Sejora can start surfacing factual patterns here." />
                ) : (
                  <div className="space-y-3">
                    {data.insights.map((insight) => {
                      const Icon = insightIcon(insight);
                      return (
                        <div key={insight.id} className="flex gap-3 rounded-xl border border-border-subtle bg-surface-muted px-4 py-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-brand text-brand-700"><Icon size={17} /></div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{insight.title}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{insightDescription(insight)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <AnomalyCard data={data} />
          </section>

          <Card className="mt-5">
            <CardContent className="flex flex-col gap-2 p-5 text-xs leading-5 text-slate-500">
              <p><span className="font-bold text-slate-700">Evidence window:</span> {formatMonth(data.comparisonFrom.slice(0, 7))} is used for month-over-month comparisons.</p>
              <p><span className="font-bold text-slate-700">Unusual spending baseline:</span> {formatDate(data.baselineFrom)} to {formatDate(data.baselineTo)}. At least five historical expenses are required before an anomaly can be flagged.</p>
            </CardContent>
          </Card>
          <AiInsightsCard data={aiData} loading={aiLoading} error={aiError} onGenerate={() => void generate()} />
        </>
      ) : !error ? (
        <EmptyState title="Nothing to report yet" description="Choose a valid month to review your spending patterns." />
      ) : null}
    </div>
  );
}

function AiInsightsCard({
  data,
  loading,
  error,
  onGenerate,
}: {
  data: AiInsightsData | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  return (
    <Card className="surface-card--brand mt-5">
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-700">AI interpretation</span>
          </div>
          <h2 className="mt-3 text-base font-bold text-slate-900">Understand the patterns</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted">Generate a small set of neutral interpretations from Sejora&apos;s calculated financial facts. This is on-demand so you stay in control of provider calls.</p>
        </div>
        <Sparkles size={19} className="text-brand-600" />
      </CardHeader>
      <CardContent className="pt-5">
        {error && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">AI insights are unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
            <Button variant="secondary" onClick={onGenerate} disabled={loading}><RefreshCw size={15} /> Try again</Button>
          </div>
        )}
        {loading ? (
          <AiLoadingState />
        ) : data?.status === "insufficient_data" ? (
          <EmptyState compact title="More history is needed" description={data.statusMessage} />
        ) : data ? (
          <div>
            {data.insights.length === 0 ? (
              <EmptyState compact title="No supported pattern yet" description="Sejora did not find enough supported patterns to explain for this period." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.insights.map((insight) => <AiInsightCard key={insight.id} insight={insight} />)}
              </div>
            )}
            <p className="mt-4 border-t border-brand-100 pt-4 text-xs leading-5 text-slate-500">{data.disclosure}</p>
            <Button className="mt-4" variant="secondary" onClick={onGenerate} disabled={loading}><RefreshCw size={15} /> Regenerate interpretations</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-xl bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Ready when you are</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">The request sends structured aggregates only. It does not send credentials, raw transaction history, or personal identity details.</p>
            </div>
            <Button onClick={onGenerate} disabled={loading}><Sparkles size={15} /> Generate insights</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AiInsightCard({ insight }: { insight: AiGeneratedInsight }) {
  const tone = insight.severity === "high"
    ? "border-rose-200 bg-rose-50/60"
    : insight.severity === "medium"
      ? "border-amber-200 bg-amber-50/60"
       : "border-brand-100 bg-surface-brand";
  return (
    <div className={`rounded-xl border px-4 py-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Sparkles size={17} /></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-800">{insight.title}</p>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{insight.type}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{insight.summary}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2 border-t border-black/5 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Supporting facts from Sejora</p>
        {insight.supportingFacts.map((fact) => <SupportingFact key={fact.id} fact={fact} />)}
      </div>
    </div>
  );
}

function SupportingFact({ fact }: { fact: AiInsightFact }) {
  const value = fact.previousValueMinor !== undefined
    ? `${formatCurrency(fact.previousValueMinor / 100)} → ${formatCurrency((fact.valueMinor ?? 0) / 100)}`
    : fact.valueMinor !== undefined
      ? formatCurrency(fact.valueMinor / 100)
      : fact.percentage !== undefined
        ? `${fact.percentage}%`
        : fact.count !== undefined
          ? String(fact.count)
          : fact.textValue ?? "Recorded";
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500">{fact.label}{fact.textValue && fact.valueMinor !== undefined ? ` · ${fact.textValue}` : ""}</span>
      <span className="shrink-0 font-bold text-slate-700">{value}</span>
    </div>
  );
}

function AiLoadingState() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-label="Generating AI insights">
      {[1, 2].map((item) => (
        <div key={item} className="space-y-3 rounded-xl bg-white/70 p-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function AnomalyCard({ data }: { data: InsightsData }) {
  return (
    <Card className="surface-card--brand">
      <CardHeader>
        <div>
          <h2 className="text-base font-bold text-slate-900">Unusual spending</h2>
          <p className="mt-1 text-xs text-muted">Compared with your own historical expense amounts</p>
        </div>
        <AlertTriangle size={18} className="text-amber-700" />
      </CardHeader>
      <CardContent className="pt-5">
        {data.anomalies.length === 0 ? (
          <EmptyState compact title={data.metadata.hasAnomalyHistory ? "Nothing unusual spotted" : "A little more history will help"} description={data.metadata.hasAnomalyHistory ? "No expense in this month crossed the deterministic comparison thresholds." : "At least five historical expenses are needed before unusual spending can be flagged."} />
        ) : (
          <div className="space-y-3">
            {data.anomalies.map((anomaly) => (
              <div key={anomaly.id} className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Unusual spending detected</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{anomaly.merchant}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-slate-800">{formatCurrency(anomaly.amountMinor / 100)}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {anomaly.signal === "category_amount"
                    ? `${formatCurrency(anomaly.amountMinor / 100)} is significantly higher than your usual ${anomaly.category} expense of about ${formatCurrency(anomaly.baselineAverageMinor / 100)}.`
                    : `${formatCurrency(anomaly.amountMinor / 100)} is substantially larger than your recent expense average of about ${formatCurrency(anomaly.baselineAverageMinor / 100)}.`}
                </p>
                <p className="mt-2 text-xs text-slate-500">{anomaly.category} · {formatDate(anomaly.occurredAt)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="min-h-[104px] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-800">{value}</p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Loading insights">
      <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <Card key={item}><CardContent className="min-h-[104px] space-y-4 p-5"><div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-8 w-1/3 animate-pulse rounded bg-slate-100" /></CardContent></Card>)}</div>
      <div className="grid gap-5 xl:grid-cols-2">{[1, 2].map((item) => <Card key={item}><CardContent className="h-72 animate-pulse p-5"><div className="h-full rounded-xl bg-slate-100" /></CardContent></Card>)}</div>
    </div>
  );
}