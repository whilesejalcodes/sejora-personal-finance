import type {
  CategorySpending,
  FinanceDataMetadata,
  FinanceTotals,
  MonthlyFinancePoint,
  TransactionRecord,
} from "../types/index.js";

export type DateRange = {
  from: string;
  to: string;
};

export function getMonthRange(month: string): DateRange {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthSequence(from: string, to: string): string[] {
  const months: string[] = [];
  let current = from;
  while (current <= to) {
    months.push(current);
    current = shiftMonth(current, 1);
  }
  return months;
}

function roundedPercentage(numerator: number, denominator: number): number {
  return Math.round((numerator * 10000) / denominator) / 100;
}

export function calculateSavingsRate(incomeMinor: number, savingsMinor: number): number | null {
  if (incomeMinor <= 0) return null;
  return roundedPercentage(savingsMinor, incomeMinor);
}

export function calculateFinanceTotals(transactions: readonly TransactionRecord[]): FinanceTotals {
  const incomeMinor = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  const expenseMinor = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  const savingsMinor = incomeMinor - expenseMinor;

  return {
    incomeMinor,
    expenseMinor,
    balanceMinor: savingsMinor,
    savingsMinor,
    savingsRate: calculateSavingsRate(incomeMinor, savingsMinor),
  };
}

export function calculateFinanceMetadata(transactions: readonly TransactionRecord[]): FinanceDataMetadata {
  return {
    transactionCount: transactions.length,
    incomeTransactionCount: transactions.filter((transaction) => transaction.type === "income").length,
    expenseTransactionCount: transactions.filter((transaction) => transaction.type === "expense").length,
  };
}

export function aggregateCategorySpending(transactions: readonly TransactionRecord[]): CategorySpending[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    if (!transaction.category) continue;
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amountMinor);
  }
  const totalExpenses = [...totals.values()].reduce((total, amount) => total + amount, 0);
  return [...totals.entries()]
    .map(([category, amountMinor]) => ({
      category,
      amountMinor,
      percentage: totalExpenses > 0 ? roundedPercentage(amountMinor, totalExpenses) : 0,
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor || left.category.localeCompare(right.category));
}

export function aggregateMonthlyFinance(
  transactions: readonly TransactionRecord[],
  from: string,
  to: string,
): MonthlyFinancePoint[] {
  const totals = new Map<string, { incomeMinor: number; expenseMinor: number; transactionCount: number }>();
  for (const month of monthSequence(from, to)) {
    totals.set(month, { incomeMinor: 0, expenseMinor: 0, transactionCount: 0 });
  }

  for (const transaction of transactions) {
    const month = transaction.occurredAt.slice(0, 7);
    const current = totals.get(month);
    if (!current) continue;
    current.transactionCount += 1;
    if (transaction.type === "income") current.incomeMinor += transaction.amountMinor;
    else current.expenseMinor += transaction.amountMinor;
  }

  return [...totals.entries()].map(([month, value]) => ({
    month,
    incomeMinor: value.incomeMinor,
    expenseMinor: value.expenseMinor,
    netFlowMinor: value.incomeMinor - value.expenseMinor,
    transactionCount: value.transactionCount,
  }));
}