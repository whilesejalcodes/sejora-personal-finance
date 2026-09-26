import type {
  BudgetView,
  FinancialHealthComponent,
  FinancialHealthData,
  FinanceTotals,
  GoalView,
  RecurringPayment,
} from "../types/index.js";

export type FinancialHealthInput = {
  totals: FinanceTotals;
  expenseByMonth: readonly number[];
  historyMonths: number;
  budgets: readonly BudgetView[];
  recurringPayments: readonly RecurringPayment[];
  goals: readonly GoalView[];
  transactionCount: number;
  incomeTransactionCount: number;
  expenseTransactionCount: number;
  month: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function component(
  key: FinancialHealthComponent["key"],
  label: string,
  score: number,
  maxScore: number,
  available: boolean,
  explanation: string,
): FinancialHealthComponent {
  return { key, label, score: Math.round(clamp(score, 0, maxScore)), maxScore, available, explanation };
}

export function calculateFinancialHealth(input: FinancialHealthInput): FinancialHealthData {
  const { totals } = input;
  const savingsAvailable = totals.incomeMinor > 0;
  const savingsRate = totals.savingsRate ?? 0;
  const savingsScore = savingsAvailable ? clamp(((savingsRate + 20) / 40) * 30, 0, 30) : 0;

  const budgetAvailable = input.budgets.length > 0;
  const averageBudgetUsage = budgetAvailable
    ? input.budgets.reduce((sum, budget) => sum + budget.usagePercent, 0) / input.budgets.length
    : 0;
  const budgetScore = budgetAvailable
    ? averageBudgetUsage <= 80
      ? 25
      : averageBudgetUsage <= 100
        ? 25 - ((averageBudgetUsage - 80) * 0.5)
        : Math.max(0, 15 - ((averageBudgetUsage - 100) * 0.15))
    : 0;

  const expenseMonths = input.expenseByMonth.filter((amount) => amount > 0);
  const stabilityAvailable = expenseMonths.length >= 3;
  const averageExpenses = stabilityAvailable ? expenseMonths.reduce((sum, amount) => sum + amount, 0) / expenseMonths.length : 0;
  const averageDeviation = stabilityAvailable
    ? expenseMonths.reduce((sum, amount) => sum + Math.abs(amount - averageExpenses), 0) / expenseMonths.length
    : 0;
  const stabilityScore = stabilityAvailable && averageExpenses > 0
    ? Math.max(0, 20 - ((averageDeviation / averageExpenses) * 20))
    : 0;

  const recurringAvailable = input.recurringPayments.length > 0 && totals.incomeMinor > 0;
  const recurringMonthlyEquivalent = input.recurringPayments.reduce((sum, payment) => {
    if (payment.frequency === "weekly") return sum + ((payment.typicalAmountMinor * 52) / 12);
    if (payment.frequency === "quarterly") return sum + (payment.typicalAmountMinor / 3);
    return sum + payment.typicalAmountMinor;
  }, 0);
  const recurringPressurePercent = totals.incomeMinor > 0
    ? (recurringMonthlyEquivalent / totals.incomeMinor) * 100
    : 0;
  const recurringScore = recurringAvailable ? Math.max(0, 15 - (clamp(recurringPressurePercent, 0, 100) * 0.15)) : 0;

  const goalsAvailable = input.goals.length > 0;
  const averageGoalProgress = goalsAvailable
    ? input.goals.reduce((sum, goal) => sum + goal.percentageComplete, 0) / input.goals.length
    : 0;
  const goalScore = goalsAvailable ? (averageGoalProgress / 100) * 10 : 0;

  const components = [
    component("savings", "Savings", savingsScore, 30, savingsAvailable, savingsAvailable
      ? `Savings rate is ${rounded(savingsRate)}% for ${input.month}.`
      : "Add income to compare savings with earnings."),
    component("budget_discipline", "Budget discipline", budgetScore, 25, budgetAvailable, budgetAvailable
      ? `Average budget usage is ${rounded(averageBudgetUsage)}% across ${input.budgets.length} budget${input.budgets.length === 1 ? "" : "s"}.`
      : "Create a budget to measure planned versus actual spending."),
    component("spending_stability", "Spending stability", stabilityScore, 20, stabilityAvailable, stabilityAvailable
      ? `Based on variation across ${expenseMonths.length} months with expenses.`
      : "At least three months with expenses are needed to measure stability."),
    component("recurring_cost_pressure", "Recurring-cost pressure", recurringScore, 15, recurringAvailable, recurringAvailable
      ? `Detected recurring costs are about ${rounded(recurringPressurePercent)}% of this month's income.`
      : input.recurringPayments.length > 0
        ? "Recurring costs need income data before pressure can be measured."
        : "No recurring payment patterns are available."),
    component("goal_progress", "Goal progress", goalScore, 10, goalsAvailable, goalsAvailable
      ? `Average progress across ${input.goals.length} goal${input.goals.length === 1 ? "" : "s"} is ${rounded(averageGoalProgress)}%.`
      : "Create a goal to include progress in this metric."),
  ] satisfies FinancialHealthComponent[];

  const availableMax = components.filter((item) => item.available).reduce((sum, item) => sum + item.maxScore, 0);
  const availableScore = components.filter((item) => item.available).reduce((sum, item) => sum + item.score, 0);
  const coveragePercent = availableMax;
  const enoughForScore = input.transactionCount > 0 && input.historyMonths >= 3 && availableMax >= 60;
  const score = enoughForScore && availableMax > 0 ? Math.round((availableScore * 100) / availableMax) : null;

  return {
    month: input.month,
    score,
    status: score === null ? "insufficient_data" : coveragePercent < 80 ? "developing" : "established",
    coveragePercent,
    components,
    metadata: {
      transactionCount: input.transactionCount,
      incomeTransactionCount: input.incomeTransactionCount,
      expenseTransactionCount: input.expenseTransactionCount,
      historyMonths: input.historyMonths,
      budgetCount: input.budgets.length,
      goalCount: input.goals.length,
      recurringCount: input.recurringPayments.length,
    },
    disclaimer: "This is a transparent Sejora metric based on your recorded data, not professional financial advice.",
  };
}