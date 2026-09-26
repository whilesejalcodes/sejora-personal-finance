import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, RefreshCw, TrendingUp, WalletCards } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getAnalytics } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import { shiftMonth } from "../../../../shared/finance/calculations";
import type { AnalyticsData, BudgetStatus } from "../../../../shared/types";

const CATEGORY_COLORS = ["#4d8882", "#5a778d", "#9a7028", "#ad5c62", "#7b6b8f", "#82968e"];

function todayMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function chartCurrency(value: unknown): string {
  return formatCurrency(Number(value) / 100);
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatLongMonth(month: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

function signedCurrency(amountMinor: number): string {
  if (amountMinor === 0) return formatCurrency(0);
  return `${amountMinor > 0 ? "+" : "−"}${formatCurrency(Math.abs(amountMinor) / 100)}`;
}

function rangeIsValid(from: string, to: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(to) || from > to) return false;
  return shiftMonth(from, 11) >= to;
}

const budgetStatus: Record<BudgetStatus, { label: string; className: string }> = {
  healthy: { label: "Healthy", className: "bg-positive/10 text-positive" },
  approaching: { label: "Approaching limit", className: "bg-amber-50 text-amber-700" },
  at_limit: { label: "At limit", className: "bg-orange-50 text-orange-700" },
  overspent: { label: "Overspent", className: "bg-rose-50 text-rose-700" },
};

export function AnalyticsPage() {
  const currentMonth = todayMonth();
  const [to, setTo] = useState(currentMonth);
  const [from, setFrom] = useState(shiftMonth(currentMonth, -5));
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rangeIsValid(from, to)) {
      setData(null);
      setLoading(false);
      setError(from > to ? "Choose a start month on or before the end month." : "Choose a range of up to 12 months.");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    void getAnalytics(from, to)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError) => {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : "Analytics could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [from, to]);

  const chartData = useMemo(
    () => data?.monthly.map((point) => ({ ...point, label: formatMonth(point.month) })) ?? [],
    [data],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Understand the shape of your money"
        title="Analytics"
        description="Descriptive trends built from your transaction history and existing budgets."
        motif
      />

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Review period</p>
            <div className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-800">
              <CalendarDays size={18} className="text-primary" />
              <span>{formatLongMonth(from)} – {formatLongMonth(to)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Choose up to 12 months, including months with no activity.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
              From
              <input aria-label="Analytics start month" type="month" value={from} onChange={(event) => setFrom(event.target.value)} className="form-input mt-1 normal-case tracking-normal" />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
              To
              <input aria-label="Analytics end month" type="month" value={to} onChange={(event) => setTo(event.target.value)} className="form-input mt-1 normal-case tracking-normal" />
            </label>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">Analytics are unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
            {rangeIsValid(from, to) && <Button variant="secondary" onClick={() => { setError(null); setLoading(true); void getAnalytics(from, to).then(setData).catch((retryError) => setError(retryError instanceof Error ? retryError.message : "Analytics could not be loaded.")).finally(() => setLoading(false)); }}><RefreshCw size={15} /> Try again</Button>}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : data ? (
        <>
          <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Analytics summary">
            <SummaryCard label="Total income" value={formatCurrency(data.totals.incomeMinor / 100)} tone="positive" />
            <SummaryCard label="Total expenses" value={formatCurrency(data.totals.expenseMinor / 100)} tone="negative" />
            <SummaryCard label="Net flow" value={signedCurrency(data.totals.balanceMinor)} tone={data.totals.balanceMinor < 0 ? "negative" : "positive"} />
            <SummaryCard label="Savings rate" value={data.totals.savingsRate === null ? "Not available" : `${data.totals.savingsRate}%`} tone={data.totals.savingsRate === null ? "neutral" : "positive"} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <TrendCard data={chartData} />
            <NetFlowCard data={chartData} />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <CategoryCard data={data} />
            <BudgetCard data={data} />
          </section>

          <Card className="mt-5">
            <CardHeader>
              <div>
                <h2 className="text-base font-bold text-slate-900">Transaction counts</h2>
                <p className="mt-1 text-xs text-muted">Activity across the selected period</p>
              </div>
              <BarChart3 size={18} className="text-slate-400" />
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <CountCard label="All transactions" value={data.metadata.transactionCount} />
                <CountCard label="Income entries" value={data.metadata.incomeTransactionCount} />
                <CountCard label="Expense entries" value={data.metadata.expenseTransactionCount} />
              </div>
              <div className="sr-only">
                <h3>Monthly transaction counts</h3>
                <ul>{data.monthly.map((point) => <li key={point.month}>{formatLongMonth(point.month)}: {point.transactionCount}</li>)}</ul>
              </div>
            </CardContent>
          </Card>
        </>
      ) : !error ? (
        <EmptyState title="Nothing to chart yet" description="Choose a valid date range to review your financial activity." />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" | "neutral" }) {
  return (
    <Card>
      <CardContent className="min-h-[124px] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className={`mt-3 text-2xl font-bold tracking-[-0.04em] ${tone === "positive" ? "text-positive" : tone === "negative" ? "text-rose-700" : "text-slate-500"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TrendCard({ data }: { data: Array<{ month: string; label: string; incomeMinor: number; expenseMinor: number }> }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-base font-bold text-slate-900">Income vs expenses</h2>
          <p className="mt-1 text-xs text-muted">Monthly totals for the selected range</p>
        </div>
        <TrendingUp size={18} className="text-brand-600" />
      </CardHeader>
      <CardContent className="pt-5">
        {data.every((point) => point.incomeMinor === 0 && point.expenseMinor === 0) ? (
          <EmptyState compact title="A quiet stretch" description="Monthly income and expense bars will appear once your ledger has activity." />
        ) : <div className="h-64" aria-label="Monthly income and expenses chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="#e2e8e5" strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#73838a", fontSize: 11 }} />
              <YAxis hide tickFormatter={(value) => chartCurrency(value)} />
              <Tooltip formatter={(value) => [chartCurrency(value), "Amount"]} />
              <Bar dataKey="incomeMinor" name="Income" fill="#4d8882" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenseMinor" name="Expenses" fill="#ad5c62" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>}
        {!data.every((point) => point.incomeMinor === 0 && point.expenseMinor === 0) && <div className="sr-only">
          <h3>Monthly income and expenses</h3>
          <ul>{data.map((point) => <li key={point.month}>{point.label}: income {chartCurrency(point.incomeMinor)}, expenses {chartCurrency(point.expenseMinor)}</li>)}</ul>
        </div>}
      </CardContent>
    </Card>
  );
}

function NetFlowCard({ data }: { data: Array<{ month: string; label: string; netFlowMinor: number }> }) {
  return (
    <Card className="surface-card--brand">
      <CardHeader>
        <div>
          <h2 className="text-base font-bold text-slate-900">Monthly trend</h2>
          <p className="mt-1 text-xs text-muted">Net flow · income minus expenses</p>
        </div>
        <BarChart3 size={18} className="text-brand-600" />
      </CardHeader>
      <CardContent className="pt-5">
        {data.every((point) => point.netFlowMinor === 0) ? (
          <EmptyState compact title="No net flow yet" description="The monthly trend will appear once income or expenses are recorded." />
        ) : <div className="h-64" aria-label="Monthly net flow chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid vertical={false} stroke="#dfddd4" strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#73838a", fontSize: 11 }} />
              <YAxis width={58} tickLine={false} axisLine={false} tick={{ fill: "#73838a", fontSize: 10 }} tickFormatter={(value) => chartCurrency(value)} domain={["auto", "auto"]} />
              <ReferenceLine y={0} stroke="#73838a" strokeWidth={1.5} />
              <Tooltip labelFormatter={(label) => `Month: ${label}`} formatter={(value) => [signedCurrency(Number(value)), "Net flow"]} />
              <Line type="monotone" dataKey="netFlowMinor" name="Net flow" stroke="#3f7773" strokeWidth={3} dot={(props) => <NetFlowPointDot cx={props.cx} cy={props.cy} payload={props.payload} />}>
                <LabelList dataKey="netFlowMinor" content={(props) => <NetFlowPointLabel {...props} />} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>}
        {!data.every((point) => point.netFlowMinor === 0) && <div className="sr-only">
          <h3>Monthly net flow</h3>
          <ul>{data.map((point) => <li key={point.month}>{point.label}: {signedCurrency(point.netFlowMinor)}</li>)}</ul>
        </div>}
      </CardContent>
    </Card>
  );
}

function NetFlowPointDot({ cx, cy, payload }: Pick<DotProps, "cx" | "cy"> & { payload?: { netFlowMinor?: number } }) {
  const amountMinor = payload?.netFlowMinor;
  if (typeof cx !== "number" || typeof cy !== "number" || typeof amountMinor !== "number") return null;
  if (amountMinor < 0) {
    return (
      <g aria-label="Negative net flow point">
        <line x1={cx} y1={cy} x2={cx} y2={cy + 6} stroke="#ad5c62" strokeWidth={1.5} />
        <circle cx={cx} cy={cy + 6} r={4} fill="#ad5c62" stroke="#fff" strokeWidth={2} />
      </g>
    );
  }
  if (amountMinor === 0) {
    return <rect aria-label="Zero net flow point" x={cx - 4} y={cy - 4} width={8} height={8} rx={1.5} fill="#fff" stroke="#73838a" strokeWidth={2} />;
  }
  return <circle aria-label="Positive net flow point" cx={cx} cy={cy} r={4} fill="#3f7773" stroke="#fff" strokeWidth={2} />;
}

function NetFlowPointLabel({ x, y, value, payload }: { x?: number | string; y?: number | string; value?: unknown; payload?: { netFlowMinor?: number } }) {
  const amountMinor = typeof payload?.netFlowMinor === "number" ? payload.netFlowMinor : Number(value);
  const xCoordinate = Number(x);
  const yCoordinate = Number(y);
  if (!Number.isFinite(amountMinor) || Math.abs(amountMinor) > 10_000 || !Number.isFinite(xCoordinate) || !Number.isFinite(yCoordinate)) return null;
  return (
    <text x={xCoordinate} y={yCoordinate + (amountMinor < 0 ? 18 : -10)} textAnchor="middle" fill={amountMinor < 0 ? "#ad5c62" : "#49616a"} fontSize={10} fontWeight={700}>
      {signedCurrency(amountMinor)}
    </text>
  );
}

function CategoryCard({ data }: { data: AnalyticsData }) {
  if (data.spendingByCategory.length === 0) {
    return <Card><CardHeader><div><h2 className="text-base font-bold text-slate-900">Spending by category</h2><p className="mt-1 text-xs text-muted">Expense mix for the selected range</p></div></CardHeader><CardContent className="pt-5"><EmptyState compact title="No expense mix yet" description="Expense categories will appear once your ledger has spending." /></CardContent></Card>;
  }

  const chartData = data.spendingByCategory.map((item) => ({ ...item, amount: item.amountMinor }));
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-base font-bold text-slate-900">Spending by category</h2>
          <p className="mt-1 text-xs text-muted">Expense mix for the selected range</p>
        </div>
        <BarChart3 size={18} className="text-slate-400" />
      </CardHeader>
      <CardContent className="pt-5">
        <div className="h-64" aria-label="Spending by category chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#e2e8e5" strokeDasharray="3 3" />
              <XAxis type="number" hide tickFormatter={(value) => chartCurrency(value)} />
              <YAxis type="category" dataKey="category" width={92} tickLine={false} axisLine={false} tick={{ fill: "#49616a", fontSize: 11 }} />
              <Tooltip formatter={(value) => [chartCurrency(value), "Spent"]} />
              <Bar dataKey="amount" radius={[0, 5, 5, 0]} barSize={22}>
                {chartData.map((item, index) => <Cell key={item.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 border-t border-border-subtle pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {data.spendingByCategory.map((item) => (
              <div key={item.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-600">{item.category}</span>
                <span className="shrink-0 font-bold text-slate-800">{formatCurrency(item.amountMinor / 100)} <span className="font-normal text-slate-400">({item.percentage}%)</span></span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetCard({ data }: { data: AnalyticsData }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-base font-bold text-slate-900">Budget vs actual</h2>
          <p className="mt-1 text-xs text-muted">Plans compared with matching expense transactions</p>
        </div>
        <WalletCards size={18} className="text-slate-400" />
      </CardHeader>
      <CardContent className="pt-5">
        {data.budgets.length === 0 ? (
          <EmptyState compact title="No plans in this range" description="Create a budget to compare planned and actual spending here." />
        ) : (
          <div className="space-y-3">
            {data.budgets.map((budget) => {
              const status = budgetStatus[budget.status];
              return (
                <div key={budget.id} className="rounded-xl border border-border-subtle bg-surface-muted px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{budget.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{budget.category || "All categories"} · {formatMonth(budget.startDate.slice(0, 7))}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-slate-400">Planned</p><p className="mt-1 font-bold text-slate-700">{formatCurrency(budget.amountMinor / 100)}</p></div>
                    <div><p className="text-slate-400">Spent</p><p className="mt-1 font-bold text-slate-700">{formatCurrency(budget.spentMinor / 100)}</p></div>
                    <div><p className="text-slate-400">Remaining</p><p className={`mt-1 font-bold ${budget.remainingMinor < 0 ? "text-rose-700" : "text-positive"}`}>{formatCurrency(Math.abs(budget.remainingMinor) / 100)}{budget.remainingMinor < 0 ? " over" : ""}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-surface-muted px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-800">{value}</p></div>;
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Loading analytics">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <Card key={item}><CardContent className="min-h-[124px] space-y-4 p-5"><div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-8 w-2/3 animate-pulse rounded bg-slate-100" /></CardContent></Card>)}</div>
      <div className="grid gap-5 xl:grid-cols-2">{[1, 2].map((item) => <Card key={item}><CardContent className="h-80 animate-pulse p-5"><div className="h-full rounded-xl bg-slate-100" /></CardContent></Card>)}</div>
    </div>
  );
}