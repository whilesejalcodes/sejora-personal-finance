import { useEffect, useMemo, useState } from "react";
import { BarChart3, Calculator, RefreshCw, Target, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getForecast, simulateForecast } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import type { ForecastData, ForecastSimulationData, ForecastSimulationInput } from "../../../../shared/types";

type Horizon = 1 | 3 | 6;

const DEFAULT_HORIZON: Horizon = 3;

function money(amountMinor: number): string {
  return formatCurrency(amountMinor / 100);
}

function signedMoney(amountMinor: number | null): string {
  if (amountMinor === null) return "Not available";
  if (amountMinor === 0) return money(0);
  return `${amountMinor > 0 ? "+" : "−"}${money(Math.abs(amountMinor))}`;
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

function parseMinor(value: string): number {
  const major = Number(value);
  return Number.isFinite(major) && major >= 0 ? Math.round(major * 100) : 0;
}

export function ForecastPage() {
  const [horizon, setHorizon] = useState<Horizon>(DEFAULT_HORIZON);
  const [data, setData] = useState<ForecastData | null>(null);
  const [simulation, setSimulation] = useState<ForecastSimulationData | null>(null);
  const [incomeAdjustmentPercent, setIncomeAdjustmentPercent] = useState("0");
  const [expenseAdjustmentPercent, setExpenseAdjustmentPercent] = useState("0");
  const [oneTimeExpense, setOneTimeExpense] = useState("");
  const [savingsTarget, setSavingsTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSimulation(null);
    void getForecast(horizon)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError) => {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : "Forecast could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [horizon, refreshKey]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      ...data.historical.map((point) => ({
        month: point.month,
        label: monthLabel(point.month),
        historicalIncomeMinor: point.incomeMinor,
        historicalExpenseMinor: point.expenseMinor,
        projectedIncomeMinor: null,
        projectedExpenseMinor: null,
      })),
      ...data.baseline.projected.map((point) => ({
        month: point.month,
        label: monthLabel(point.month),
        historicalIncomeMinor: null,
        historicalExpenseMinor: null,
        projectedIncomeMinor: point.incomeMinor,
        projectedExpenseMinor: point.expenseMinor,
      })),
    ];
  }, [data]);

  async function handleSimulation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSimulating(true);
    setSimulationError(null);
    const input: ForecastSimulationInput = {
      horizon,
      incomeAdjustmentPercent: Number(incomeAdjustmentPercent) || 0,
      expenseAdjustmentPercent: Number(expenseAdjustmentPercent) || 0,
      oneTimeExpenseMinor: parseMinor(oneTimeExpense),
      ...(savingsTarget.trim() ? { savingsTargetMinor: parseMinor(savingsTarget) } : {}),
    };
    try {
      setSimulation(await simulateForecast(input));
    } catch (simulationLoadError) {
      setSimulationError(simulationLoadError instanceof Error ? simulationLoadError.message : "Simulation could not be calculated.");
    } finally {
      setSimulating(false);
    }
  }

  function resetSimulation() {
    setIncomeAdjustmentPercent("0");
    setExpenseAdjustmentPercent("0");
    setOneTimeExpense("");
    setSavingsTarget("");
    setSimulation(null);
    setSimulationError(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Look ahead with clarity"
        title="Forecast"
        description="Deterministic projections based on your completed-month history. These are estimates, not guaranteed outcomes."
        motif
        action={(
          <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
            Projection horizon
            <select
              aria-label="Projection horizon"
              value={horizon}
              onChange={(event) => setHorizon(Number(event.target.value) as Horizon)}
              className="form-input mt-1 min-w-[130px] normal-case tracking-normal"
            >
              <option value={1}>1 month</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
            </select>
          </label>
        )}
      />

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">Forecast is unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
            <Button variant="secondary" onClick={() => setRefreshKey((current) => current + 1)}><RefreshCw size={15} /> Try again</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : data ? (
        <>
          <Card className="surface-card--accent mb-5 overflow-hidden">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-700">
                    {data.status === "ready" ? "Based on recent history" : data.status === "limited_data" ? "Limited history" : "Insufficient data"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink-950">{data.statusMessage}</p>
              </div>
              <p className="text-xs leading-5 text-text-secondary">
                Completed months: {monthLabel(data.historicalWindow.from.slice(0, 7))} – {monthLabel(data.historicalWindow.to.slice(0, 7))}
              </p>
            </CardContent>
          </Card>

          <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Forecast overview">
            <SummaryCard label="Actual balance" value={money(data.actualBalanceMinor)} tone="actual" />
            <SummaryCard label="Projected income / month" value={data.baseline.metrics ? money(data.baseline.metrics.monthlyIncomeMinor) : "Not available"} tone="projected" />
            <SummaryCard label="Projected expenses / month" value={data.baseline.metrics ? money(data.baseline.metrics.monthlyExpenseMinor) : "Not available"} tone="projectedNegative" />
            <SummaryCard label="Projected savings rate" value={data.baseline.metrics?.savingsRate === null || !data.baseline.metrics ? "Not available" : `${data.baseline.metrics.savingsRate}%`} tone="projected" />
            <SummaryCard label={`Projected balance · ${horizon} mo`} value={data.baseline.metrics ? money(data.baseline.metrics.endingBalanceMinor) : "Not available"} tone="projected" />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <HistoryChart data={chartData} historyEnd={data.historical.at(-1)?.month} />
            <AssumptionsCard data={data} />
          </section>

          {data.status === "insufficient_data" ? (
            <div className="mt-5">
              <EmptyState
                title="The forecast needs a little more history"
                description="Your actual history is shown above, but Sejora will not create a projection until at least two completed months contain recorded activity."
              />
            </div>
          ) : (
            <SimulationPanel
              horizon={horizon}
              incomeAdjustmentPercent={incomeAdjustmentPercent}
              expenseAdjustmentPercent={expenseAdjustmentPercent}
              oneTimeExpense={oneTimeExpense}
              savingsTarget={savingsTarget}
              simulation={simulation}
              simulating={simulating}
              error={simulationError}
              onIncomeChange={setIncomeAdjustmentPercent}
              onExpenseChange={setExpenseAdjustmentPercent}
              onOneTimeExpenseChange={setOneTimeExpense}
              onSavingsTargetChange={setSavingsTarget}
              onSubmit={handleSimulation}
              onReset={resetSimulation}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "actual" | "projected" | "projectedNegative" }) {
  return (
    <Card>
      <CardContent className="min-h-[126px] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">{label}</p>
        <p className={`mt-3 text-2xl font-bold tracking-[-0.04em] ${tone === "actual" ? "text-slate-800" : tone === "projectedNegative" ? "text-rose-700" : "text-brand-700"}`}>{value}</p>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{tone === "actual" ? "Actual" : "Projected"}</p>
      </CardContent>
    </Card>
  );
}

function HistoryChart({ data, historyEnd }: { data: Array<Record<string, string | number | null>>; historyEnd?: string }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-base font-bold text-slate-900">History and projection</h2>
          <p className="mt-1 text-xs text-muted">Monthly income and expenses · actual history versus projected pattern</p>
        </div>
        <TrendingUp size={18} className="text-brand-600" />
      </CardHeader>
      <CardContent className="pt-5">
        {data.length === 0 ? (
          <EmptyState compact title="A quiet history so far" description="Recorded monthly values will appear once transactions are available." />
        ) : (
          <>
            <div className="h-72" aria-label="Historical and projected income and expenses chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8e5" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#73838a", fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip formatter={(value) => [money(Number(value)), "Amount"]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="historicalIncomeMinor" name="Actual income" stroke="#4d8882" strokeWidth={3} connectNulls={false} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="historicalExpenseMinor" name="Actual expenses" stroke="#ad5c62" strokeWidth={3} connectNulls={false} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="projectedIncomeMinor" name="Projected income" stroke="#4d8882" strokeWidth={2} strokeDasharray="6 5" connectNulls={false} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="projectedExpenseMinor" name="Projected expenses" stroke="#ad5c62" strokeWidth={2} strokeDasharray="6 5" connectNulls={false} dot={{ r: 3 }} />
                  {historyEnd && <ReferenceLine x={monthLabel(historyEnd)} stroke="#8ba29d" strokeDasharray="4 4" label={{ value: "History ends", position: "insideTopRight", fill: "#58736f", fontSize: 10 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-slate-500">Solid lines are actual recorded history. Dashed lines are projected monthly averages.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AssumptionsCard({ data }: { data: ForecastData }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-base font-bold text-slate-900">How this projection works</h2>
          <p className="mt-1 text-xs text-muted">Transparent assumptions, not financial advice</p>
        </div>
        <BarChart3 size={18} className="text-slate-400" />
      </CardHeader>
      <CardContent className="pt-5">
        <div className="rounded-xl bg-surface-muted p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Data coverage</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><p className="text-xs text-slate-500">Completed months</p><p className="mt-1 text-lg font-bold text-slate-800">{data.historicalWindow.monthCount}</p></div>
            <div><p className="text-xs text-slate-500">Months with activity</p><p className="mt-1 text-lg font-bold text-slate-800">{data.historicalWindow.activeMonthCount}</p></div>
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {data.assumptions.map((assumption) => <li key={assumption} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />{assumption}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}

function SimulationPanel({
  horizon,
  incomeAdjustmentPercent,
  expenseAdjustmentPercent,
  oneTimeExpense,
  savingsTarget,
  simulation,
  simulating,
  error,
  onIncomeChange,
  onExpenseChange,
  onOneTimeExpenseChange,
  onSavingsTargetChange,
  onSubmit,
  onReset,
}: {
  horizon: Horizon;
  incomeAdjustmentPercent: string;
  expenseAdjustmentPercent: string;
  oneTimeExpense: string;
  savingsTarget: string;
  simulation: ForecastSimulationData | null;
  simulating: boolean;
  error: string | null;
  onIncomeChange: (value: string) => void;
  onExpenseChange: (value: string) => void;
  onOneTimeExpenseChange: (value: string) => void;
  onSavingsTargetChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}) {
  return (
    <Card className="surface-card--brand mt-5">
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">What-if simulation</span>
          </div>
          <h2 className="mt-3 text-base font-bold text-slate-900">Explore a hypothetical scenario</h2>
          <p className="mt-1 text-xs text-muted">Change assumptions without changing transactions, budgets, goals, or recurring payments.</p>
        </div>
        <Calculator size={19} className="text-amber-700" />
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="form-label">Income adjustment (%)
              <input aria-label="Income adjustment percentage" type="number" min="-100" max="500" step="1" value={incomeAdjustmentPercent} onChange={(event) => onIncomeChange(event.target.value)} className="form-input mt-1" />
              <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-slate-400">−100% to +500%</span>
            </label>
            <label className="form-label">Expense adjustment (%)
              <input aria-label="Expense adjustment percentage" type="number" min="-100" max="500" step="1" value={expenseAdjustmentPercent} onChange={(event) => onExpenseChange(event.target.value)} className="form-input mt-1" />
              <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-slate-400">−100% to +500%</span>
            </label>
            <label className="form-label">One-time expense (₹)
              <input aria-label="One-time expense" type="number" min="0" step="0.01" value={oneTimeExpense} onChange={(event) => onOneTimeExpenseChange(event.target.value)} className="form-input mt-1" placeholder="0" />
              <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-slate-400">Applied to month 1 only</span>
            </label>
            <label className="form-label">Monthly savings target (₹)
              <input aria-label="Monthly savings target" type="number" min="0" step="0.01" value={savingsTarget} onChange={(event) => onSavingsTargetChange(event.target.value)} className="form-input mt-1" placeholder="Optional" />
              <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-slate-400">Compared with simulated savings</span>
            </label>
          </div>
          {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-xs text-slate-500 sm:mr-auto">SIMULATION · {horizon} month horizon · no records are changed</p>
            <Button type="button" variant="secondary" onClick={onReset}>Reset scenario</Button>
            <Button type="submit" disabled={simulating}>{simulating ? "Calculating…" : "Run simulation"}</Button>
          </div>
        </form>

        {simulation && (
          <SimulationResults data={simulation} />
        )}
      </CardContent>
    </Card>
  );
}

function SimulationResults({ data }: { data: ForecastSimulationData }) {
  const baseline = data.baseline.metrics;
  const scenario = data.scenario.metrics;
  return (
    <div className="mt-6 border-t border-border-subtle pt-5">
      <div className="flex items-center gap-2">
        <Target size={17} className="text-amber-700" />
        <h3 className="text-sm font-bold text-slate-900">Scenario comparison</h3>
      </div>
      {baseline && scenario ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ComparisonCard label="Monthly savings" baseline={money(baseline.monthlySavingsMinor)} scenario={money(scenario.monthlySavingsMinor)} difference={signedMoney(data.difference.monthlySavingsMinor)} />
            <ComparisonCard label={`Balance after ${data.horizon} months`} baseline={money(baseline.endingBalanceMinor)} scenario={money(scenario.endingBalanceMinor)} difference={signedMoney(data.difference.endingBalanceMinor)} />
            <ComparisonCard label="Savings rate" baseline={baseline.savingsRate === null ? "Not available" : `${baseline.savingsRate}%`} scenario={scenario.savingsRate === null ? "Not available" : `${scenario.savingsRate}%`} difference={scenario.savingsRate !== null && baseline.savingsRate !== null ? signedMoney(Math.round((scenario.savingsRate - baseline.savingsRate) * 100)) : "Not available"} />
          </div>
      {data.savingsTargetMinor !== null && <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${data.savingsTargetMet ? "bg-positive/10 text-positive" : "bg-amber-50 text-amber-800"}`}>{data.savingsTargetMet ? "The simulated monthly savings meet the target." : "The simulated monthly savings do not meet the target."} Target: {money(data.savingsTargetMinor)}.</p>}
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{data.statusMessage}</p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ProjectionList label="Baseline forecast" points={data.baseline.projected} />
        <ProjectionList label="What-if forecast" points={data.scenario.projected} />
      </div>
    </div>
  );
}

function ComparisonCard({ label, baseline, scenario, difference }: { label: string; baseline: string; scenario: string; difference: string }) {
  return (
    <div className="rounded-xl bg-white/75 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Baseline</p><p className="mt-1 text-sm font-bold text-slate-700">{baseline}</p></div>
        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700">What-if</p><p className="mt-1 text-sm font-bold text-amber-800">{scenario}</p></div>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-bold text-brand-700">Difference: {difference}</p>
    </div>
  );
}

function ProjectionList({ label, points }: { label: string; points: ForecastData["baseline"]["projected"] }) {
  return (
    <div className="rounded-xl bg-white/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-3 space-y-2">
        {points.map((point) => (
          <div key={`${label}-${point.month}`} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">{monthLabel(point.month)}</span>
            <span className="font-bold text-slate-800">{money(point.balanceMinor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Loading forecast">
      <Card><CardContent className="h-24 animate-pulse p-5"><div className="h-full rounded-xl bg-slate-100" /></CardContent></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[1, 2, 3, 4, 5].map((item) => <Card key={item}><CardContent className="min-h-[126px] space-y-4 p-5"><div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-8 w-2/3 animate-pulse rounded bg-slate-100" /></CardContent></Card>)}</div>
      <div className="grid gap-5 xl:grid-cols-2">{[1, 2].map((item) => <Card key={item}><CardContent className="h-80 animate-pulse p-5"><div className="h-full rounded-xl bg-slate-100" /></CardContent></Card>)}</div>
    </div>
  );
}