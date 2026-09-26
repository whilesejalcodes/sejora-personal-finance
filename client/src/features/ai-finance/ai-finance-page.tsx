import { FormEvent, useState } from "react";
import { CheckCircle2, CircleHelp, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { askFinanceQuestion } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import type { FinanceQuestionData, FinanceQuestionFact } from "../../../../shared/types";

const EXAMPLES = [
  "How much did I spend last month?",
  "How much did I spend on Food?",
  "What was my biggest expense?",
  "How much did I save this month?",
  "Did I spend more this month than last month?",
  "How much are my recurring payments?",
  "What is my projected balance after 3 months?",
];

function factValue(fact: FinanceQuestionFact): string {
  if (fact.amountMinor !== undefined) return formatCurrency(fact.amountMinor / 100);
  if (fact.percentage !== undefined) return fact.percentage === null ? "Not available" : `${fact.percentage}%`;
  return fact.value ?? fact.text ?? "Recorded";
}

export function AiFinancePage() {
  const [question, setQuestion] = useState("");
  const [data, setData] = useState<FinanceQuestionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      setData(await askFinanceQuestion(trimmed));
    } catch (requestError) {
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "The question could not be answered.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ask about your recorded finances"
        title="AI Finance"
        description="Ask one focused question about your Sejora data. Answers are calculated on the server from your authenticated financial records."
      />

      <Card className="surface-card--brand mb-5">
        <CardHeader>
          <div>
            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-700">Read-only Q&amp;A</span>
            <h2 className="mt-3 text-base font-bold text-slate-900">What would you like to understand?</h2>
            <p className="mt-1 text-xs leading-5 text-muted">Ask about spending, income, savings, budgets, goals, recurring payments, or forecasts. One question at a time; no chat history is stored.</p>
          </div>
          <Sparkles size={19} className="text-brand-600" />
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={submit}>
            <label htmlFor="finance-question" className="sr-only">Financial question</label>
            <textarea
              id="finance-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="For example: How much did I spend last month?"
              className="form-input min-h-[96px] resize-y"
              disabled={loading}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Your question is treated as untrusted text and cannot trigger financial changes.</p>
              <Button type="submit" disabled={!question.trim() || loading}>
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {loading ? "Checking your data…" : "Ask Sejora"}
              </Button>
            </div>
          </form>
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Try a supported question</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-full border border-border-subtle bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:border-brand-100 hover:bg-surface-brand hover:text-brand-700 disabled:opacity-50"
                  onClick={() => setQuestion(example)}
                  disabled={loading}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">The question could not be answered</p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
            <Button variant="secondary" onClick={() => void submit()} disabled={loading}><RefreshCw size={15} /> Try again</Button>
          </CardContent>
        </Card>
      )}

      {loading && <LoadingState />}
      {!loading && data && <AnswerCard data={data} />}
      {!loading && !data && !error && (
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><CircleHelp size={19} /></div>
            <div>
              <p className="text-sm font-bold text-slate-800">Answers stay grounded</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Sejora translates supported questions into a validated query, calculates the result from your records, and shows the supporting data used for the answer.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AnswerCard({ data }: { data: FinanceQuestionData }) {
  const answered = data.status === "answered";
  const statusLabel = data.status === "unsupported"
    ? "Outside the current scope"
    : data.status === "ambiguous"
      ? "Needs clarification"
      : data.status === "insufficient_data"
        ? "Not enough recorded data"
        : "Authoritative answer";
  return (
    <Card className={answered ? "surface-card--brand" : "border-amber-200 bg-amber-50/50"}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {answered ? <CheckCircle2 size={18} className="text-positive" /> : <CircleHelp size={18} className="text-amber-700" />}
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{statusLabel}</span>
        </div>
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{data.usedAi ? "AI-assisted intent" : "Deterministic intent"}</span>
      </CardHeader>
      <CardContent className="pt-5">
        <p className="text-lg font-bold leading-8 tracking-[-0.02em] text-slate-900">{data.answer}</p>
        {answered && data.supportingFacts.length > 0 && (
          <div className="mt-5 rounded-xl border border-border-subtle bg-white/75 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Supporting data</p>
            <div className="mt-3 space-y-3">
              {data.supportingFacts.map((fact, index) => (
                <div key={`${fact.label}-${index}`} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-slate-500">{fact.label}</span>
                  <span className="text-right font-bold text-slate-700">{factValue(fact)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="mt-5 border-t border-black/5 pt-4 text-xs leading-5 text-slate-500">{data.disclosure}</p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card aria-label="Checking your financial data">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><Loader2 size={17} className="animate-spin text-brand-600" /> Checking your recorded data…</div>
        <div className="h-8 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      </CardContent>
    </Card>
  );
}