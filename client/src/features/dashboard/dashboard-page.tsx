import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
  WalletMinimal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, currencySymbol } from "@/lib/currency";
import { getDashboard, getFinancialHealth, getGoals } from "@/lib/api-client";
import type { BudgetStatus, DashboardData, FinancialHealthData, GoalView, TransactionRecord } from "../../../../shared/types";
import { TransactionForm } from "@/features/transactions/transaction-form";

const CATEGORY_COLORS = ["#4d8882", "#5a778d", "#9a7028", "#ad5c62", "#7b6b8f", "#82968e"];

function todayMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatSignedCurrency(amountMinor: number): string {
  if (amountMinor === 0) return formatCurrency(0);
  return `${amountMinor > 0 ? "+" : "−"}${formatCurrency(Math.abs(amountMinor) / 100)}`;
}

function chartCurrency(value: unknown): string {
  return formatCurrency(Number(value) / 100);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(todayMonth);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<FinancialHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await getDashboard(month));
    } catch (loadError) {
      setDashboard(null);
      setError(loadError instanceof Error ? loadError.message : "Your dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await getFinancialHealth(month));
    } catch (loadError) {
      setHealth(null);
      setHealthError(loadError instanceof Error ? loadError.message : "Financial health could not be loaded.");
    } finally {
      setHealthLoading(false);
    }
  }, [month]);

  const loadGoals = useCallback(async () => {
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      setGoals((await getGoals()).items);
    } catch (loadError) {
      setGoalsError(loadError instanceof Error ? loadError.message : "Goals could not be loaded.");
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  const totals = dashboard?.totals;
  const metricCards = [
    {
      label: "Current balance",
      value: totals ? formatSignedCurrency(totals.balanceMinor) : "—",
      note: "Selected month · income minus expenses",
      icon: WalletMinimal,
      iconSurface: "metric-icon",
      valueClass: totals && totals.balanceMinor < 0 ? "text-rose-700" : "text-slate-900",
    },
    {
      label: "Income this month",
      value: totals ? formatCurrency(totals.incomeMinor / 100) : "—",
      note: `${formatMonth(month)} income`,
      icon: ArrowUpRight,
      iconSurface: "metric-icon",
      valueClass: "text-positive",
    },
    {
      label: "Expenses this month",
      value: totals ? formatCurrency(totals.expenseMinor / 100) : "—",
      note: `${formatMonth(month)} spending`,
      icon: ArrowDownRight,
      iconSurface: "metric-icon metric-icon--negative",
      valueClass: "text-rose-700",
    },
    {
      label: "Savings rate",
      value: totals?.savingsRate === null ? "Not available" : totals ? `${totals.savingsRate}%` : "—",
      note: totals?.savingsRate === null ? "No income recorded this month" : "Savings as a share of income",
      icon: ShieldCheck,
      iconSurface: "metric-icon",
      valueClass: totals?.savingsRate === null ? "text-base text-slate-500" : "text-slate-900",
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={formatMonth(month)}
        title="Your money, made clearer."
        description="A calm starting point for tracking, understanding, and improving your financial picture."
        motif
        action={
          <div className="flex items-center gap-3">
            <label className="hidden items-center gap-2 rounded-full border border-border-subtle bg-surface-card px-3 py-2 text-xs font-bold text-ink-700 sm:flex">
              <CalendarDays size={14} className="text-primary" />
              <span className="sr-only">Dashboard month</span>
              <input aria-label="Dashboard month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="bg-transparent outline-none" />
            </label>
            <span className="hidden items-center gap-1.5 rounded-full border border-brand-100 bg-surface-brand px-3 py-2 text-xs font-bold text-brand-700 lg:inline-flex">
              <span className="text-sm">{currencySymbol()}</span> INR workspace
            </span>
            <Button variant="secondary" onClick={() => setFormOpen(true)}><Plus size={16} /> Add transaction</Button>
          </div>
        }
      />

      <label className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500 sm:hidden">
        <CalendarDays size={15} className="text-primary" />
        <span>Dashboard month</span>
        <input aria-label="Dashboard month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="form-input ml-auto w-auto normal-case tracking-normal" />
      </label>

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">Your dashboard is unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
            <Button variant="secondary" onClick={() => void loadDashboard()}><RefreshCw size={15} /> Try again</Button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Monthly financial summary">
        {metricCards.map(({ label, value, icon: Icon, note, iconSurface, valueClass }) => (
          <Card key={label}>
            <CardContent className="min-h-[148px] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-700">{label}</p>
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", iconSurface)}><Icon size={18} /></span>
              </div>
              <div className="mt-5">
                <p className={cn("text-[27px] font-bold tracking-[-0.04em]", loading ? "text-slate-300" : valueClass)}>{loading ? "—" : value}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{loading ? "Loading your monthly summary…" : note}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="surface-card--brand">
          <CardHeader>
            <div>
              <h2 className="text-base font-bold text-slate-900">Spending overview</h2>
              <p className="mt-1 text-xs text-muted">{formatMonth(month)} · expenses by category</p>
            </div>
            <span className="metric-icon flex h-9 w-9 items-center justify-center rounded-xl"><BarChart3 size={18} /></span>
          </CardHeader>
          <CardContent className="pt-5">
            {loading ? (
              <div className="space-y-4" aria-label="Loading spending overview">
                <div className="h-44 animate-pulse rounded-xl bg-white/60" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/60" />
              </div>
            ) : error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-4 text-sm text-rose-800">Spending data is unavailable. Try again above to refresh this view.</p>
            ) : dashboard ? (
              <SpendingOverview data={dashboard} onAdd={() => setFormOpen(true)} onViewTransactions={() => navigate("/transactions")} />
            ) : null}
          </CardContent>
        </Card>

        <FinancialHealthCard data={health} loading={healthLoading} error={healthError} onRetry={() => void loadHealth()} />
      </section>

      <BudgetPerformance budgets={dashboard?.budgets ?? []} loading={loading} error={error} month={month} onViewBudgets={() => navigate("/budgets")} />

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent transactions</h2>
              <p className="mt-1 text-xs text-muted">The source of truth for your financial engine.</p>
            </div>
            <ReceiptText size={18} className="text-slate-400" />
          </CardHeader>
          <CardContent className="pt-5">
            {loading ? (
              <p className="text-sm text-slate-500">Loading recent transactions…</p>
            ) : error ? (
              <p className="text-sm text-rose-700">Recent transactions are unavailable. Try again above to refresh your dashboard.</p>
            ) : !dashboard || dashboard.recentTransactions.length === 0 ? (
              <EmptyState compact title="No transactions this month" description="Transactions you add for this month will show up here." action={<Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => setFormOpen(true)}>Add a transaction</Button>} />
            ) : (
              <RecentTransactions transactions={dashboard.recentTransactions} onViewAll={() => navigate("/transactions")} />
            )}
          </CardContent>
        </Card>
        <Card className="surface-card--brand">
          <CardHeader>
            <div>
              <h2 className="text-base font-bold text-slate-900">Goals at a glance</h2>
              <p className="mt-1 text-xs text-muted">Track the targets you have chosen for yourself.</p>
            </div>
            <Target size={18} className="text-brand-600" />
          </CardHeader>
          <CardContent className="pt-5">
            {goalsLoading ? <p className="text-sm text-slate-500">Loading goals…</p> : goalsError ? <p className="text-sm text-rose-700">{goalsError}</p> : goals.length === 0 ? <EmptyState compact title="Your goals start here" description="Set a target and keep its progress visible from your dashboard." action={<Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => navigate("/goals")}>Open goals</Button>} /> : <GoalsSummary goals={goals} onViewAll={() => navigate("/goals")} />}
          </CardContent>
        </Card>
      </section>
      {formOpen && (
        <TransactionForm
          editing={null}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await loadDashboard();
          }}
        />
      )}
    </div>
  );
}

function FinancialHealthCard({ data, loading, error, onRetry }: { data: FinancialHealthData | null; loading: boolean; error: string | null; onRetry: () => void }) {
  return (
    <Card className="surface-card--attention">
      <CardHeader>
        <div><h2 className="text-base font-bold text-slate-900">Financial health</h2><p className="mt-1 text-xs text-muted">A transparent Sejora metric, not financial advice.</p></div>
        <span className="icon-attention flex h-9 w-9 items-center justify-center rounded-xl"><ShieldCheck size={18} /></span>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? <div className="flex items-center gap-5"><div className="h-24 w-24 animate-pulse rounded-full border-[10px] border-slate-100" /><div className="space-y-3"><div className="h-4 w-32 animate-pulse rounded bg-slate-100" /><div className="h-3 w-48 animate-pulse rounded bg-slate-100" /></div></div> : error ? <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-800">{error}<Button variant="ghost" className="mt-2 px-0 text-xs text-brand-700" onClick={onRetry}>Try again</Button></div> : data?.score === null ? <div className="flex items-center gap-5"><div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[10px] border-slate-100 text-2xl font-bold text-slate-400">—</div><div><p className="font-bold text-slate-800">Building your baseline</p><p className="mt-1 text-sm leading-5 text-slate-500">A score appears after at least three months of activity and enough supported dimensions are available.</p><p className="mt-2 text-xs font-semibold text-slate-400">{data?.coveragePercent}% of supported dimensions available</p></div></div> : data ? <div><div className="flex items-center gap-5"><div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[10px] border-positive/20 text-2xl font-bold text-positive">{data.score}</div><div><p className="font-bold capitalize text-slate-800">{data.status} picture</p><p className="mt-1 text-sm leading-5 text-slate-500">Based on your recorded income, expenses, budgets, recurring costs, goals, and history.</p></div></div><div className="mt-5 grid grid-cols-2 gap-2">{data.components.filter((item) => item.available).slice(0, 4).map((item) => <div key={item.key} className="rounded-xl bg-white/60 px-3 py-2"><div className="flex justify-between gap-2 text-xs"><span className="truncate text-slate-500">{item.label}</span><span className="font-bold text-slate-700">{item.score}/{item.maxScore}</span></div></div>)}</div></div> : null}
      </CardContent>
    </Card>
  );
}

function GoalsSummary({ goals, onViewAll }: { goals: GoalView[]; onViewAll: () => void }) {
  return <div><div className="space-y-3">{goals.slice(0, 3).map((goal) => <div key={goal.id}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-semibold text-slate-700">{goal.name}</span><span className="shrink-0 font-bold text-positive">{goal.percentageComplete}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-positive" style={{ width: `${goal.percentageComplete}%` }} /></div></div>)}</div><Button variant="ghost" className="mt-3 px-0 text-xs text-brand-700 hover:bg-transparent hover:text-primary" onClick={onViewAll}>View all goals</Button></div>;
}

function SpendingOverview({ data, onAdd, onViewTransactions }: { data: DashboardData; onAdd: () => void; onViewTransactions: () => void }) {
  if (data.spendingByCategory.length === 0) {
    return (
      <EmptyState
        compact
        title={data.metadata.transactionCount === 0 ? "No transactions this month" : "No expenses this month"}
        description={data.metadata.transactionCount === 0 ? "Add a transaction to begin building your monthly spending timeline." : "Income is tracked separately. Add an expense to see category spending here."}
        action={<Button variant="secondary" className="px-3 py-2 text-xs" onClick={data.metadata.transactionCount === 0 ? onAdd : onViewTransactions}>{data.metadata.transactionCount === 0 ? "Add your first transaction" : "View transactions"}</Button>}
      />
    );
  }

  const chartData = data.spendingByCategory.map((item) => ({ ...item, amount: item.amountMinor }));
  return (
    <div>
      <div className="h-56 w-full" aria-label="Spending by category chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#dfddd4" strokeDasharray="3 3" />
            <XAxis type="number" hide tickFormatter={(value) => chartCurrency(value)} />
            <YAxis type="category" dataKey="category" width={88} tickLine={false} axisLine={false} tick={{ fill: "#49616a", fontSize: 11 }} />
            <Tooltip formatter={(value) => [chartCurrency(value), "Spent"]} cursor={{ fill: "rgba(217, 235, 229, 0.4)" }} />
            <Bar dataKey="amount" radius={[0, 5, 5, 0]} barSize={22}>
              {chartData.map((item, index) => <Cell key={item.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
        <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">{formatCurrency(data.totals.expenseMinor / 100)}</span> spent across {data.spendingByCategory.length} categor{data.spendingByCategory.length === 1 ? "y" : "ies"}.</p>
        <Button variant="ghost" className="px-0 text-xs text-brand-700 hover:bg-transparent hover:text-primary" onClick={onViewTransactions}>View ledger</Button>
      </div>
      <div className="sr-only">
        <h3>Spending by category</h3>
        <ul>{data.spendingByCategory.map((item) => <li key={item.category}>{item.category}: {formatCurrency(item.amountMinor / 100)} ({item.percentage}%)</li>)}</ul>
      </div>
    </div>
  );
}

const budgetStatus: Record<BudgetStatus, { label: string; className: string; barClassName: string }> = {
  healthy: { label: "Healthy", className: "bg-positive/10 text-positive", barClassName: "bg-positive" },
  approaching: { label: "Approaching limit", className: "bg-amber-50 text-amber-700", barClassName: "bg-amber-500" },
  at_limit: { label: "At limit", className: "bg-orange-50 text-orange-700", barClassName: "bg-orange-500" },
  overspent: { label: "Overspent", className: "bg-rose-50 text-rose-700", barClassName: "bg-rose-600" },
};

function BudgetPerformance({ budgets, loading, error, month, onViewBudgets }: { budgets: DashboardData["budgets"]; loading: boolean; error: string | null; month: string; onViewBudgets: () => void }) {
  return (
    <section className="mt-5">
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-base font-bold text-slate-900">Budget vs actual</h2>
            <p className="mt-1 text-xs text-muted">{formatMonth(month)} · planned spending compared with the ledger</p>
          </div>
          <WalletCards size={18} className="text-slate-400" />
        </CardHeader>
        <CardContent className="pt-5">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-3"><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /></div>
          ) : error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-4 text-sm text-rose-800">Budget comparison is unavailable. Try again above to refresh this view.</p>
          ) : budgets.length === 0 ? (
            <EmptyState compact title="No budgets for this month" description="Create a budget to compare your plan with actual spending." action={<Button variant="secondary" className="px-3 py-2 text-xs" onClick={onViewBudgets}>Open budgets</Button>} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {budgets.map((budget) => {
                const status = budgetStatus[budget.status];
                const progress = Math.min(100, Math.max(0, budget.usagePercent));
                return (
                  <div key={budget.id} className="rounded-xl border border-border-subtle bg-surface-muted px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-800">{budget.name}</p>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{budget.category || "All categories"}</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-slate-800">{formatCurrency(budget.amountMinor / 100)} planned</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">{formatCurrency(budget.spentMinor / 100)} spent</span>
                      <span className={budget.remainingMinor < 0 ? "font-bold text-rose-700" : "text-slate-500"}>{budget.remainingMinor < 0 ? `${formatCurrency(Math.abs(budget.remainingMinor) / 100)} over` : `${formatCurrency(budget.remainingMinor / 100)} remaining`}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={`${budget.name} usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                      <div className={`h-full rounded-full ${status.barClassName}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function RecentTransactions({ transactions, onViewAll }: { transactions: TransactionRecord[]; onViewAll: () => void }) {
  return (
    <div>
      <div className="divide-y divide-border-subtle">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{transaction.merchant}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{transaction.category || "Uncategorized"} · {formatDashboardDate(transaction.occurredAt)}</p>
            </div>
            <p className={cn("shrink-0 text-sm font-bold", transaction.type === "income" ? "text-positive" : "text-rose-700")}>
              {transaction.type === "income" ? "+" : "−"}{formatCurrency(transaction.amountMinor / 100)}
            </p>
          </div>
        ))}
      </div>
      <Button variant="ghost" className="mt-3 px-0 text-xs text-brand-700 hover:bg-transparent hover:text-primary" onClick={onViewAll}>View all transactions</Button>
    </div>
  );
}

function formatDashboardDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}